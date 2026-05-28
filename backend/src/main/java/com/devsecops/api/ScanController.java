package com.devsecops.api;

import com.devsecops.model.Scan;
import com.devsecops.model.ScanToolRun;
import com.devsecops.model.User;
import com.devsecops.repository.ScanRepository;
import com.devsecops.repository.ScanToolRunRepository;
import com.devsecops.scan.ScanService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/scans")
@RequiredArgsConstructor
public class ScanController {

    private final ScanService scanService;
    private final ScanRepository scanRepository;
    private final ScanToolRunRepository scanToolRunRepository;

    @GetMapping
    public ResponseEntity<Page<Scan>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(
            scanRepository.findByUserIdOrderByCreatedAtDesc(user.getId(), PageRequest.of(page, size))
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<Scan> get(@PathVariable UUID id,
                                    @AuthenticationPrincipal User user) {
        return scanRepository.findById(id)
            .filter(s -> s.getUser().getId().equals(user.getId()))
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/tool-runs")
    public ResponseEntity<List<ScanToolRun>> toolRuns(@PathVariable UUID id,
                                                      @AuthenticationPrincipal User user) {
        return scanRepository.findById(id)
            .filter(s -> s.getUser().getId().equals(user.getId()))
            .map(s -> ResponseEntity.ok(scanToolRunRepository.findByScanId(id)))
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Scan> trigger(@Valid @RequestBody TriggerScanRequest req,
                                        @AuthenticationPrincipal User user) {
        Scan scan = scanService.triggerScan(user, req.repositoryId(), req.branch(), req.forcedTools());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(scan);
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<Void> cancel(@PathVariable UUID id,
                                       @AuthenticationPrincipal User user) {
        scanService.cancelScan(id, user);
        return ResponseEntity.noContent().build();
    }

    public record TriggerScanRequest(
        @NotNull UUID repositoryId,
        String branch,
        List<String> forcedTools
    ) {}
}
