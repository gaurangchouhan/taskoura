package com.taskoura.service;

import com.taskoura.dto.TaskDtos.*;
import com.taskoura.dto.TaskStatusLogDtos.TaskStatusLogResponse;
import com.taskoura.entity.Project;
import com.taskoura.entity.Task;
import com.taskoura.entity.TaskStatusLog;
import com.taskoura.entity.User;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.TaskRepository;
import com.taskoura.repository.TaskStatusLogRepository;
import com.taskoura.repository.UserRepository;
import com.taskoura.validation.TaskValidation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectService projectService;
    private final TaskStatusLogRepository taskStatusLogRepository;
    private final NotificationService notificationService;
    private final ProjectAccessService projectAccessService;
    private final EmailService emailService;

    public TaskService(TaskRepository taskRepository, UserRepository userRepository,
                       ProjectService projectService, TaskStatusLogRepository taskStatusLogRepository,
                       NotificationService notificationService, ProjectAccessService projectAccessService,
                       @Autowired(required = false) EmailService emailService) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectService = projectService;
        this.taskStatusLogRepository = taskStatusLogRepository;
        this.notificationService = notificationService;
        this.projectAccessService = projectAccessService;
        this.emailService = emailService;
    }

    public TaskResponse createTask(UUID projectId, CreateTaskRequest request) {
        return createTask(projectId, request, null);
    }

    @Transactional
    public TaskResponse createTask(UUID projectId, CreateTaskRequest request, String creatorEmail) {
        Project project = projectService.getProjectEntityOrThrow(projectId);

        User assignee = null;
        if (request.assignedTo() != null) {
            assignee = userRepository.findById(request.assignedTo())
                    .orElseThrow(() -> new NotFoundException("Assignee not found"));
        }

        User creator = null;
        if (creatorEmail != null && !creatorEmail.isBlank()) {
            creator = userRepository.findByEmail(creatorEmail).orElse(null);
        }

        Task task = Task.builder()
                .project(project)
                .assignedTo(assignee)
                .createdBy(creator)
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
            if (emailService != null) {
                emailService.sendTaskAssignedEmail(assignee, saved.getTitle(), project.getName(), project.getId(), saved.getId(), saved.getPriority(), saved.getDeadline());
            }
        }

        // Log TASK_CREATED activity
        User activityActor = creator != null ? creator : project.getOwner();
        notificationService.logActivity(project, activityActor,
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
    public TaskResponse updateTask(UUID taskId, UpdateTaskRequest request, String actorEmail) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found"));

        User actor = userRepository.findByEmail(actorEmail)
                .orElseThrow(() -> new NotFoundException("User not found"));

        Project project = task.getProject();

        User newAssignee = null;
        boolean isAssigneeMember = true;
        if (request != null && request.assignedTo() != null) {
            Optional<User> assigneeOpt = userRepository.findById(request.assignedTo());
            if (assigneeOpt.isEmpty()) {
                isAssigneeMember = false;
            } else {
                newAssignee = assigneeOpt.get();
                String role = projectAccessService.findRole(project.getId(), newAssignee.getEmail()).orElse(null);
                if (role == null) {
                    isAssigneeMember = false;
                }
            }
        }

        TaskValidation.validateUpdate(request, isAssigneeMember);

        String newTitle = request.title().trim();
        String newDescription = request.description();
        String newCategory = request.category();
        String newPriority = request.priority();
        LocalDate newDeadline = request.deadline();
        UUID currentAssigneeId = task.getAssignedTo() != null ? task.getAssignedTo().getId() : null;
        UUID newAssigneeId = newAssignee != null ? newAssignee.getId() : null;

        boolean titleChanged = !Objects.equals(task.getTitle(), newTitle);
        boolean descChanged = !Objects.equals(task.getDescription(), newDescription);
        boolean categoryChanged = !Objects.equals(task.getCategory(), newCategory);
        boolean priorityChanged = !Objects.equals(task.getPriority(), newPriority);
        boolean assigneeChanged = !Objects.equals(currentAssigneeId, newAssigneeId);
        boolean deadlineChanged = !Objects.equals(task.getDeadline(), newDeadline);

        boolean hasChanged = titleChanged || descChanged || categoryChanged || priorityChanged || assigneeChanged || deadlineChanged;

        if (!hasChanged) {
            return toResponse(task);
        }

        task.setTitle(newTitle);
        task.setDescription(newDescription);
        task.setCategory(newCategory);
        task.setPriority(newPriority);
        task.setAssignedTo(newAssignee);
        task.setDeadline(newDeadline);
        task.setUpdatedAt(LocalDateTime.now());
        task.setUpdatedBy(actor);

        Task saved = taskRepository.save(task);

        if (assigneeChanged && newAssignee != null && !newAssignee.getId().equals(actor.getId())) {
            notificationService.createNotification(newAssignee,
                    "You have been assigned to task: \"" + saved.getTitle() + "\"");
            if (emailService != null) {
                emailService.sendTaskAssignedEmail(newAssignee, saved.getTitle(), project.getName(), project.getId(), saved.getId(), saved.getPriority(), saved.getDeadline());
            }
        }

        notificationService.logActivity(project, actor, "TASK_UPDATED",
                actor.getName() + " edited task '" + saved.getTitle() + "'");

        return toResponse(saved);
    }

    @Transactional
    public void deleteTask(UUID taskId, String actorEmail) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found"));

        User actor = userRepository.findByEmail(actorEmail)
                .orElseThrow(() -> new NotFoundException("User not found"));

        Project project = task.getProject();
        String role = projectAccessService.findRole(project.getId(), actorEmail).orElse(null);

        boolean isOwner = "Owner".equalsIgnoreCase(role);
        boolean isCreator = task.getCreatedBy() != null && task.getCreatedBy().getId().equals(actor.getId());

        if (!isOwner && !isCreator) {
            throw new ForbiddenException("Only the project owner or the task creator can delete this task");
        }

        List<Task> subtasks = taskRepository.findByParentTaskId(task.getId());
        for (Task subtask : subtasks) {
            subtask.setDeletedBy(actor);
            subtask.setDeletedAt(LocalDateTime.now());
            taskRepository.delete(subtask);
        }

        task.setDeletedBy(actor);
        task.setDeletedAt(LocalDateTime.now());
        taskRepository.delete(task);

        notificationService.logActivity(project, actor, "TASK_DELETED",
                actor.getName() + " deleted task '" + task.getTitle() + "'");
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

        // Status-change notification (Module 15):
        // Skip if the person who changed the status IS the assignee.
        if (task.getAssignedTo() != null && !task.getAssignedTo().getId().equals(changedByUser.getId())) {
            notificationService.createNotification(task.getAssignedTo(),
                    "Task '" + task.getTitle() + "' status changed from " + oldStatus + " to " + newStatus + ".");
            if (emailService != null) {
                emailService.sendTaskStatusChangedEmail(task.getAssignedTo(), task.getTitle(), task.getProject().getName(), task.getProject().getId(), task.getId(), changedByUser.getName(), oldStatus, newStatus);
            }
        }

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
        if (emailService != null) {
            emailService.sendTaskAssignedEmail(newAssignee, task.getTitle(), task.getProject().getName(), task.getProject().getId(), task.getId(), task.getPriority(), task.getDeadline());
        }

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

    public TaskResponse createSubtask(UUID parentTaskId, CreateTaskRequest request) {
        return createSubtask(parentTaskId, request, null);
    }

    @Transactional
    public TaskResponse createSubtask(UUID parentTaskId, CreateTaskRequest request, String creatorEmail) {
        Task parentTask = taskRepository.findById(parentTaskId)
                .orElseThrow(() -> new NotFoundException("Parent task not found"));

        if (parentTask.getParentTask() != null) {
            throw new BadRequestException("Subtasks cannot have nested subtasks (maximum 1 level of nesting allowed)");
        }

        Project project = parentTask.getProject();

        User assignee = null;
        if (request.assignedTo() != null) {
            assignee = userRepository.findById(request.assignedTo())
                    .orElseThrow(() -> new NotFoundException("Assignee not found"));
        }

        User creator = null;
        if (creatorEmail != null && !creatorEmail.isBlank()) {
            creator = userRepository.findByEmail(creatorEmail).orElse(null);
        }

        Task subtask = Task.builder()
                .project(project)
                .parentTask(parentTask)
                .assignedTo(assignee)
                .createdBy(creator)
                .title(request.title())
                .description(request.description())
                .category(request.category())
                .priority(request.priority())
                .status("Backlog")
                .deadline(request.deadline())
                .build();

        Task saved = taskRepository.save(subtask);

        if (assignee != null) {
            notificationService.createNotification(assignee,
                    "You have been assigned to subtask: \"" + saved.getTitle() + "\"");
        }

        User activityActor = creator != null ? creator : project.getOwner();
        notificationService.logActivity(project, activityActor,
                "SUBTASK_CREATED",
                "Subtask \"" + saved.getTitle() + "\" was created under parent task \"" + parentTask.getTitle() + "\"");

        return toResponse(saved);
    }

    public List<TaskResponse> getSubtasks(UUID parentTaskId) {
        if (!taskRepository.existsById(parentTaskId)) {
            throw new NotFoundException("Parent task not found");
        }

        return taskRepository.findByParentTaskIdOrderByCreatedAtAsc(parentTaskId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public TaskResponse getTaskById(UUID taskId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found"));
        return toResponse(task);
    }

    private TaskResponse toResponse(Task task) {
        int subtaskCount = (task.getId() != null) ? taskRepository.countByParentTaskId(task.getId()) : 0;
        UserSummary createdBySummary = task.getCreatedBy() != null
                ? new UserSummary(task.getCreatedBy().getId(), task.getCreatedBy().getName())
                : null;
        UserSummary updatedBySummary = task.getUpdatedBy() != null
                ? new UserSummary(task.getUpdatedBy().getId(), task.getUpdatedBy().getName())
                : null;

        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getCategory(),
                task.getPriority(),
                task.getStatus(),
                task.getAssignedTo() != null ? task.getAssignedTo().getId() : null,
                task.getDeadline(),
                task.getCompletedAt(),
                task.getParentTask() != null ? task.getParentTask().getId() : null,
                subtaskCount,
                task.getCreatedAt(),
                task.getUpdatedAt(),
                createdBySummary,
                updatedBySummary
        );
    }
}