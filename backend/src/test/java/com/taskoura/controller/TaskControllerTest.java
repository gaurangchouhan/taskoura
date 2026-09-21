package com.taskoura.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.config.SecurityConfig;
import com.taskoura.dto.TaskDtos.CreateTaskRequest;
import com.taskoura.dto.TaskDtos.TaskResponse;
import com.taskoura.dto.TaskDtos.UpdateTaskStatusRequest;
import com.taskoura.dto.TaskStatusLogDtos.TaskStatusLogResponse;
import com.taskoura.exception.GlobalExceptionHandler;
import com.taskoura.exception.NotFoundException;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.JwtUtil;
import com.taskoura.service.TaskService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TaskController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
    "jwt.secret=taskoura-super-secret-test-jwt-key-256-bits-length!!",
    "jwt.expiration-ms=86400000"
})
class TaskControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private TaskService taskService;

    @Test
    @DisplayName("POST /api/projects/{projectId}/tasks: 201 Created on valid task creation")
    void createTask_success() throws Exception {
        UUID projectId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();
        CreateTaskRequest request = new CreateTaskRequest(
                "Design Architecture", "System design doc", "Backend", "High", null, LocalDate.now().plusWeeks(2)
        );

        TaskResponse response = new TaskResponse(
                taskId, "Design Architecture", "Backend", "High", "Backlog", null, request.deadline(), null
        );

        when(taskService.createTask(eq(projectId), any(CreateTaskRequest.class))).thenReturn(response);

        String token = jwtUtil.generateToken("developer@example.com");

        mockMvc.perform(post("/api/projects/{projectId}/tasks", projectId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(taskId.toString()))
                .andExpect(jsonPath("$.title").value("Design Architecture"))
                .andExpect(jsonPath("$.status").value("Backlog"));

        verify(taskService).createTask(eq(projectId), any(CreateTaskRequest.class));
    }

    @Test
    @DisplayName("POST /api/projects/{projectId}/tasks: 404 when project does not exist")
    void createTask_projectNotFound_returns404() throws Exception {
        UUID projectId = UUID.randomUUID();
        CreateTaskRequest request = new CreateTaskRequest(
                "Design Architecture", "System design doc", "Backend", "High", null, LocalDate.now()
        );

        when(taskService.createTask(eq(projectId), any(CreateTaskRequest.class)))
                .thenThrow(new NotFoundException("Project not found"));

        String token = jwtUtil.generateToken("developer@example.com");

        mockMvc.perform(post("/api/projects/{projectId}/tasks", projectId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Project not found"));
    }

    @Test
    @DisplayName("GET /api/projects/{projectId}/tasks: 200 OK returns project tasks")
    void getTasks_success() throws Exception {
        UUID projectId = UUID.randomUUID();
        TaskResponse response = new TaskResponse(
                UUID.randomUUID(), "Task 1", "Backend", "Medium", "Backlog", null, null, null
        );

        when(taskService.getTasksForProject(projectId)).thenReturn(List.of(response));

        String token = jwtUtil.generateToken("developer@example.com");

        mockMvc.perform(get("/api/projects/{projectId}/tasks", projectId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Task 1"));
    }

    @Test
    @DisplayName("PATCH /api/tasks/{taskId}/status: 200 OK updates status")
    void updateStatus_success() throws Exception {
        UUID taskId = UUID.randomUUID();
        UpdateTaskStatusRequest request = new UpdateTaskStatusRequest("InProgress");
        TaskResponse response = new TaskResponse(
                taskId, "Task 1", "Backend", "Medium", "InProgress", null, null, null
        );

        when(taskService.updateStatus(eq(taskId), any(UpdateTaskStatusRequest.class), eq("developer@example.com")))
                .thenReturn(response);

        String token = jwtUtil.generateToken("developer@example.com");

        mockMvc.perform(patch("/api/tasks/{taskId}/status", taskId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("InProgress"));
    }

    @Test
    @DisplayName("GET /api/tasks/{taskId}/status-logs: 200 OK returns status history")
    void getStatusLogs_success() throws Exception {
        UUID taskId = UUID.randomUUID();
        TaskStatusLogResponse logResponse = new TaskStatusLogResponse(
                UUID.randomUUID(), "Backlog", "InProgress", UUID.randomUUID(), "Alex", LocalDateTime.now()
        );

        when(taskService.getStatusHistory(taskId)).thenReturn(List.of(logResponse));

        String token = jwtUtil.generateToken("developer@example.com");

        mockMvc.perform(get("/api/tasks/{taskId}/status-logs", taskId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].fromStatus").value("Backlog"))
                .andExpect(jsonPath("$[0].toStatus").value("InProgress"));
    }

    @Test
    @DisplayName("Task endpoints require authentication: 401 when unauthenticated")
    void taskEndpoints_unauthenticated_returns401() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(get("/api/projects/{projectId}/tasks", id))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/tasks/{taskId}/status-logs", id))
                .andExpect(status().isUnauthorized());
    }
}
