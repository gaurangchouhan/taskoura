package com.taskoura.controller;

import com.taskoura.dto.TaskDtos.*;
import com.taskoura.dto.TaskStatusLogDtos.TaskStatusLogResponse;
import com.taskoura.service.ProjectAccessService;
import com.taskoura.service.TaskService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
public class TaskController {

    private final TaskService taskService;
    private final ProjectAccessService projectAccessService;

    public TaskController(TaskService taskService, ProjectAccessService projectAccessService) {
        this.taskService = taskService;
        this.projectAccessService = projectAccessService;
    }

    @PostMapping("/api/projects/{projectId}/tasks")
    public ResponseEntity<TaskResponse> createTask(
            @PathVariable UUID projectId,
            @RequestBody CreateTaskRequest request,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireMember(projectId, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(taskService.createTask(projectId, request, email));
    }

    @GetMapping("/api/projects/{projectId}/tasks")
    public ResponseEntity<List<TaskResponse>> getTasks(
            @PathVariable UUID projectId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireMember(projectId, email);
        return ResponseEntity.ok(taskService.getTasksForProject(projectId));
    }

    @GetMapping("/api/tasks/{taskId}")
    public ResponseEntity<TaskResponse> getTask(
            @PathVariable UUID taskId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireTaskAccess(taskId, email);
        return ResponseEntity.ok(taskService.getTaskById(taskId));
    }

    @PutMapping("/api/tasks/{taskId}")
    public ResponseEntity<TaskResponse> updateTask(
            @PathVariable UUID taskId,
            @RequestBody UpdateTaskRequest request,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireTaskAccess(taskId, email);
        return ResponseEntity.ok(taskService.updateTask(taskId, request, email));
    }

    @DeleteMapping("/api/tasks/{taskId}")
    public ResponseEntity<Void> deleteTask(
            @PathVariable UUID taskId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        taskService.deleteTask(taskId, email);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/api/tasks/{taskId}/status")
    public ResponseEntity<TaskResponse> updateStatus(
            @PathVariable UUID taskId,
            @RequestBody UpdateTaskStatusRequest request,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireTaskAccess(taskId, email);
        return ResponseEntity.ok(taskService.updateStatus(taskId, request, email));
    }

    @GetMapping("/api/tasks/{taskId}/status-logs")
    public ResponseEntity<List<TaskStatusLogResponse>> getStatusLogs(
            @PathVariable UUID taskId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireTaskAccess(taskId, email);
        return ResponseEntity.ok(taskService.getStatusHistory(taskId));
    }

    @PatchMapping("/api/tasks/{taskId}/assign")
    public ResponseEntity<TaskResponse> reassignTask(
            @PathVariable UUID taskId,
            @RequestParam UUID assigneeId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireTaskAccess(taskId, email);
        return ResponseEntity.ok(taskService.reassignTask(taskId, assigneeId, email));
    }

    @PostMapping("/api/tasks/{parentTaskId}/subtasks")
    public ResponseEntity<TaskResponse> createSubtask(
            @PathVariable UUID parentTaskId,
            @RequestBody CreateTaskRequest request,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireTaskAccess(parentTaskId, email);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(taskService.createSubtask(parentTaskId, request, email));
    }

    @GetMapping("/api/tasks/{parentTaskId}/subtasks")
    public ResponseEntity<List<TaskResponse>> getSubtasks(
            @PathVariable UUID parentTaskId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireTaskAccess(parentTaskId, email);
        return ResponseEntity.ok(taskService.getSubtasks(parentTaskId));
    }
}