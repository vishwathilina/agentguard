package com.devsecops.api;

import com.devsecops.model.Repository;
import com.devsecops.model.User;
import com.devsecops.model.enums.TargetType;
import com.devsecops.model.enums.TechStack;
import com.devsecops.repository.RepositoryRepository;
import com.devsecops.scan.TechDetectorService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;
import org.jasypt.encryption.StringEncryptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/repositories")
@RequiredArgsConstructor
public class RepositoryController {

    private final RepositoryRepository repositoryRepository;
    private final TechDetectorService  techDetectorService;
    private final StringEncryptor      stringEncryptor;

    @GetMapping
    public ResponseEntity<List<Repository>> list(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(repositoryRepository.findByUserOrderByCreatedAtDesc(user));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Repository> get(@PathVariable UUID id,
                                          @AuthenticationPrincipal User user) {
        return repositoryRepository.findById(id)
            .filter(r -> r.getUser().getId().equals(user.getId()))
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Repository> create(@Valid @RequestBody CreateRepositoryRequest req,
                                             @AuthenticationPrincipal User user) {
        Repository repo = Repository.builder()
            .user(user)
            .targetType(req.targetType())
            .githubRepoFullName(req.githubRepoFullName())
            .dockerImage(req.dockerImage())
            .defaultBranch(req.defaultBranch() != null ? req.defaultBranch() : "main")
            .build();
        return ResponseEntity.status(HttpStatus.CREATED).body(repositoryRepository.save(repo));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id,
                                       @AuthenticationPrincipal User user) {
        var found = repositoryRepository.findById(id)
            .filter(r -> r.getUser().getId().equals(user.getId()));
        if (found.isEmpty()) return ResponseEntity.notFound().build();
        repositoryRepository.delete(found.get());
        return ResponseEntity.noContent().build();
    }

    // ── Tech detection endpoint ────────────────────────────────────────────

    @PostMapping("/{id}/detect-tech")
    public ResponseEntity<DetectTechResponse> detectTech(
            @PathVariable UUID id,
            @AuthenticationPrincipal User user) {

        var repoOpt = repositoryRepository.findById(id)
                .filter(r -> r.getUser().getId().equals(user.getId()));
        if (repoOpt.isEmpty()) return ResponseEntity.notFound().build();

        Repository repo = repoOpt.get();

        if (repo.getTargetType() != TargetType.GIT_REPO) {
            // Docker image → only Trivy applies
            return ResponseEntity.ok(new DetectTechResponse(
                    List.of(),
                    List.of("TRIVY")));
        }

        Path tmpDir = null;
        try {
            String token = stringEncryptor.decrypt(user.getAccessTokenEnc());
            String cloneUrl = "https://github.com/" + repo.getGithubRepoFullName() + ".git";
            String branch   = repo.getDefaultBranch() != null ? repo.getDefaultBranch() : "main";

            tmpDir = Files.createTempDirectory("agentguard-detect-");
            Path repoPath = tmpDir.resolve("repo");

            Git.cloneRepository()
                    .setURI(cloneUrl)
                    .setDirectory(repoPath.toFile())
                    .setBranch(branch)
                    .setDepth(1)
                    .setCredentialsProvider(
                            new UsernamePasswordCredentialsProvider("x-access-token", token))
                    .call()
                    .close();

            Set<TechStack> stacks = techDetectorService.detect(repoPath);
            List<String> detected  = stacks.stream().map(Enum::name).sorted().toList();
            List<String> tools     = recommendTools(stacks);

            return ResponseEntity.ok(new DetectTechResponse(detected, tools));

        } catch (Exception e) {
            log.warn("Tech detection failed for repo {}: {}", id, e.getMessage());
            // Graceful fallback — return Gitleaks as minimum
            return ResponseEntity.ok(new DetectTechResponse(List.of(), List.of("GITLEAKS")));
        } finally {
            if (tmpDir != null) deleteDir(tmpDir);
        }
    }

    private List<String> recommendTools(Set<TechStack> stacks) {
        List<String> tools = new ArrayList<>();
        tools.add("GITLEAKS");                                  // always for git repos
        if (stacks.contains(TechStack.DOCKER))           tools.add("TRIVY");
        if (stacks.contains(TechStack.NODE_JS))          tools.add("NPM_AUDIT");
        if (stacks.contains(TechStack.TERRAFORM))        tools.add("TFSEC");
        if (stacks.contains(TechStack.KUBERNETES))       tools.add("KUBE_BENCH");
        if (stacks.contains(TechStack.SPRING_BOOT)
         || stacks.contains(TechStack.GRADLE_JAVA))      tools.add("OWASP_DEPENDENCY_CHECK");
        return tools;
    }

    private void deleteDir(Path dir) {
        try {
            Files.walkFileTree(dir, new SimpleFileVisitor<>() {
                @Override public FileVisitResult visitFile(Path f, BasicFileAttributes a) throws IOException {
                    Files.delete(f); return FileVisitResult.CONTINUE;
                }
                @Override public FileVisitResult postVisitDirectory(Path d, IOException e) throws IOException {
                    Files.delete(d); return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException e) {
            log.warn("Could not clean temp dir {}: {}", dir, e.getMessage());
        }
    }

    public record DetectTechResponse(List<String> techStacks, List<String> recommendedTools) {}

    // ── CRUD ───────────────────────────────────────────────────────────────

    public record CreateRepositoryRequest(
        @NotNull TargetType targetType,
        String githubRepoFullName,
        String dockerImage,
        String defaultBranch
    ) {}
}
