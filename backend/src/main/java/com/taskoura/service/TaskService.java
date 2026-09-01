package com.taskoura.service;

import com.taskoura.dto.TaskDtos.*;
import com.taskoura.dto.TaskStatusLogDtos.TaskStatusLogResponse;
import com.taskoura.entity.Project;
import com.taskoura.entity.Task;
import com.taskoura.entity.TaskStatusLog;
import com.taskoura.entity.User;
import com.taskoura.repository.TaskRepository;
import com.taskoura.repository.TaskStatusLogRepository;
import com.taskoura.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectService projectService;
    private final TaskStatusLogRepository taskStatusLogRepository;

    public TaskService(TaskRepository taskRepository, UserRepository userRepository,
                        ProjectService projectService, TaskStatusLogRepository taskStatusLogRepository) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectService = projectService;
        this.taskStatusLogRepository = taskStatusLogRepository;
    }

    public TaskResponse createTask(UUID projectId, CreateTaskRequest request) {
        Project project = projectService.getProjectEntityOrThrow(projectId);

        User assignee = null;
        if (request.assignedTo() != null) {
            assignee = userRepository.findById(request.assignedTo())
                    .orElseThrow(() -> new IllegalStateException("Assignee not found"));
        }

        Task task = Task.builder()
                .project(project)
                .assignedTo(assignee)
                .title(request.title())
                .description(request.description())
                .category(request.category())
                .priority(request.priority())
                .deadline(request.deadline())
                .build();

        Task saved = taskRepository.save(task);
        return toResponse(saved);
    }

    public List<TaskResponse> getTasksForProject(UUID projectId) {
        return taskRepository.findByProjectId(projectId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public TaskResponse updateStatus(UUID taskId, UpdateTaskStatusRequest request, String changedByEmail) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalStateException("Task not found"));

        User changedByUser = userRepository.findByEmail(changedByEmail)
                .orElseThrow(() -> new IllegalStateException("User not found"));

        String oldStatus = task.getStatus();
        String newStatus = request.status();

        TaskStatusLog log = TaskStatusLog.builder()
                .task(task)
                .changedBy(changedByUser)
                .fromStatus(oldStatus)
                .toStatus(newStatus)
                .build();
        taskStatusLogRepository.save(log);

        task.setStatus(newStatus);
        if ("Completed".equalsIgnoreCase(newStatus)) {
            task.setCompletedAt(LocalDateTime.now());
        }

        Task saved = taskRepository.save(task);
        return toResponse(saved);
    }

    public List<TaskStatusLogResponse> getStatusHistory(UUID taskId) {
        return taskStatusLogRepository.findByTaskIdOrderByChangedAtAsc(taskId)
                .stream()
                .map(log -> new TaskStatusLogResponse(
                        log.getId(),
                        log.getFromStatus(),
                        log.getToStatus(),
                        log.getChangedBy() != null ? log.getChangedBy().getId() : null,
                        log.getChangedBy() != null ? log.getChangedBy().getName() : null,
                        log.getChangedAt()
                ))
                .toList();
    }

    private TaskResponse toResponse(Task task) {
        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getCategory(),
                task.getPriority(),
                task.getStatus(),
                task.getAssignedTo() != null ? task.getAssignedTo().getId() : null,
                task.getDeadline(),
                task.getCompletedAt()
        );
    }
}