package com.devsecops.api;

import com.devsecops.model.NotificationConfig;
import com.devsecops.model.User;
import com.devsecops.model.enums.Severity;
import com.devsecops.repository.NotificationConfigRepository;
import com.devsecops.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jasypt.encryption.StringEncryptor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final NotificationConfigRepository notificationConfigRepository;
    private final UserRepository userRepository;
    private final StringEncryptor stringEncryptor;
    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    // ── GET /api/settings/me ────────────────────────────────────────────────
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(Map.of(
            "id",        user.getId(),
            "login",     user.getLogin(),
            "name",      user.getName() != null ? user.getName() : "",
            "email",     user.getEmail() != null ? user.getEmail() : "",
            "avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : "",
            "createdAt", user.getCreatedAt(),
            "lastLoginAt", user.getLastLoginAt()
        ));
    }

    // ── GET /api/settings/notifications ────────────────────────────────────
    @GetMapping("/notifications")
    public ResponseEntity<List<NotificationDto>> listNotifications(@AuthenticationPrincipal User user) {
        var configs = notificationConfigRepository.findByUserId(user.getId());
        var dtos = configs.stream().map(c -> new NotificationDto(
            c.getId().toString(),
            c.getChannelType(),
            maskWebhook(stringEncryptor.decrypt(c.getWebhookUrlEnc())),
            c.getMinSeverity().name(),
            c.isEnabled()
        )).toList();
        return ResponseEntity.ok(dtos);
    }

    // ── POST /api/settings/notifications ───────────────────────────────────
    @PostMapping("/notifications")
    public ResponseEntity<NotificationDto> saveNotification(
            @AuthenticationPrincipal User user,
            @RequestBody SaveNotificationRequest req) {

        String webhookUrl = req.webhookUrl().trim();
        if (!webhookUrl.startsWith("https://discord.com/api/webhooks/") &&
            !webhookUrl.startsWith("https://discordapp.com/api/webhooks/")) {
            return ResponseEntity.badRequest().build();
        }

        Severity severity = Severity.HIGH;
        try { severity = Severity.valueOf(req.minSeverity()); } catch (Exception ignored) {}

        NotificationConfig config;
        var existing = notificationConfigRepository.findByUserId(user.getId())
            .stream().filter(c -> "DISCORD".equals(c.getChannelType())).findFirst();

        if (existing.isPresent()) {
            config = existing.get();
            config.setWebhookUrlEnc(stringEncryptor.encrypt(webhookUrl));
            config.setMinSeverity(severity);
            config.setEnabled(req.enabled());
        } else {
            config = NotificationConfig.builder()
                .user(user)
                .channelType("DISCORD")
                .webhookUrlEnc(stringEncryptor.encrypt(webhookUrl))
                .minSeverity(severity)
                .enabled(req.enabled())
                .build();
        }
        notificationConfigRepository.save(config);

        return ResponseEntity.ok(new NotificationDto(
            config.getId().toString(),
            config.getChannelType(),
            maskWebhook(webhookUrl),
            config.getMinSeverity().name(),
            config.isEnabled()
        ));
    }

    // ── DELETE /api/settings/notifications/{id} ─────────────────────────────
    @DeleteMapping("/notifications/{id}")
    @Transactional
    public ResponseEntity<Void> deleteNotification(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        int deleted = notificationConfigRepository.deleteByIdAndUserId(id, user.getId());
        log.info("Deleted {} notification config(s) for id={} user={}", deleted, id, user.getId());
        if (deleted == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }

    // ── POST /api/settings/notifications/test ───────────────────────────────
    @PostMapping("/notifications/test")
    public ResponseEntity<Map<String, Object>> testWebhook(
            @AuthenticationPrincipal User user) {
        var configs = notificationConfigRepository.findByUserId(user.getId())
            .stream().filter(c -> "DISCORD".equals(c.getChannelType())).findFirst();

        if (configs.isEmpty()) {
            return ResponseEntity.badRequest()
                .body(Map.of("success", false, "message", "No Discord webhook configured"));
        }

        String webhookUrl;
        try {
            webhookUrl = stringEncryptor.decrypt(configs.get().getWebhookUrlEnc());
        } catch (Exception e) {
            log.error("Failed to decrypt webhook URL: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                .body(Map.of("success", false, "message", "Failed to decrypt webhook URL"));
        }

        try {
            var payload = Map.of(
                "embeds", List.of(Map.of(
                    "title",       "AgentGuard — Test Notification",
                    "description", "Your Discord webhook is configured correctly. You will receive security alerts here when scans find vulnerabilities.",
                    "color",       0x6366f1,
                    "fields",      List.of(
                        Map.of("name", "Status", "value", "Connected", "inline", true)
                    )
                ))
            );
            String payloadJson = objectMapper.writeValueAsString(payload);
            webClientBuilder.build()
                .post()
                .uri(webhookUrl)
                .header("Content-Type", "application/json")
                .bodyValue(payloadJson)
                .retrieve()
                .toBodilessEntity()
                .block(Duration.ofSeconds(10));
            log.info("Test webhook sent successfully for user {}", user.getId());
            return ResponseEntity.ok(Map.of("success", true, "message", "Test message sent to Discord"));
        } catch (Exception e) {
            log.error("Test webhook failed for user {}: {}", user.getId(), e.getMessage());
            return ResponseEntity.internalServerError()
                .body(Map.of("success", false, "message", "Webhook call failed: " + e.getMessage()));
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────
    private String maskWebhook(String url) {
        if (url == null || url.length() < 20) return "***";
        return url.substring(0, 36) + "…***";
    }

    // ── DTOs ────────────────────────────────────────────────────────────────
    public record NotificationDto(
        String id,
        String channelType,
        String webhookUrlMasked,
        String minSeverity,
        boolean enabled
    ) {}

    public record SaveNotificationRequest(
        String webhookUrl,
        String minSeverity,
        boolean enabled
    ) {}
}
