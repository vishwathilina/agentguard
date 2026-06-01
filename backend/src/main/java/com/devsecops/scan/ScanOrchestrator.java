package com.devsecops.scan;

import com.devsecops.ai.AiAnalysisService;
import com.devsecops.model.*;
import com.devsecops.model.enums.*;
import com.devsecops.notification.DiscordNotificationService;
import com.devsecops.repository.*;
import com.devsecops.ws.ScanProgressEmitter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;
import org.jasypt.encryption.StringEncryptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScanOrchestrator {

    private final ScanRepository scanRepository;
    private final ScanToolRunRepository scanToolRunRepository;
    private final VulnerabilityRepository vulnerabilityRepository;
    private final UserRepository userRepository;
    private final TechDetectorService techDetectorService;
    private final AiAnalysisService aiAnalysisService;
    private final DiscordNotificationService discordNotificationService;
    private final StringEncryptor stringEncryptor;
    private final ScanProgressEmitter progress;
    private final ScanResultAggregator scanResultAggregator;
    private final List<ScanRunner> scanRunners;

    @Value("${app.scan.workspace-dir:/tmp/scan-workspace}")
    private String workspaceDir;

    @Async("scanTaskExecutor")
    @Transactional
    public void executeScanAsync(UUID scanId, UUID userId, List<String> forcedTools) {
        Path scanWorkspace = Path.of(workspaceDir, scanId.toString());
        String scanIdStr = scanId.toString();
        Scan scan = null;

        try {
            scan = scanRepository.findById(scanId)
                    .orElseThrow(() -> new IllegalStateException("Scan not found: " + scanId));
            User owner = userRepository.findById(userId)
                    .orElseThrow(() -> new IllegalStateException("User not found: " + userId));
            String githubToken = stringEncryptor.decrypt(owner.getAccessTokenEnc());

            updateScanStatus(scan, ScanStatus.RUNNING);
            progress.info(scanIdStr, "Scan started");
            Files.createDirectories(scanWorkspace);

            String target = resolveTarget(scan);

            // Clone / prepare workspace
            if (scan.getRepository().getTargetType() == TargetType.GIT_REPO) {
                progress.info(scanIdStr, "Cloning " + scan.getRepository().getGithubRepoFullName()
                        + " (branch: " + scan.getBranch() + ")…");
            }
            Path repoPath = cloneOrPrepareTarget(scan, scanWorkspace, target, githubToken);
            ScanContext scanContext = new ScanContext(
                    scanWorkspace,
                    repoPath,
                    target,
                    scan.getRepository().getTargetType()
            );

            // Tech detection
            progress.info(scanIdStr, "Detecting technology stack…");
            Set<TechStack> techStacks = techDetectorService.detect(repoPath);
            scan.setDetectedTechStacks(techStacks.stream().map(Enum::name).toList());
            scanRepository.save(scan);

            if (techStacks.isEmpty()) {
                progress.info(scanIdStr, "No specific tech stack detected — running generic scanners");
            } else {
                progress.info(scanIdStr, "Detected: " + String.join(", ", scan.getDetectedTechStacks()));
            }

            List<Vulnerability> allVulns = new ArrayList<>();

            for (ScanRunner runner : scanRunners) {
                boolean forced = !forcedTools.isEmpty() &&
                        forcedTools.contains(runner.getToolName().name());
                if (!forced && !shouldRun(runner.getToolName(), techStacks, scan)) continue;

                String toolName = runner.getToolName().name();
                progress.toolStart(scanIdStr, toolName);

                ScanToolRun toolRun = ScanToolRun.builder()
                    .scan(scan)
                    .toolName(runner.getToolName())
                    .status(ToolRunStatus.RUNNING)
                    .startedAt(LocalDateTime.now())
                    .build();
                toolRun = scanToolRunRepository.save(toolRun);

                List<Vulnerability> vulns;
                try {
                    long start = System.currentTimeMillis();
                    vulns = runner.run(toolRun, scanContext);
                    long duration = System.currentTimeMillis() - start;

                    toolRun.setDurationMs((int) duration);
                    toolRun.setStatus(ToolRunStatus.COMPLETED);
                    toolRun.setCompletedAt(LocalDateTime.now());
                    scanToolRunRepository.save(toolRun);

                    progress.toolDone(scanIdStr, toolName, vulns.size());
                } catch (Exception e) {
                    log.error("Tool {} failed for scan {}", toolName, scanIdStr, e);
                    toolRun.setStatus(ToolRunStatus.FAILED);
                    toolRun.setCompletedAt(LocalDateTime.now());
                    scanToolRunRepository.save(toolRun);
                    progress.toolError(scanIdStr, toolName, e.getMessage());
                    vulns = List.of();
                }

                for (Vulnerability v : vulns) {
                    v.setScan(scan);
                    v.setScanToolRun(toolRun);
                }
                allVulns.addAll(vulns);
            }

            allVulns = scanResultAggregator.aggregate(allVulns);
            vulnerabilityRepository.saveAll(allVulns);
            updateScanCounts(scan, allVulns);

            updateScanStatus(scan, ScanStatus.COMPLETED);
            // Pass captured vuln list so AI analysis starts after COMPLETE is sent
            notifyScanCompleteAfterCommit(scanIdStr, scan, !allVulns.isEmpty());

        } catch (Exception e) {
            log.error("Scan {} failed", scanIdStr, e);
            markScanFailed(scanId, scan);
            notifyScanFailedAfterCommit(scanIdStr, e.getMessage());
        } finally {
            deleteWorkspace(scanWorkspace);
        }
    }

    private String resolveTarget(Scan scan) {
        Repository repo = scan.getRepository();
        if (repo.getTargetType() == TargetType.GIT_REPO) {
            return "https://github.com/" + repo.getGithubRepoFullName() + ".git";
        }
        return repo.getDockerImage();
    }

    private Path cloneOrPrepareTarget(Scan scan, Path workspace, String target,
                                      String githubToken) throws Exception {
        if (scan.getRepository().getTargetType() == TargetType.GIT_REPO) {
            Path repoPath = workspace.resolve("repo");
            String branch = scan.getBranch() != null ? scan.getBranch() : "main";

            Git.cloneRepository()
                .setURI(target)
                .setDirectory(repoPath.toFile())
                .setBranch(branch)
                .setDepth(1)
                .setCredentialsProvider(
                    new UsernamePasswordCredentialsProvider("x-access-token", githubToken))
                .call()
                .close();

            log.info("Cloned {} branch={}", target, branch);
            return repoPath;
        }
        return workspace;
    }

    private boolean shouldRun(ToolName tool, Set<TechStack> stacks, Scan scan) {
        TargetType type = scan.getRepository().getTargetType();
        return switch (tool) {
            case TRIVY           -> type == TargetType.DOCKER_IMAGE || stacks.contains(TechStack.DOCKER);
            case GITLEAKS        -> type == TargetType.GIT_REPO;
            case TFSEC           -> stacks.contains(TechStack.TERRAFORM);
            case KUBE_BENCH      -> stacks.contains(TechStack.KUBERNETES);
            case NPM_AUDIT       -> stacks.contains(TechStack.NODE_JS);
            case OWASP_DEP_CHECK -> stacks.contains(TechStack.SPRING_BOOT) || stacks.contains(TechStack.GRADLE_JAVA);
            case SEMGREP         -> type == TargetType.GIT_REPO;
            case CHECKOV         -> stacks.contains(TechStack.TERRAFORM)
                                 || stacks.contains(TechStack.KUBERNETES)
                                 || stacks.contains(TechStack.DOCKER);
            case HADOLINT        -> stacks.contains(TechStack.DOCKER);
            case BANDIT          -> stacks.contains(TechStack.PYTHON);
            case OSV_SCANNER     -> stacks.contains(TechStack.NODE_JS)
                                 || stacks.contains(TechStack.PYTHON)
                                 || stacks.contains(TechStack.GO);
            case GRYPE           -> type == TargetType.DOCKER_IMAGE || stacks.contains(TechStack.DOCKER);
            case DOCKLE          -> type == TargetType.DOCKER_IMAGE;
        };
    }

    private void notifyScanCompleteAfterCommit(String scanIdStr, Scan scan, boolean queueAiAnalysis) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                // 1. Send COMPLETE WebSocket event — browser sees scan finished immediately
                progress.complete(scanIdStr, scan);

                // 2. Discord webhook notification — direct, no message broker needed
                discordNotificationService.notifyAsync(scan.getId());

                // 3. Start AI analysis in background — loads vulns from DB, not in-memory list
                if (queueAiAnalysis) {
                    log.info("Queueing AI analysis for scan {}", scanIdStr);
                    aiAnalysisService.analyzeAsync(scan.getId());
                }
            }
        });
    }

    private void notifyScanFailedAfterCommit(String scanIdStr, String reason) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                progress.failed(scanIdStr, reason);
            }
        });
    }

    private void markScanFailed(UUID scanId, Scan loadedScan) {
        Scan scan = loadedScan != null
                ? loadedScan
                : scanRepository.findById(scanId).orElse(null);
        if (scan != null) {
            updateScanStatus(scan, ScanStatus.FAILED);
        }
    }

    private void updateScanStatus(Scan scan, ScanStatus status) {
        scan.setStatus(status);
        if (status == ScanStatus.RUNNING)   scan.setStartedAt(LocalDateTime.now());
        if (status == ScanStatus.COMPLETED || status == ScanStatus.FAILED) {
            scan.setCompletedAt(LocalDateTime.now());
        }
        scanRepository.save(scan);
    }

    private void updateScanCounts(Scan scan, List<Vulnerability> vulns) {
        scan.setTotalCritical((int) vulns.stream().filter(v -> v.getSeverity() == Severity.CRITICAL).count());
        scan.setTotalHigh    ((int) vulns.stream().filter(v -> v.getSeverity() == Severity.HIGH).count());
        scan.setTotalMedium  ((int) vulns.stream().filter(v -> v.getSeverity() == Severity.MEDIUM).count());
        scan.setTotalLow     ((int) vulns.stream().filter(v -> v.getSeverity() == Severity.LOW).count());
        scan.setTotalInfo    ((int) vulns.stream().filter(v -> v.getSeverity() == Severity.INFO).count());

        int w = scan.getTotalCritical() * 10 + scan.getTotalHigh() * 5
              + scan.getTotalMedium() * 2 + scan.getTotalLow();
        scan.setSecurityScore(Math.max(0, 100 - Math.min(w, 100)));
        scanRepository.save(scan);
    }

    private void deleteWorkspace(Path path) {
        try {
            if (Files.exists(path)) {
                Files.walk(path)
                    .sorted(Comparator.reverseOrder())
                    .forEach(p -> p.toFile().delete());
            }
        } catch (Exception e) {
            log.warn("Failed to clean workspace: {}", path);
        }
    }
}
