package com.taskoura.service;

import com.taskoura.dto.TaskDtos.*;
import com.taskoura.dto.TaskStatusLogDtos.TaskStatusLogResponse;
import com.taskoura.entity.Project;
import com.taskoura.entity.Task;
import com.taskoura.entity.TaskStatusLog;
import com.taskoura.entity.User;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.TaskRepository;
import com.taskoura.repository.TaskStatusLogRepository;
import com.taskoura.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectService projectService;
    private final TaskStatusLogRepository taskStatusLogRepository;
    private final NotificationService notificationService;

    public TaskService(TaskRepository taskRepository, UserRepository userRepository,
                       ProjectService projectService, TaskStatusLogRepository taskStatusLogRepository,
                       NotificationService notificationService) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectService = projectService;
        this.taskStatusLogRepository = taskStatusLogRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public TaskResponse createTask(UUID projectId, CreateTaskRequest request) {
        Project project = projectService.getProjectEntityOrThrow(projectId);

        User assignee = null;
        if (request.assignedTo() != null) {
            assignee = userRepository.findById(request.assignedTo())
                    .orElseThrow(() -> new NotFoundException("Assignee not found"));
        }

        Task task = Task.builder()
                .project(project)
                .assignedTo(assignee)
                .title(request.title())
                .description(request.description())
                .category(request.category())
                .priority(request.priority())
                .status("Backlog") // Always starts at Backlog
                .deadline(request.deadline())
                .build();

        Task saved = taskRepository.save(task);

        // Notify assignee when task is created with an assignment
        if (assignee != null) {
            notificationService.createNotification(assignee,
                    "You have been assigned to task: \"" + saved.getTitle() + "\"");
        }

        // Log TASK_CREATED activity
        notificationService.logActivity(project, project.getOwner(),
                "TASK_CREATED",
                "Task \"" + saved.getTitle() + "\" was created");

        return toResponse(saved);
    }

    public List<TaskResponse> getTasksForProject(UUID projectId) {
        projectService.getProjectEntityOrThrow(projectId);

        return taskRepository.findByProjectId(projectId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public TaskResponse updateStatus(UUID taskId, UpdateTaskStatusRequest request, String changedByEmail) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found"));

        User changedByUser = userRepository.findByEmail(changedByEmail)
                .orElseThrow(() -> new NotFoundException("User not found"));

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
        } else {
            task.setCompletedAt(null);
        }

        Task saved = taskRepository.save(task);

        // Log TASK_STATUS_CHANGED activity
        notificationService.logActivity(task.getProject(), changedByUser,
                "TASK_STATUS_CHANGED",
                "Task \"" + task.getTitle() + "\" status changed from " + oldStatus + " to " + newStatus);

        return toResponse(saved);
    }

    @Transactional
    public TaskResponse reassignTask(UUID taskId, UUID newAssigneeId, String actorEmail) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found"));

        User newAssignee = userRepository.findById(newAssigneeId)
                .orElseThrow(() -> new NotFoundException("Assignee not found"));

        task.setAssignedTo(newAssignee);
        Task saved = taskRepository.save(task);

        // Notify the new assignee
        notificationService.createNotification(newAssignee,
                "You have been assigned to task: \"" + task.getTitle() + "\"");

        return toResponse(saved);
    }

    public List<TaskStatusLogResponse> getStatusHistory(UUID taskId) {
        if (!taskRepository.existsById(taskId)) {
            throw new NotFoundException("Task not found");
        }

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