package com.devsecops.scan.runners;

import com.devsecops.model.ScanToolRun;
import com.devsecops.model.Vulnerability;
import com.devsecops.model.enums.Severity;
import com.devsecops.model.enums.TargetType;
import com.devsecops.model.enums.ToolName;
import com.devsecops.model.enums.VulnCategory;
import com.devsecops.scan.ProcessIo;
import com.devsecops.scan.ScanContext;
import com.devsecops.scan.ScanRunner;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class TrivyRunner implements ScanRunner {

    private final ObjectMapper objectMapper;

    @Override
    public ToolName getToolName() {
        return ToolName.TRIVY;
    }

    @Override
    public List<Vulnerability> run(ScanToolRun toolRun, ScanContext context) {
        List<Vulnerability> vulnerabilities = new ArrayList<>();

        try {
            ProcessBuilder pb;
            if (context.targetType() == TargetType.DOCKER_IMAGE) {
                pb = new ProcessBuilder(
                    "docker", "run", "--rm",
                    "aquasec/trivy:latest",
                    "image", "--format", "json", "--quiet", context.target()
                );
            } else {
                pb = new ProcessBuilder(
                    "docker", "run", "--rm",
                    "-v", context.workspace() + ":/workspace:ro",
                    "aquasec/trivy:latest",
                    "fs", "--format", "json", "--quiet", context.containerSourcePath()
                );
            }
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String output = ProcessIo.readUtf8(process.getInputStream());
            int exitCode = process.waitFor();

            if (exitCode != 0 && exitCode != 5) {
                log.warn("Trivy exited with code {} for target: {}", exitCode, context.target());
            }

            parseTrivyResults(objectMapper.readTree(output), toolRun, vulnerabilities);

        } catch (Exception e) {
            log.error("Trivy scan failed for target: {}", context.target(), e);
            toolRun.setErrorMessage(e.getMessage());
            toolRun.setRawOutput(ProcessIo.truncateForStorage(e.toString(), 2000));
        }

        return vulnerabilities;
    }

    private void parseTrivyResults(JsonNode root, ScanToolRun toolRun, List<Vulnerability> vulnerabilities) {
        JsonNode results = root.path("Results");
        if (!results.isArray()) return;

        for (JsonNode result : results) {
            JsonNode vulns = result.path("Vulnerabilities");
            if (!vulns.isArray()) continue;

            for (JsonNode v : vulns) {
                String severityStr = v.path("Severity").asText("UNKNOWN").toUpperCase();
                Severity severity = parseSeverity(severityStr);

                String cvssStr = v.path("CVSS").path("nvd").path("V3Score").asText(null);
                BigDecimal cvss = cvssStr != null && !cvssStr.isBlank() ? new BigDecimal(cvssStr) : null;

                Vulnerability vuln = Vulnerability.builder()
                    .scan(toolRun.getScan())
                    .scanToolRun(toolRun)
                    .toolSource(ToolName.TRIVY.name())
                    .cveId(v.path("VulnerabilityID").asText(null))
                    .title(v.path("Title").asText(v.path("VulnerabilityID").asText("Unknown")))
                    .description(v.path("Description").asText(null))
                    .severity(severity)
                    .category(VulnCategory.CVE)
                    .affectedComponent(v.path("PkgName").asText(null))
                    .affectedVersion(v.path("InstalledVersion").asText(null))
                    .fixedVersion(v.path("FixedVersion").asText(null))
                    .cvssScore(cvss)
                    .build();

                vulnerabilities.add(vuln);
            }
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
