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
public class BanditRunner implements ScanRunner {

    private final ObjectMapper objectMapper;

    @Override
    public ToolName getToolName() {
        return ToolName.BANDIT;
    }

    @Override
    public List<Vulnerability> run(ScanToolRun toolRun, ScanContext context) {
        List<Vulnerability> vulnerabilities = new ArrayList<>();

        try {
            ProcessBuilder pb = new ProcessBuilder(
                "docker", "run", "--rm",
                "-v", context.workspace() + ":/workspace:ro",
                "python:3.12-slim",
                "sh", "-c",
                "pip install -q bandit && bandit -r " + context.containerSourcePath()
                    + " -f json -q 2>/dev/null || true"
            );
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String output = ProcessIo.readUtf8(process.getInputStream());
            process.waitFor();

            JsonNode results = objectMapper.readTree(output).path("results");
            if (!results.isArray()) return vulnerabilities;

            for (JsonNode r : results) {
                String severityStr = r.path("issue_severity").asText("LOW").toUpperCase();
                int line = r.path("line_number").asInt(0);

                Vulnerability vuln = Vulnerability.builder()
                    .scan(toolRun.getScan())
                    .scanToolRun(toolRun)
                    .toolSource(ToolName.BANDIT.name())
                    .cveId(r.path("test_id").asText(null))
                    .title(r.path("issue_text").asText("Python security issue"))
                    .severity(parseSeverity(severityStr))
                    .category(VulnCategory.SAST)
                    .filePath(r.path("filename").asText(null))
                    .lineNumber(line > 0 ? line : null)
                    .build();

                vulnerabilities.add(vuln);
            }

        } catch (Exception e) {
            log.error("Bandit scan failed", e);
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
