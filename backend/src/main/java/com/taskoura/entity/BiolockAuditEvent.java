package com.taskoura.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "biolock_audit_events", indexes = {
        @Index(name = "idx_biolock_audit_project", columnList = "project_id"),
        @Index(name = "idx_biolock_audit_device", columnList = "device_id"),
        @Index(name = "idx_biolock_audit_created", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BiolockAuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false, length = 64)
    private String type;

    @Column(name = "actor_user_id")
    private UUID actorUserId;

    @Column(name = "device_id")
    private UUID deviceId;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(name = "request_id")
    private UUID requestId;

    @Column(name = "job_id")
    private UUID jobId;

    @Column(length = 1000)
    private String detail;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
