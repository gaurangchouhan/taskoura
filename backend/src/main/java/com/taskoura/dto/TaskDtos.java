package com.taskoura.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public class TaskDtos {

    public record CreateTaskRequest(
            String title,
            String description,
            String category,
            String priority,
            UUID assignedTo,
            LocalDate deadline
    ) {}

    public record UpdateTaskStatusRequest(String status) {}

    public record TaskResponse(
            UUID id,
            String title,
            String category,
            String priority,
            String status,
            UUID assignedTo,
            LocalDate deadline,
            LocalDateTime completedAt
    ) {}
}