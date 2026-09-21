package com.taskoura.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class BugDtos {

    public record CreateBugRequest(
            String severity,
            String description,
            UUID assignedTo
    ) {}

    public record BugResponse(
            UUID id,
            UUID taskId,
            String severity,
            String status,
            UUID reportedBy,
            UUID assignedTo,
            LocalDateTime createdAt,
            LocalDateTime resolvedAt
    ) {}
}
