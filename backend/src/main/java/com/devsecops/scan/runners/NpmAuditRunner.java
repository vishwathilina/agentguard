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

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

@Slf4j
@Component
@RequiredArgsConstructor
public class NpmAuditRunner implements ScanRunner {

    private final ObjectMapper objectMapper;

    @Override
    public ToolName getToolName() {
        return ToolName.NPM_AUDIT;
    }

    @Override
    public List<Vulnerability> run(ScanToolRun toolRun, ScanContext context) {
        List<Vulnerability> vulnerabilities = new ArrayList<>();

        try {
            Optional<Path> packageRoot = findPackageJsonRoot(context.sourceRoot());
            if (packageRoot.isEmpty()) {
                toolRun.setRawOutput("No package.json found under " + context.sourceRoot());
                return vulnerabilities;
            }

            Path rel = context.workspace().relativize(packageRoot.get());
            String workDir = "/workspace/" + rel.toString().replace('\\', '/');

            ProcessBuilder pb = new ProcessBuilder(
                "docker", "run", "--rm",
                "-v", context.workspace() + ":/workspace:ro",
                "-w", workDir,
                "node:20-alpine",
                "sh", "-c", "npm audit --json 2>/dev/null || true"
            );
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String output = new String(process.getInputStream().readAllBytes());
            process.waitFor();
            toolRun.setRawOutput(output);

            JsonNode root = objectMapper.readTree(output);
            JsonNode vulns = root.path("vulnerabilities");

            vulns.fields().forEachRemaining(entry -> {
                JsonNode v = entry.getValue();
                String name = entry.getKey();
                String severityStr = v.path("severity").asText("moderate").toUpperCase();
                Severity severity = parseSeverity(severityStr);

                String via = "";
                JsonNode viaNode = v.path("via");
                if (viaNode.isArray() && !viaNode.isEmpty()) {
                    JsonNode first = viaNode.get(0);
                    via = first.isTextual() ? first.asText() : first.path("title").asText("");
                }

                Vulnerability vuln = Vulnerability.builder()
                    .scan(toolRun.getScan())
                    .scanToolRun(toolRun)
                    .toolSource(ToolName.NPM_AUDIT.name())
                    .title("Vulnerable dependency: " + name)
                    .description(via)
                    .severity(severity)
                    .category(VulnCategory.DEPENDENCY)
                    .affectedComponent(name)
                    .affectedVersion(v.path("range").asText(null))
                    .fixedVersion(v.path("fixAvailable").isBoolean() ? null : v.path("fixAvailable").path("version").asText(null))
                    .build();

                vulnerabilities.add(vuln);
            });

        } catch (Exception e) {
            log.error("npm audit failed", e);
            toolRun.setErrorMessage(e.getMessage());
        }

        return vulnerabilities;
    }

    private Optional<Path> findPackageJsonRoot(Path root) throws IOException {
        if (!Files.isDirectory(root)) return Optional.empty();
        try (Stream<Path> walk = Files.walk(root, 5)) {
            return walk
                    .filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().equals("package.json"))
                    .filter(p -> !p.toString().contains("node_modules"))
                    .findFirst()
                    .map(Path::getParent);
        }
    }

    private Severity parseSeverity(String s) {
        return switch (s) {
            case "CRITICAL"  -> Severity.CRITICAL;
            case "HIGH"      -> Severity.HIGH;
            case "MODERATE"  -> Severity.MEDIUM;
            case "LOW"       -> Severity.LOW;
            default          -> Severity.INFO;
        };
    }
}
