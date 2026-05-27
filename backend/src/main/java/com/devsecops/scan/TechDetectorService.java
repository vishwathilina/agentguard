package com.devsecops.scan;

import com.devsecops.model.enums.TechStack;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Stream;

@Slf4j
@Service
public class TechDetectorService {

    public Set<TechStack> detect(Path repoPath) {
        Set<TechStack> stacks = EnumSet.noneOf(TechStack.class);

        if (!Files.exists(repoPath)) {
            log.warn("Repo path does not exist: {}", repoPath);
            return stacks;
        }

        try (Stream<Path> walk = Files.walk(repoPath, 5)) {
            walk.filter(Files::isRegularFile).forEach(file -> {
                String name = file.getFileName().toString();
                String relative = repoPath.relativize(file).toString();

                if (name.equals("pom.xml")) {
                    stacks.add(TechStack.SPRING_BOOT);
                }
                if (name.equals("build.gradle") || name.equals("build.gradle.kts")) {
                    stacks.add(TechStack.GRADLE_JAVA);
                }
                if (name.equals("package.json") && !relative.contains("node_modules")) {
                    stacks.add(TechStack.NODE_JS);
                }
                if (name.equals("Dockerfile") || name.startsWith("Dockerfile.")) {
                    stacks.add(TechStack.DOCKER);
                }
                if (name.endsWith(".tf") || name.equals("terraform.tfvars")) {
                    stacks.add(TechStack.TERRAFORM);
                }
                if (name.equals("Chart.yaml") || relative.startsWith("helm/")) {
                    stacks.add(TechStack.KUBERNETES);
                }
            });
        } catch (IOException e) {
            log.error("Failed to walk repo path: {}", repoPath, e);
        }

        if (Files.isDirectory(repoPath.resolve(".github/workflows"))) {
            stacks.add(TechStack.GITHUB_ACTIONS);
        }

        log.info("Detected tech stacks: {} for path: {}", stacks, repoPath);
        return stacks;
    }
}
