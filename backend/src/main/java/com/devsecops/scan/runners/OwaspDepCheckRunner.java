package com.devsecops.scan.runners;

import com.devsecops.model.ScanToolRun;
import com.devsecops.model.Vulnerability;
import com.devsecops.model.enums.Severity;
import com.devsecops.model.enums.ToolName;
import com.devsecops.model.enums.VulnCategory;
import com.devsecops.scan.ScanContext;
import com.devsecops.scan.ScanRunner;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.StreamSupport;

@Slf4j
@Component
@RequiredArgsConstructor
public class OwaspDepCheckRunner implements ScanRunner {

    private final ObjectMapper objectMapper;

    @Override
    public ToolName getToolName() {
        return ToolName.OWASP_DEP_CHECK;
    }

    @Override
    public List<Vulnerability> run(ScanToolRun toolRun, ScanContext context) {
        List<Vulnerability> vulnerabilities = new ArrayList<>();

        try {
            Path reportDir = context.workspace().resolve("owasp-reports");
            Files.createDirectories(reportDir);

            ProcessBuilder pb = new ProcessBuilder(
                "docker", "run", "--rm",
                "-v", context.workspace() + ":/workspace",
                "owasp/dependency-check:latest",
                "--scan", context.containerSourcePath(),
                "--format", "JSON",
                "--out", "/workspace/owasp-reports",
                "--project", "agentguard-scan",
                "--noupdate"
            );
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String output = new String(process.getInputStream().readAllBytes());
            process.waitFor();
            toolRun.setRawOutput(output);

            Path report = findJsonReport(reportDir);
            if (report == null) {
                log.warn("OWASP Dependency-Check produced no JSON report in {}", reportDir);
                return vulnerabilities;
            }

            JsonNode root = objectMapper.readTree(report.toFile());
            JsonNode deps = root.path("dependencies");
            if (!deps.isArray()) return vulnerabilities;

            for (JsonNode dep : deps) {
                String component = dep.path("fileName").asText(dep.path("packages").asText(null));
                JsonNode vulns = dep.path("vulnerabilities");
                if (!vulns.isArray()) continue;

                for (JsonNode v : vulns) {
                    String severityStr = v.path("severity").asText("MEDIUM").toUpperCase();
                    BigDecimal cvss = parseCvss(v.path("cvssv3").path("baseScore").asText(null));

                    Vulnerability finding = Vulnerability.builder()
                        .scan(toolRun.getScan())
                        .scanToolRun(toolRun)
                        .toolSource(ToolName.OWASP_DEP_CHECK.name())
                        .cveId(v.path("name").asText(null))
                        .title(v.path("name").asText("Dependency vulnerability"))
                        .description(v.path("description").asText(null))
                        .severity(parseSeverity(severityStr))
                        .category(VulnCategory.DEPENDENCY)
                        .affectedComponent(component)
                        .cvssScore(cvss)
                        .build();

                    vulnerabilities.add(finding);
                }
            }

        } catch (Exception e) {
            log.error("OWASP Dependency-Check failed", e);
            toolRun.setErrorMessage(e.getMessage());
        }

        return vulnerabilities;
    }

    private Path findJsonReport(Path reportDir) throws Exception {
        try (var stream = Files.list(reportDir)) {
            return stream
                    .filter(p -> p.getFileName().toString().endsWith(".json"))
                    .findFirst()
                    .orElse(null);
        }
    }

    private BigDecimal parseCvss(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return new BigDecimal(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Severity parseSeverity(String s) {
        return switch (s) {
            case "CRITICAL" -> Severity.CRITICAL;
            case "HIGH"     -> Severity.HIGH;
            case "MEDIUM"   -> Severity.MEDIUM;
            case "LOW"      -> Severity.LOW;
            default         -> Severity.INFO;
        };
    }
}
