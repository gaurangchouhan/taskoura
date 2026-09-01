package com.taskoura.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class TaskStatusLogDtos {

    public record TaskStatusLogResponse(
            UUID id,
            String fromStatus,
            String toStatus,
            UUID changedByUserId,
            String changedByName,
            LocalDateTime changedAt
    ) {}
}