package com.taskoura.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public class TaskDtos {

    public record UserSummary(UUID id, String name) {}

    public record CreateTaskRequest(
            String title,
            String description,
            String category,
            String priority,
            UUID assignedTo,
            LocalDate deadline
    ) {}

    public record UpdateTaskStatusRequest(String status) {}

    public record UpdateTaskRequest(
            String title,
            String description,
            String category,
            String priority,
            UUID assignedTo,
            LocalDate deadline
    ) {}

    public record TaskResponse(
            UUID id,
            String title,
            String description,
            String category,
            String priority,
            String status,
            UUID assignedTo,
            LocalDate deadline,
            LocalDateTime completedAt,
            UUID parentTaskId,
            int subtaskCount,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            UserSummary createdBy,
            UserSummary updatedBy
    ) {
        public TaskResponse(UUID id, String title, String category, String priority,
                            String status, UUID assignedTo, LocalDate deadline, LocalDateTime completedAt) {
            this(id, title, null, category, priority, status, assignedTo, deadline, completedAt, null, 0, null, null, null, null);
        }

        public TaskResponse(UUID id, String title, String category, String priority,
                            String status, UUID assignedTo, LocalDate deadline, LocalDateTime completedAt,
                            UUID parentTaskId, int subtaskCount) {
            this(id, title, null, category, priority, status, assignedTo, deadline, completedAt, parentTaskId, subtaskCount, null, null, null, null);
        }
    }
}