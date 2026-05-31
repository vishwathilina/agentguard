package com.devsecops.scan.runners;

import com.devsecops.model.ScanToolRun;
import com.devsecops.model.Vulnerability;
import com.devsecops.model.enums.Severity;
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

import java.util.ArrayList;
import java.util.List;

/**
 * Kubernetes manifest scanner using Trivy config checks (local dev substitute for kube-bench).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KubeBenchRunner implements ScanRunner {

    private final ObjectMapper objectMapper;

    @Override
    public ToolName getToolName() {
        return ToolName.KUBE_BENCH;
    }

    @Override
    public List<Vulnerability> run(ScanToolRun toolRun, ScanContext context) {
        List<Vulnerability> vulnerabilities = new ArrayList<>();

        try {
            ProcessBuilder pb = new ProcessBuilder(
                "docker", "run", "--rm",
                "-v", context.workspace() + ":/workspace:ro",
                "aquasec/trivy:latest",
                "config", "--format", "json", "--quiet", context.containerSourcePath()
            );
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String output = ProcessIo.readUtf8(process.getInputStream());
            process.waitFor();

            JsonNode root = objectMapper.readTree(output);
            JsonNode results = root.path("Results");
            if (!results.isArray()) return vulnerabilities;

            for (JsonNode result : results) {
                JsonNode misconfigs = result.path("Misconfigurations");
                if (!misconfigs.isArray()) continue;

                for (JsonNode m : misconfigs) {
                    String severityStr = m.path("Severity").asText("MEDIUM").toUpperCase();
                    int line = m.path("CauseMetadata").path("StartLine").asInt(0);

                    Vulnerability vuln = Vulnerability.builder()
                        .scan(toolRun.getScan())
                        .scanToolRun(toolRun)
                        .toolSource(ToolName.KUBE_BENCH.name())
                        .cveId(m.path("ID").asText(null))
                        .title(m.path("Title").asText("Kubernetes misconfiguration"))
                        .description(m.path("Description").asText(null))
                        .severity(parseSeverity(severityStr))
                        .category(VulnCategory.K8S_SECURITY)
                        .filePath(m.path("CauseMetadata").path("Resource").asText(null))
                        .lineNumber(line > 0 ? line : null)
                        .build();

                    vulnerabilities.add(vuln);
                }
            }

        } catch (Exception e) {
            log.error("Kubernetes config scan failed", e);
            toolRun.setErrorMessage(e.getMessage());
        }

        return vulnerabilities;
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
