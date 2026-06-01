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

@Slf4j
@Component
@RequiredArgsConstructor
public class SemgrepRunner implements ScanRunner {

    private final ObjectMapper objectMapper;

    @Override
    public ToolName getToolName() {
        return ToolName.SEMGREP;
    }

    @Override
    public List<Vulnerability> run(ScanToolRun toolRun, ScanContext context) {
        List<Vulnerability> vulnerabilities = new ArrayList<>();

        try {
            ProcessBuilder pb = new ProcessBuilder(
                "docker", "run", "--rm",
                "-v", context.workspace() + ":/src:ro",
                "semgrep/semgrep:latest",
                "semgrep", "--config", "auto", "--json", "--quiet",
                context.containerSourcePath()
            );
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String output = ProcessIo.readUtf8(process.getInputStream());
            process.waitFor();

            JsonNode results = objectMapper.readTree(output).path("results");
            if (!results.isArray()) return vulnerabilities;

            for (JsonNode r : results) {
                JsonNode extra = r.path("extra");
                String severityStr = extra.path("severity").asText("INFO").toUpperCase();
                int line = r.path("start").path("line").asInt(0);

                Vulnerability vuln = Vulnerability.builder()
                    .scan(toolRun.getScan())
                    .scanToolRun(toolRun)
                    .toolSource(ToolName.SEMGREP.name())
                    .cveId(r.path("check_id").asText(null))
                    .title(extra.path("message").asText(r.path("check_id").asText("Semgrep finding")))
                    .description(extra.path("metadata").path("description").asText(null))
                    .severity(parseSeverity(severityStr))
                    .category(VulnCategory.SAST)
                    .filePath(r.path("path").asText(null))
                    .lineNumber(line > 0 ? line : null)
                    .build();

                vulnerabilities.add(vuln);
            }

        } catch (Exception e) {
            log.error("Semgrep scan failed", e);
            toolRun.setErrorMessage(e.getMessage());
        }

        return vulnerabilities;
    }

    private Severity parseSeverity(String s) {
        return switch (s) {
            case "ERROR", "CRITICAL" -> Severity.CRITICAL;
            case "WARNING", "HIGH"   -> Severity.HIGH;
            case "MEDIUM"            -> Severity.MEDIUM;
            case "LOW"               -> Severity.LOW;
            default                  -> Severity.INFO;
        };
    }
}
