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
public class OsvScannerRunner implements ScanRunner {

    private final ObjectMapper objectMapper;

    @Override
    public ToolName getToolName() {
        return ToolName.OSV_SCANNER;
    }

    @Override
    public List<Vulnerability> run(ScanToolRun toolRun, ScanContext context) {
        List<Vulnerability> vulnerabilities = new ArrayList<>();

        try {
            ProcessBuilder pb = new ProcessBuilder(
                "docker", "run", "--rm",
                "-v", context.workspace() + ":/workspace:ro",
                "ghcr.io/google/osv-scanner:latest",
                "scan", "-r", context.containerSourcePath(),
                "--format", "json"
            );
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String output = ProcessIo.readUtf8(process.getInputStream());
            process.waitFor();

            JsonNode results = objectMapper.readTree(output).path("results");
            if (!results.isArray()) return vulnerabilities;

            for (JsonNode result : results) {
                String sourcePath = result.path("source").path("path").asText(null);
                JsonNode packages = result.path("packages");
                if (!packages.isArray()) continue;

                for (JsonNode pkg : packages) {
                    String pkgName = pkg.path("package").path("name").asText("unknown");
                    String pkgVersion = pkg.path("package").path("version").asText(null);
                    JsonNode vulns = pkg.path("vulnerabilities");
                    if (!vulns.isArray()) continue;

                    for (JsonNode v : vulns) {
                        Vulnerability finding = Vulnerability.builder()
                            .scan(toolRun.getScan())
                            .scanToolRun(toolRun)
                            .toolSource(ToolName.OSV_SCANNER.name())
                            .cveId(v.path("id").asText(null))
                            .title(v.path("summary").asText(v.path("id").asText("OSV finding")))
                            .description(v.path("details").asText(null))
                            .severity(Severity.MEDIUM)
                            .category(VulnCategory.DEPENDENCY)
                            .affectedComponent(pkgName)
                            .affectedVersion(pkgVersion)
                            .filePath(sourcePath)
                            .build();

                        vulnerabilities.add(finding);
                    }
                }
            }

        } catch (Exception e) {
            log.error("OSV Scanner failed", e);
            toolRun.setErrorMessage(e.getMessage());
        }

        return vulnerabilities;
    }
}
