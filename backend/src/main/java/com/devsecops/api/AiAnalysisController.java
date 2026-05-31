package com.devsecops.api;

import com.devsecops.ai.AiAnalysisService;
import com.devsecops.ai.VulnerabilityAnalysisAI;
import com.devsecops.model.AiAnalysis;
import com.devsecops.model.Scan;
import com.devsecops.model.User;
import com.devsecops.model.Vulnerability;
import com.devsecops.model.enums.ScanStatus;
import com.devsecops.repository.AiAnalysisRepository;
import com.devsecops.repository.ScanRepository;
import com.devsecops.repository.VulnerabilityRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/scans/{scanId}")
@RequiredArgsConstructor
public class AiAnalysisController {

    private final AiAnalysisRepository aiAnalysisRepository;
    private final AiAnalysisService aiAnalysisService;
    private final VulnerabilityAnalysisAI vulnerabilityAnalysisAI;
    private final ScanRepository scanRepository;
    private final VulnerabilityRepository vulnerabilityRepository;

    @GetMapping("/ai-analysis")
    public ResponseEntity<AiAnalysis> get(@PathVariable UUID scanId,
                                          @AuthenticationPrincipal User user) {
        boolean owns = scanRepository.findById(scanId)
            .map(s -> s.getUser().getId().equals(user.getId()))
            .orElse(false);
        if (!owns) return ResponseEntity.notFound().build();

        return aiAnalysisRepository.findByScanId(scanId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.noContent().build());
    }

    /**
     * On-demand per-vulnerability AI explanation.
     * Returns cached explanation if already stored, otherwise calls the AI model.
     */
    @GetMapping("/vulnerabilities/{vulnId}/explain")
    public ResponseEntity<Map<String, String>> explain(
            @PathVariable UUID scanId,
            @PathVariable UUID vulnId,
            @AuthenticationPrincipal User user) {

        boolean owns = scanRepository.findById(scanId)
            .map(s -> s.getUser().getId().equals(user.getId()))
            .orElse(false);
        if (!owns) return ResponseEntity.notFound().build();

        Vulnerability vuln = vulnerabilityRepository.findById(vulnId).orElse(null);
        if (vuln == null) return ResponseEntity.notFound().build();

        // Return cached explanation if available
        if (vuln.getAiExplanation() != null && !vuln.getAiExplanation().isBlank()) {
            return ResponseEntity.ok(Map.of(
                "explanation", vuln.getAiExplanation(),
                "remediation", vuln.getAiRemediation() != null ? vuln.getAiRemediation() : ""
            ));
        }

        // Call AI on demand
        try {
            String raw = vulnerabilityAnalysisAI.explainVulnerability(
                vuln.getCveId()             != null ? vuln.getCveId()             : "N/A",
                vuln.getTitle(),
                vuln.getAffectedComponent() != null ? vuln.getAffectedComponent() : "N/A",
                vuln.getAffectedVersion()   != null ? vuln.getAffectedVersion()   : "N/A",
                vuln.getFixedVersion()      != null ? vuln.getFixedVersion()       : "N/A",
                vuln.getCvssScore()         != null ? vuln.getCvssScore().toString() : "N/A",
                vuln.getDescription()       != null ? vuln.getDescription()        : ""
            );

            String[] halves = splitExplanationRemediation(raw);
            vuln.setAiExplanation(halves[0]);
            vuln.setAiRemediation(halves[1]);
            vulnerabilityRepository.save(vuln);

            return ResponseEntity.ok(Map.of(
                "explanation", halves[0],
                "remediation", halves[1]
            ));
        } catch (Exception e) {
            log.error("On-demand explain failed for vuln {}: {}", vulnId, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Retry AI analysis for a completed scan that has no analysis yet
     * (or force a fresh analysis if one already exists).
     */
    @PostMapping("/ai-analysis/retry")
    public ResponseEntity<Map<String, String>> retryAnalysis(
            @PathVariable UUID scanId,
            @AuthenticationPrincipal User user) {

        Scan scan = scanRepository.findById(scanId)
            .filter(s -> s.getUser().getId().equals(user.getId()))
            .orElse(null);

        if (scan == null) return ResponseEntity.notFound().build();
        if (scan.getStatus() != ScanStatus.COMPLETED) {
            return ResponseEntity.badRequest().body(
                Map.of("error", "Scan is not in COMPLETED state"));
        }

        // Delete existing analysis so analyzeAsync can create a fresh one
        aiAnalysisRepository.findByScanId(scanId).ifPresent(aiAnalysisRepository::delete);

        int totalFindings = scan.getTotalCritical() + scan.getTotalHigh() + scan.getTotalMedium()
            + scan.getTotalLow() + scan.getTotalInfo();
        if (totalFindings == 0) {
            return ResponseEntity.badRequest().body(
                Map.of("error", "No vulnerabilities to analyze"));
        }

        aiAnalysisService.analyzeAsync(scanId);

        return ResponseEntity.accepted().body(
            Map.of("message", "AI analysis queued — check back in a moment"));
    }

    private String[] splitExplanationRemediation(String raw) {
        if (raw == null || raw.isBlank()) return new String[]{"", ""};
        String[] paragraphs = raw.split("\n\n", 2);
        if (paragraphs.length == 2) return new String[]{paragraphs[0].trim(), paragraphs[1].trim()};
        int mid = raw.length() / 2;
        int nl  = raw.indexOf('\n', mid);
        return nl > 0
            ? new String[]{raw.substring(0, nl).trim(), raw.substring(nl).trim()}
            : new String[]{raw.trim(), ""};
    }
}
