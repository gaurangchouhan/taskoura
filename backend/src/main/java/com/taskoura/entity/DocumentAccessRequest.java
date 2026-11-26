package com.taskoura.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "document_access_requests", indexes = {
        @Index(name = "idx_doc_req_attachment", columnList = "attachment_id"),
        @Index(name = "idx_doc_req_requester", columnList = "requester_id"),
        @Index(name = "idx_doc_req_leader", columnList = "leader_id"),
        @Index(name = "idx_doc_req_status", columnList = "status"),
        @Index(name = "idx_doc_req_expires", columnList = "expires_at"),
        @Index(name = "idx_doc_req_access_expires", columnList = "access_expires_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentAccessRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "attachment_id", nullable = false)
    private UUID attachmentId;

    @Column(name = "task_id")
    private UUID taskId;

    @Column(name = "requester_id", nullable = false)
    private UUID requesterId;

    @Column(name = "leader_id", nullable = false)
    private UUID leaderId;

    @Column(name = "credential_id", nullable = false)
    private UUID credentialId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    @Builder.Default
    private AccessRequestStatus status = AccessRequestStatus.PENDING;

    @Column(name = "requested_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant requestedAt = Instant.now();

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(name = "access_expires_at")
    private Instant accessExpiresAt;

    @Column(name = "decided_by_device_id")
    private UUID decidedByDeviceId;

    @Column(name = "failure_reason", length = 500)
    private String failureReason;

    @Enumerated(EnumType.STRING)
    @Column(name = "leader_email_status", nullable = false, length = 32)
    @Builder.Default
    private LeaderEmailStatus leaderEmailStatus = LeaderEmailStatus.NOT_SENT;

    @Column(name = "leader_email_attempts", nullable = false)
    @Builder.Default
    private int leaderEmailAttempts = 0;

    @Column(name = "leader_email_sent_at")
    private Instant leaderEmailSentAt;
}
