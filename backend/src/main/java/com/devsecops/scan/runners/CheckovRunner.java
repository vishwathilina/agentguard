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
import java.util.Iterator;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class CheckovRunner implements ScanRunner {

    private final ObjectMapper objectMapper;

    @Override
    public ToolName getToolName() {
        return ToolName.CHECKOV;
    }

    @Override
    public List<Vulnerability> run(ScanToolRun toolRun, ScanContext context) {
        List<Vulnerability> vulnerabilities = new ArrayList<>();

        try {
            ProcessBuilder pb = new ProcessBuilder(
                "docker", "run", "--rm",
                "-v", context.workspace() + ":/workspace:ro",
                "bridgecrew/checkov:latest",
                "-d", context.containerSourcePath(),
                "--framework", "all",
                "--compact",
                "--quiet",
                "-o", "json"
            );
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String output = ProcessIo.readUtf8(process.getInputStream());
            process.waitFor();

            parseCheckovOutput(objectMapper.readTree(output), toolRun, vulnerabilities);

        } catch (Exception e) {
            log.error("Checkov scan failed", e);
            toolRun.setErrorMessage(e.getMessage());
        }

        return vulnerabilities;
    }

    private void parseCheckovOutput(JsonNode root, ScanToolRun toolRun, List<Vulnerability> vulnerabilities) {
        if (root.isArray()) {
            for (JsonNode entry : root) {
                collectFailedChecks(entry.path("results"), toolRun, vulnerabilities);
            }
            return;
        }
        if (root.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = root.fields();
            while (fields.hasNext()) {
                collectFailedChecks(fields.next().getValue(), toolRun, vulnerabilities);
            }
        }
    }

    private void collectFailedChecks(JsonNode resultsNode, ScanToolRun toolRun, List<Vulnerability> vulnerabilities) {
        if (resultsNode == null || resultsNode.isMissingNode()) return;

        JsonNode failed = resultsNode.path("failed_checks");
        if (!failed.isArray()) return;

        for (JsonNode check : failed) {
            String severityStr = check.path("severity").asText("MEDIUM").toUpperCase();
            JsonNode lineRange = check.path("file_line_range");
            Integer line = lineRange.isArray() && !lineRange.isEmpty()
                    ? lineRange.get(0).asInt()
                    : null;

            Vulnerability vuln = Vulnerability.builder()
                .scan(toolRun.getScan())
                .scanToolRun(toolRun)
                .toolSource(ToolName.CHECKOV.name())
                .cveId(check.path("check_id").asText(null))
                .title(check.path("check_name").asText("Checkov policy violation"))
                .description(check.path("guideline").asText(check.path("check_name").asText(null)))
                .severity(parseSeverity(severityStr))
                .category(VulnCategory.IAC_MISCONFIG)
                .filePath(check.path("file_path").asText(null))
                .lineNumber(line)
                .build();

            vulnerabilities.add(vuln);
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
