package com.devsecops.scan;

import com.devsecops.model.*;
import com.devsecops.model.enums.ScanStatus;
import com.devsecops.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScanService {

    private final ScanRepository scanRepository;
    private final RepositoryRepository repositoryRepository;
    private final ScanOrchestrator scanOrchestrator;

    @Transactional
    public Scan triggerScan(User user, UUID repositoryId, String branch, java.util.List<String> forcedTools) {
        Repository repo = repositoryRepository.findById(repositoryId)
            .filter(r -> r.getUser().getId().equals(user.getId()))
            .orElseThrow(() -> new IllegalArgumentException("Repository not found or access denied"));

        Scan scan = Scan.builder()
            .repository(repo)
            .user(user)
            .status(ScanStatus.QUEUED)
            .branch(branch != null ? branch : repo.getDefaultBranch())
            .build();

        scan = scanRepository.save(scan);
        log.info("Scan {} queued for repo {}", scan.getId(), repo.getGithubRepoFullName());

        final UUID scanId = scan.getId();
        final UUID ownerId = user.getId();
        final List<String> tools = forcedTools != null ? forcedTools : List.of();

        // Async worker must start after this transaction commits, otherwise findById fails.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                scanOrchestrator.executeScanAsync(scanId, ownerId, tools);
            }
        });

        return scan;
    }

    @Transactional
    public void cancelScan(UUID scanId, User user) {
        scanRepository.findById(scanId)
            .filter(s -> s.getUser().getId().equals(user.getId()))
            .filter(s -> s.getStatus() == ScanStatus.QUEUED || s.getStatus() == ScanStatus.RUNNING)
            .ifPresent(s -> {
                s.setStatus(ScanStatus.CANCELLED);
                scanRepository.save(s);
                log.info("Scan {} cancelled by user {}", scanId, user.getLogin());
            });
    }
}
