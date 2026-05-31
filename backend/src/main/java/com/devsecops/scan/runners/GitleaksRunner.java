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

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class GitleaksRunner implements ScanRunner {

    private final ObjectMapper objectMapper;

    @Override
    public ToolName getToolName() {
        return ToolName.GITLEAKS;
    }

    @Override
    public List<Vulnerability> run(ScanToolRun toolRun, ScanContext context) {
        List<Vulnerability> vulnerabilities = new ArrayList<>();

        try {
            Path reportFile = context.workspace().resolve("gitleaks-report.json");
            String sourcePath = context.containerSourcePath();

            ProcessBuilder pb = new ProcessBuilder(
                "docker", "run", "--rm",
                "-v", context.workspace() + ":/workspace",
                "zricethezav/gitleaks:latest",
                "detect",
                "--source", sourcePath,
                "--report-format", "json",
                "--report-path", "/workspace/gitleaks-report.json"
            );
            pb.redirectErrorStream(true);

            Process process = pb.start();
            process.waitFor();

            if (!reportFile.toFile().exists()) {
                return vulnerabilities;
            }

            JsonNode findings = objectMapper.readTree(reportFile.toFile());
            if (!findings.isArray()) return vulnerabilities;

            for (JsonNode finding : findings) {
                String ruleId  = finding.path("RuleID").asText("unknown-secret");
                String file    = finding.path("File").asText(null);
                int    line    = finding.path("StartLine").asInt(0);
                String commit  = finding.path("Commit").asText(null);

                String description = String.format(
                    "Secret detected — Rule: %s | Commit: %s", ruleId, commit
                );

                Vulnerability vuln = Vulnerability.builder()
                    .scan(toolRun.getScan())
                    .scanToolRun(toolRun)
                    .toolSource(ToolName.GITLEAKS.name())
                    .title("Exposed secret: " + ruleId)
                    .description(description)
                    .severity(Severity.CRITICAL)
                    .category(VulnCategory.SECRET)
                    .filePath(file)
                    .lineNumber(line > 0 ? line : null)
                    .build();

                vulnerabilities.add(vuln);
            }

        } catch (Exception e) {
            log.error("Gitleaks scan failed for {}", context.target(), e);
            toolRun.setErrorMessage(e.getMessage());
        }

        return vulnerabilities;
    }
}
