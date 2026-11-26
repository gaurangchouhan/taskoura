package com.taskoura.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "biolock_jobs", indexes = {
        @Index(name = "idx_biolock_jobs_device", columnList = "device_id"),
        @Index(name = "idx_biolock_jobs_status", columnList = "status"),
        @Index(name = "idx_biolock_jobs_expires_at", columnList = "expires_at"),
        @Index(name = "idx_biolock_jobs_lease_until", columnList = "lease_until")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BiolockJob {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private JobType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    @Builder.Default
    private JobStatus status = JobStatus.QUEUED;

    @Column(name = "device_id", nullable = false)
    private UUID deviceId;

    @Column(name = "credential_id")
    private UUID credentialId;

    @Column(name = "access_request_id")
    private UUID accessRequestId;

    @Column(name = "slot")
    private Integer slot;

    @Column(nullable = false, length = 128)
    private String challenge;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "claimed_at")
    private Instant claimedAt;

    @Column(name = "lease_until")
    private Instant leaseUntil;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(length = 64)
    private String outcome;

    @Column(length = 500)
    private String reason;
}
