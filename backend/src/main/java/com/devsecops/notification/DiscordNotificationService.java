package com.devsecops.notification;

import com.devsecops.model.AiAnalysis;
import com.devsecops.model.NotificationConfig;
import com.devsecops.model.Scan;
import com.devsecops.model.Vulnerability;
import com.devsecops.model.enums.Severity;
import com.devsecops.repository.AiAnalysisRepository;
import com.devsecops.repository.NotificationConfigRepository;
import com.devsecops.repository.ScanRepository;
import com.devsecops.repository.VulnerabilityRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jasypt.encryption.StringEncryptor;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DiscordNotificationService {

    private final NotificationConfigRepository notificationConfigRepository;
    private final AiAnalysisRepository aiAnalysisRepository;
    private final ScanRepository scanRepository;
    private final VulnerabilityRepository vulnerabilityRepository;
    private final StringEncryptor stringEncryptor;
    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    /**
     * Called from ScanOrchestrator.afterCommit.
     * Runs on the dedicated AI/notification thread pool so it never blocks scan threads.
     * @Transactional keeps a Hibernate session open so lazy associations (user, repository)
     * load without LazyInitializationException.
     */
    @Async("aiTaskExecutor")
    @Transactional(readOnly = true)
    public void notifyAsync(UUID scanId) {
        log.info("Sending Discord notification for scan: {}", scanId);

        Scan scan = scanRepository.findById(scanId).orElse(null);
        if (scan == null) {
            log.warn("Scan not found for Discord notification: {}", scanId);
            return;
        }

        // Access lazy associations inside the transaction
        UUID userId    = scan.getUser().getId();
        String repoName = scan.getRepository().getGithubRepoFullName() != null
            ? scan.getRepository().getGithubRepoFullName()
            : scan.getRepository().getDockerImage();

        List<NotificationConfig> configs = notificationConfigRepository.findByUserIdAndEnabledTrue(userId);
        if (configs.isEmpty()) {
            log.debug("No active Discord configs for user {} — skipping", userId);
            return;
        }

        AiAnalysis analysis = aiAnalysisRepository.findByScanId(scanId).orElse(null);

        // Fetch top critical + high vulnerabilities for the notification body
        List<Vulnerability> topVulns = vulnerabilityRepository.findTopByScanIdAndSeverities(
            scanId,
            List.of(Severity.CRITICAL, Severity.HIGH),
            PageRequest.of(0, 10)
        );

        for (NotificationConfig config : configs) {
            if (!meetsSeverityThreshold(scan, config.getMinSeverity())) {
                log.debug("Scan {} does not meet min severity {} — skipping",
                        scanId, config.getMinSeverity());
                continue;
            }
            try {
                sendToDiscord(scan, repoName, analysis, topVulns, config);
            } catch (Exception e) {
                log.error("Discord alert failed for scan {} config {}: {}",
                        scanId, config.getId(), e.getMessage());
            }
        }
    }

    // ── Private helpers ────────────────────────────────────────────────────

    private void sendToDiscord(Scan scan, String repoName, AiAnalysis analysis,
                               List<Vulnerability> topVulns, NotificationConfig config) {
        String webhookUrl;
        try {
            webhookUrl = stringEncryptor.decrypt(config.getWebhookUrlEnc());
        } catch (Exception e) {
            log.error("Failed to decrypt webhook URL for config {}: {}", config.getId(), e.getMessage());
            return;
        }

        Map<String, Object> payload = buildDiscordPayload(scan, repoName, analysis, topVulns);
        try {
            String payloadJson = objectMapper.writeValueAsString(payload);
            webClientBuilder.build()
                .post()
                .uri(webhookUrl)
                .header("Content-Type", "application/json")
                .bodyValue(payloadJson)
                .retrieve()
                .toBodilessEntity()
                .block(Duration.ofSeconds(10));
            log.info("Discord webhook sent for scan {}", scan.getId());
        } catch (Exception e) {
            log.error("Discord webhook HTTP error for scan {}: {}", scan.getId(), e.getMessage());
        }
    }

    private Map<String, Object> buildDiscordPayload(Scan scan, String repoName,
                                                     AiAnalysis analysis,
                                                     List<Vulnerability> topVulns) {
        int color = scan.getTotalCritical() > 0 ? 0xED4245  // Discord red
                  : scan.getTotalHigh()     > 0 ? 0xE67E22  // orange
                  : scan.getTotalMedium()   > 0 ? 0xF1C40F  // yellow
                                                : 0x57F287; // green

        String score = scan.getSecurityScore() != null
            ? scan.getSecurityScore() + "/100"
            : "N/A";

        // ── Summary embed ────────────────────────────────────────────────
        String aiSummary = (analysis != null && analysis.getExecutiveSummary() != null)
            ? truncate(analysis.getExecutiveSummary(), 300)
            : null;

        // Build severity overview line
        StringBuilder desc = new StringBuilder();
        if (aiSummary != null) {
            desc.append(aiSummary).append("\n\n");
        }
        desc.append("**Severity breakdown**\n");
        if (scan.getTotalCritical() > 0) desc.append("🔴 **Critical:** ").append(scan.getTotalCritical()).append("\n");
        if (scan.getTotalHigh()     > 0) desc.append("🟠 **High:** ").append(scan.getTotalHigh()).append("\n");
        if (scan.getTotalMedium()   > 0) desc.append("🟡 **Medium:** ").append(scan.getTotalMedium()).append("\n");
        if (scan.getTotalLow()      > 0) desc.append("🟢 **Low:** ").append(scan.getTotalLow()).append("\n");

        List<Map<String, Object>> fields = new ArrayList<>();
        fields.add(Map.of("name", "Security Score", "value", "**" + score + "**", "inline", true));
        fields.add(Map.of("name", "Branch",         "value", scan.getBranch() != null ? scan.getBranch() : "main", "inline", true));

        // ── Vulnerability detail fields (top critical + high) ─────────────
        List<Vulnerability> criticals = topVulns.stream()
            .filter(v -> v.getSeverity() == Severity.CRITICAL).toList();
        List<Vulnerability> highs = topVulns.stream()
            .filter(v -> v.getSeverity() == Severity.HIGH).toList();

        if (!criticals.isEmpty()) {
            StringBuilder sb = new StringBuilder();
            for (Vulnerability v : criticals) {
                sb.append(formatVuln(v)).append("\n");
            }
            fields.add(Map.of("name", "Critical Vulnerabilities", "value", truncate(sb.toString(), 1024), "inline", false));
        }

        if (!highs.isEmpty()) {
            StringBuilder sb = new StringBuilder();
            for (Vulnerability v : highs.subList(0, Math.min(highs.size(), 5))) {
                sb.append(formatVuln(v)).append("\n");
            }
            fields.add(Map.of("name", "High Vulnerabilities", "value", truncate(sb.toString(), 1024), "inline", false));
        }

        Map<String, Object> embed = new java.util.LinkedHashMap<>();
        embed.put("title",       "Security Scan Complete — " + repoName);
        embed.put("description", truncate(desc.toString(), 2048));
        embed.put("color",       color);
        embed.put("fields",      fields);
        embed.put("footer",      Map.of("text", "AgentGuard • DevSecOps Platform"));
        embed.put("timestamp",   LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        return Map.of("embeds", List.of(embed));
    }

    /** Format one vulnerability as a compact Discord line. */
    private String formatVuln(Vulnerability v) {
        StringBuilder sb = new StringBuilder();
        // CVE or title
        if (v.getCveId() != null && !v.getCveId().isBlank()) {
            sb.append("**").append(v.getCveId()).append("**");
        } else {
            sb.append("**").append(truncate(v.getTitle(), 60)).append("**");
        }
        // Affected component
        if (v.getAffectedComponent() != null && !v.getAffectedComponent().isBlank()) {
            sb.append(" — `").append(truncate(v.getAffectedComponent(), 40)).append("`");
        }
        // Affected version → fixed version
        if (v.getAffectedVersion() != null && !v.getAffectedVersion().isBlank()) {
            sb.append(" (").append(v.getAffectedVersion());
            if (v.getFixedVersion() != null && !v.getFixedVersion().isBlank()) {
                sb.append(" → fix: ").append(v.getFixedVersion());
            }
            sb.append(")");
        }
        // CVSS score
        if (v.getCvssScore() != null) {
            sb.append(" CVSS ").append(v.getCvssScore());
        }
        // File path hint for secrets / IaC
        if (v.getFilePath() != null && !v.getFilePath().isBlank()) {
            String fp = v.getFilePath();
            if (fp.length() > 50) fp = "…" + fp.substring(fp.length() - 47);
            sb.append(" `").append(fp).append("`");
        }
        return sb.toString();
    }

    private String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() > max ? s.substring(0, max - 1) + "…" : s;
    }

    private boolean meetsSeverityThreshold(Scan scan, Severity minSeverity) {
        return switch (minSeverity) {
            case INFO     -> true;
            case LOW      -> scan.getTotalLow()    > 0 || scan.getTotalMedium()   > 0
                          || scan.getTotalHigh()   > 0 || scan.getTotalCritical() > 0;
            case MEDIUM   -> scan.getTotalMedium() > 0 || scan.getTotalHigh()    > 0
                          || scan.getTotalCritical() > 0;
            case HIGH     -> scan.getTotalHigh() > 0 || scan.getTotalCritical() > 0;
            case CRITICAL -> scan.getTotalCritical() > 0;
        };
    }
}
