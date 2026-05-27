package com.devsecops.model;

import com.devsecops.model.enums.Severity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "notification_configs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class NotificationConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "channel_type", nullable = false)
    @Builder.Default
    private String channelType = "DISCORD";

    @Column(name = "webhook_url_enc", nullable = false, columnDefinition = "TEXT")
    private String webhookUrlEnc;

    @Enumerated(EnumType.STRING)
    @Column(name = "min_severity", nullable = false)
    @Builder.Default
    private Severity minSeverity = Severity.HIGH;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private boolean enabled = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
