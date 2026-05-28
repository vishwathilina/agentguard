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

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class TfsecRunner implements ScanRunner {

    private final ObjectMapper objectMapper;

    @Override
    public ToolName getToolName() {
        return ToolName.TFSEC;
    }

    @Override
    public List<Vulnerability> run(ScanToolRun toolRun, ScanContext context) {
        List<Vulnerability> vulnerabilities = new ArrayList<>();

        try {
            ProcessBuilder pb = new ProcessBuilder(
                "docker", "run", "--rm",
                "-v", context.workspace() + ":/workspace:ro",
                "aquasecurity/tfsec:latest",
                context.containerSourcePath(),
                "--format", "json"
            );
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String output = new String(process.getInputStream().readAllBytes());
            process.waitFor();
            toolRun.setRawOutput(output);

            JsonNode root     = objectMapper.readTree(output);
            JsonNode results  = root.path("results");
            if (!results.isArray()) return vulnerabilities;

            for (JsonNode r : results) {
                String severityStr = r.path("severity").asText("LOW").toUpperCase();
                Severity severity  = parseSeverity(severityStr);
                int line = r.path("location").path("start_line").asInt(0);

                Vulnerability vuln = Vulnerability.builder()
                    .scan(toolRun.getScan())
                    .scanToolRun(toolRun)
                    .toolSource(ToolName.TFSEC.name())
                    .cveId(r.path("rule_id").asText(null))
                    .title(r.path("rule_summary").asText("IaC misconfiguration"))
                    .description(r.path("description").asText(null))
                    .severity(severity)
                    .category(VulnCategory.IAC_MISCONFIG)
                    .filePath(r.path("location").path("filename").asText(null))
                    .lineNumber(line > 0 ? line : null)
                    .build();

                vulnerabilities.add(vuln);
            }

        } catch (Exception e) {
            log.error("tfsec scan failed", e);
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
