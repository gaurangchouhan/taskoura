package com.taskoura.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class CommentDtos {

    public record CreateCommentRequest(String content) {}

    public record CommentResponse(
            UUID id,
            UUID taskId,
            UUID userId,
            String userName,
            String content,
            LocalDateTime createdAt,
            java.util.List<UUID> mentionedUserIds
    ) {
        public CommentResponse(UUID id, UUID taskId, UUID userId, String userName,
                               String content, LocalDateTime createdAt) {
            this(id, taskId, userId, userName, content, createdAt, java.util.List.of());
        }
    }
}