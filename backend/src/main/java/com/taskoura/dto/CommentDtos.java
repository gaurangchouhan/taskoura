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
            LocalDateTime createdAt
    ) {}
}