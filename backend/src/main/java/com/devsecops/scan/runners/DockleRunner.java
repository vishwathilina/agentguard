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

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class DockleRunner implements ScanRunner {

    private final ObjectMapper objectMapper;

    @Override
    public ToolName getToolName() {
        return ToolName.DOCKLE;
    }

    @Override
    public List<Vulnerability> run(ScanToolRun toolRun, ScanContext context) {
        List<Vulnerability> vulnerabilities = new ArrayList<>();

        if (context.targetType() != TargetType.DOCKER_IMAGE) {
            return vulnerabilities;
        }

        try {
            ProcessBuilder pb = new ProcessBuilder(
                "docker", "run", "--rm",
                "-v", "/var/run/docker.sock:/var/run/docker.sock",
                "goodwithtech/dockle:latest",
                context.target(),
                "--format", "json"
            );
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String output = ProcessIo.readUtf8(process.getInputStream());
            process.waitFor();

            JsonNode details = objectMapper.readTree(output).path("details");
            if (!details.isArray()) return vulnerabilities;

            for (JsonNode d : details) {
                String level = d.path("level").asText("WARN").toUpperCase();

                Vulnerability vuln = Vulnerability.builder()
                    .scan(toolRun.getScan())
                    .scanToolRun(toolRun)
                    .toolSource(ToolName.DOCKLE.name())
                    .cveId(d.path("code").asText(null))
                    .title(d.path("title").asText("Container best-practice issue"))
                    .description(d.path("details").asText(null))
                    .severity(parseSeverity(level))
                    .category(VulnCategory.IAC_MISCONFIG)
                    .affectedComponent(context.target())
                    .build();

                vulnerabilities.add(vuln);
            }

        } catch (Exception e) {
            log.error("Dockle scan failed for image: {}", context.target(), e);
            toolRun.setErrorMessage(e.getMessage());
        }

        return vulnerabilities;
    }

    private Severity parseSeverity(String s) {
        return switch (s) {
            case "FATAL", "CRITICAL" -> Severity.CRITICAL;
            case "ERROR", "HIGH"     -> Severity.HIGH;
            case "WARN", "MEDIUM"    -> Severity.MEDIUM;
            case "LOW"               -> Severity.LOW;
            default                  -> Severity.INFO;
        };
    }
}
