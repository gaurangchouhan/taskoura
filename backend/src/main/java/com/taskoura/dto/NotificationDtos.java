package com.taskoura.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class NotificationDtos {

    public record NotificationResponse(
            UUID id,
            String message,
            boolean isRead,
            LocalDateTime createdAt
    ) {}

    public record ActivityLogResponse(
            UUID id,
            UUID projectId,
            UUID userId,
            String userName,
            String actionType,
            String description,
            LocalDateTime createdAt
    ) {}
}
