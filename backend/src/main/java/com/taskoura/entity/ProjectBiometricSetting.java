package com.taskoura.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "project_biometric_settings", indexes = {
        @Index(name = "idx_proj_biolock_credential", columnList = "credential_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectBiometricSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "project_id", nullable = false, unique = true)
    private UUID projectId;

    @Column(name = "credential_id")
    private UUID credentialId;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    public ProjectBiometricSetting(UUID projectId, UUID credentialId, boolean enabled, Instant createdAt) {
        this.projectId = projectId;
        this.credentialId = credentialId;
        this.enabled = enabled;
        this.createdAt = createdAt != null ? createdAt : Instant.now();
    }
}
