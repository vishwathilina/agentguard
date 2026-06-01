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
public class GrypeRunner implements ScanRunner {

    private final ObjectMapper objectMapper;

    @Override
    public ToolName getToolName() {
        return ToolName.GRYPE;
    }

    @Override
    public List<Vulnerability> run(ScanToolRun toolRun, ScanContext context) {
        List<Vulnerability> vulnerabilities = new ArrayList<>();

        try {
            ProcessBuilder pb;
            if (context.targetType() == TargetType.DOCKER_IMAGE) {
                pb = new ProcessBuilder(
                    "docker", "run", "--rm",
                    "anchore/grype:latest",
                    context.target(), "-o", "json", "-q"
                );
            } else {
                pb = new ProcessBuilder(
                    "docker", "run", "--rm",
                    "-v", context.workspace() + ":/workspace:ro",
                    "anchore/grype:latest",
                    "dir:/workspace/repo", "-o", "json", "-q"
                );
            }
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String output = ProcessIo.readUtf8(process.getInputStream());
            process.waitFor();

            JsonNode matches = objectMapper.readTree(output).path("matches");
            if (!matches.isArray()) return vulnerabilities;

            for (JsonNode match : matches) {
                JsonNode v = match.path("vulnerability");
                JsonNode artifact = match.path("artifact");

                Vulnerability finding = Vulnerability.builder()
                    .scan(toolRun.getScan())
                    .scanToolRun(toolRun)
                    .toolSource(ToolName.GRYPE.name())
                    .cveId(v.path("id").asText(null))
                    .title(v.path("id").asText("Grype finding"))
                    .description(v.path("description").asText(null))
                    .severity(parseSeverity(v.path("severity").asText("Unknown")))
                    .category(VulnCategory.CVE)
                    .affectedComponent(artifact.path("name").asText(null))
                    .affectedVersion(artifact.path("version").asText(null))
                    .build();

                vulnerabilities.add(finding);
            }

        } catch (Exception e) {
            log.error("Grype scan failed for target: {}", context.target(), e);
            toolRun.setErrorMessage(e.getMessage());
        }

        return vulnerabilities;
    }

    private Severity parseSeverity(String s) {
        return switch (s.toUpperCase()) {
            case "CRITICAL"   -> Severity.CRITICAL;
            case "HIGH"       -> Severity.HIGH;
            case "MEDIUM"     -> Severity.MEDIUM;
            case "LOW"        -> Severity.LOW;
            case "NEGLIGIBLE" -> Severity.INFO;
            default           -> Severity.INFO;
        };
    }
}
