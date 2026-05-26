package com.devsecops.model;

import com.devsecops.model.enums.ScanStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Type;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Entity
@Table(name = "scans")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Scan {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "repository_id", nullable = false)
    private Repository repository;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private ScanStatus status = ScanStatus.QUEUED;

    @Column(name = "commit_sha")
    private String commitSha;

    @Column(name = "branch")
    private String branch;

    @Type(JsonBinaryType.class)
    @Column(name = "detected_tech_stacks", columnDefinition = "jsonb")
    @Builder.Default
    private List<String> detectedTechStacks = new ArrayList<>();

    @Column(name = "total_critical")
    @Builder.Default
    private int totalCritical = 0;

    @Column(name = "total_high")
    @Builder.Default
    private int totalHigh = 0;

    @Column(name = "total_medium")
    @Builder.Default
    private int totalMedium = 0;

    @Column(name = "total_low")
    @Builder.Default
    private int totalLow = 0;

    @Column(name = "total_info")
    @Builder.Default
    private int totalInfo = 0;

    @Column(name = "security_score")
    private Integer securityScore;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
