package com.taskoura.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "biometric_credentials", indexes = {
        @Index(name = "idx_biolock_cred_user", columnList = "user_id"),
        @Index(name = "idx_biolock_cred_device", columnList = "device_id"),
        @Index(name = "idx_biolock_cred_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BiometricCredential {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "device_id", nullable = false)
    private UUID deviceId;

    @Column(name = "sensor_slot_id", nullable = false)
    private Integer sensorSlotId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    @Builder.Default
    private CredentialStatus status = CredentialStatus.ACTIVE;

    @Column(name = "enrolled_at")
    private Instant enrolledAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "unused_since")
    private Instant unusedSince;

    public BiometricCredential(UUID userId, UUID deviceId, Integer sensorSlotId, CredentialStatus status, Instant enrolledAt) {
        this.userId = userId;
        this.deviceId = deviceId;
        this.sensorSlotId = sensorSlotId;
        this.status = status;
        this.enrolledAt = enrolledAt;
        this.createdAt = enrolledAt != null ? enrolledAt : Instant.now();
        this.updatedAt = this.createdAt;
    }
}
