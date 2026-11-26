package com.taskoura.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class AttachmentDtos {

    public record AttachmentResponse(
            UUID id,
            UUID taskId,
            UUID uploadedBy,
            String uploadedByName,
            String fileUrl,
            String fileType,
            String fileName,
            LocalDateTime uploadedAt,
            boolean restricted,
            boolean locked
    ) {
        public AttachmentResponse(
                UUID id,
                UUID taskId,
                UUID uploadedBy,
                String uploadedByName,
                String fileUrl,
                String fileType,
                String fileName,
                LocalDateTime uploadedAt,
                boolean restricted
        ) {
            this(id, taskId, uploadedBy, uploadedByName, fileUrl, fileType, fileName, uploadedAt, restricted, restricted);
        }

        public AttachmentResponse(
                UUID id,
                UUID taskId,
                UUID uploadedBy,
                String uploadedByName,
                String fileUrl,
                String fileType,
                String fileName,
                LocalDateTime uploadedAt
        ) {
            this(id, taskId, uploadedBy, uploadedByName, fileUrl, fileType, fileName, uploadedAt, false, false);
        }
    }

    public record RestrictDocumentRequest(boolean restricted) {}

    public record DocumentAccessRequestResponse(
            UUID requestId,
            String status,
            String expiresAt,
            Long secondsRemaining,
            String deviceName,
            boolean leaderNotified,
            boolean deviceOnline
    ) {
        public DocumentAccessRequestResponse(UUID requestId, String status, String expiresAt, boolean leaderNotified, boolean deviceOnline) {
            this(requestId, status, expiresAt, null, null, leaderNotified, deviceOnline);
        }
    }

    public record DocumentAccessStateResponse(
            String state,
            UUID requestId,
            String requestExpiresAt,
            Long secondsRemaining,
            String accessExpiresAt,
            String failureReason,
            boolean deviceOnline
    ) {
        public DocumentAccessStateResponse(String state, UUID requestId, String requestExpiresAt, String accessExpiresAt, boolean deviceOnline) {
            this(state, requestId, requestExpiresAt, null, accessExpiresAt, null, deviceOnline);
        }

        public DocumentAccessStateResponse(String state, UUID requestId, String requestExpiresAt, Long secondsRemaining, String accessExpiresAt, String failureReason) {
            this(state, requestId, requestExpiresAt, secondsRemaining, accessExpiresAt, failureReason, true);
        }
    }
}
