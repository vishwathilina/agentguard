package com.devsecops.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "docker_registries")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DockerRegistry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "registry_type", nullable = false)
    private String registryType;

    @Column(name = "registry_url")
    private String registryUrl;

    @Column(name = "credentials_enc", columnDefinition = "TEXT")
    private String credentialsEnc;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
