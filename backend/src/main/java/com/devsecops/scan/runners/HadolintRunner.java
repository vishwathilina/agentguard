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

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

@Slf4j
@Component
@RequiredArgsConstructor
public class HadolintRunner implements ScanRunner {

    private final ObjectMapper objectMapper;

    @Override
    public ToolName getToolName() {
        return ToolName.HADOLINT;
    }

    @Override
    public List<Vulnerability> run(ScanToolRun toolRun, ScanContext context) {
        List<Vulnerability> vulnerabilities = new ArrayList<>();

        try {
            List<Path> dockerfiles = findDockerfiles(context.sourceRoot());
            if (dockerfiles.isEmpty()) {
                return vulnerabilities;
            }

            for (Path dockerfile : dockerfiles) {
                Path rel = context.workspace().relativize(dockerfile);
                String containerPath = "/workspace/" + rel.toString().replace('\\', '/');

                ProcessBuilder pb = new ProcessBuilder(
                    "docker", "run", "--rm",
                    "-v", context.workspace() + ":/workspace:ro",
                    "hadolint/hadolint:latest",
                    "hadolint", "-f", "json", containerPath
                );
                pb.redirectErrorStream(true);

                Process process = pb.start();
                String output = ProcessIo.readUtf8(process.getInputStream());
                process.waitFor();

                parseHadolintJson(output, rel.toString(), toolRun, vulnerabilities);
            }

        } catch (Exception e) {
            log.error("Hadolint scan failed", e);
            toolRun.setErrorMessage(e.getMessage());
        }

        return vulnerabilities;
    }

    private void parseHadolintJson(String output, String relativePath, ScanToolRun toolRun,
                                   List<Vulnerability> vulnerabilities) throws IOException {
        JsonNode root = objectMapper.readTree(output);
        if (!root.isArray()) return;

        for (JsonNode item : root) {
            String level = item.path("level").asText("info").toLowerCase();
            int line = item.path("line").asInt(0);

            Vulnerability vuln = Vulnerability.builder()
                .scan(toolRun.getScan())
                .scanToolRun(toolRun)
                .toolSource(ToolName.HADOLINT.name())
                .cveId(item.path("code").asText(null))
                .title(item.path("message").asText("Dockerfile lint issue"))
                .severity(parseLevel(level))
                .category(VulnCategory.IAC_MISCONFIG)
                .filePath(relativePath)
                .lineNumber(line > 0 ? line : null)
                .build();

            vulnerabilities.add(vuln);
        }
    }

    private List<Path> findDockerfiles(Path root) throws IOException {
        List<Path> found = new ArrayList<>();
        if (!Files.isDirectory(root)) return found;

        try (Stream<Path> walk = Files.walk(root, 8)) {
            walk.filter(Files::isRegularFile)
                .filter(p -> {
                    String name = p.getFileName().toString();
                    return name.equals("Dockerfile") || name.startsWith("Dockerfile.");
                })
                .forEach(found::add);
        }
        return found;
    }

    private Severity parseLevel(String level) {
        return switch (level) {
            case "error"   -> Severity.HIGH;
            case "warning" -> Severity.MEDIUM;
            case "info"    -> Severity.LOW;
            default        -> Severity.INFO;
        };
    }
}
