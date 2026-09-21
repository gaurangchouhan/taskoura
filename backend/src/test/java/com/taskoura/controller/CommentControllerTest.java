package com.taskoura.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.config.SecurityConfig;
import com.taskoura.dto.CommentDtos.CreateCommentRequest;
import com.taskoura.dto.CommentDtos.CommentResponse;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.GlobalExceptionHandler;
import com.taskoura.exception.NotFoundException;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.JwtUtil;
import com.taskoura.service.CommentService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CommentController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
    "jwt.secret=taskoura-super-secret-test-jwt-key-256-bits-length!!",
    "jwt.expiration-ms=86400000"
})
class CommentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private CommentService commentService;

    @Test
    @DisplayName("POST /api/tasks/{taskId}/comments: 201 Created on valid comment")
    void addComment_success() throws Exception {
        UUID taskId = UUID.randomUUID();
        UUID commentId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        CreateCommentRequest request = new CreateCommentRequest("Code review looks solid.");
        CommentResponse response = new CommentResponse(
                commentId, taskId, userId, "Reviewer", "Code review looks solid.", LocalDateTime.now()
        );

        when(commentService.addComment(eq(taskId), any(CreateCommentRequest.class), eq("reviewer@example.com")))
                .thenReturn(response);

        String token = jwtUtil.generateToken("reviewer@example.com");

        mockMvc.perform(post("/api/tasks/{taskId}/comments", taskId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(commentId.toString()))
                .andExpect(jsonPath("$.content").value("Code review looks solid."))
                .andExpect(jsonPath("$.userName").value("Reviewer"));

        verify(commentService).addComment(eq(taskId), any(CreateCommentRequest.class), eq("reviewer@example.com"));
    }

    @Test
    @DisplayName("POST /api/tasks/{taskId}/comments: 400 Bad Request on empty comment")
    void addComment_emptyContent_returns400() throws Exception {
        UUID taskId = UUID.randomUUID();
        CreateCommentRequest request = new CreateCommentRequest("");

        when(commentService.addComment(eq(taskId), any(CreateCommentRequest.class), eq("reviewer@example.com")))
                .thenThrow(new BadRequestException("Comment content cannot be empty"));

        String token = jwtUtil.generateToken("reviewer@example.com");

        mockMvc.perform(post("/api/tasks/{taskId}/comments", taskId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Comment content cannot be empty"));
    }

    @Test
    @DisplayName("POST /api/tasks/{taskId}/comments: 404 when task does not exist")
    void addComment_taskNotFound_returns404() throws Exception {
        UUID taskId = UUID.randomUUID();
        CreateCommentRequest request = new CreateCommentRequest("Valid content");

        when(commentService.addComment(eq(taskId), any(CreateCommentRequest.class), eq("reviewer@example.com")))
                .thenThrow(new NotFoundException("Task not found"));

        String token = jwtUtil.generateToken("reviewer@example.com");

        mockMvc.perform(post("/api/tasks/{taskId}/comments", taskId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Task not found"));
    }

    @Test
    @DisplayName("GET /api/tasks/{taskId}/comments: 200 OK returns comment list")
    void getComments_success() throws Exception {
        UUID taskId = UUID.randomUUID();
        CommentResponse response = new CommentResponse(
                UUID.randomUUID(), taskId, UUID.randomUUID(), "Reviewer", "First comment", LocalDateTime.now()
        );

        when(commentService.getComments(taskId)).thenReturn(List.of(response));

        String token = jwtUtil.generateToken("reviewer@example.com");

        mockMvc.perform(get("/api/tasks/{taskId}/comments", taskId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].content").value("First comment"))
                .andExpect(jsonPath("$[0].userName").value("Reviewer"));
    }

    @Test
    @DisplayName("Comment endpoints require authentication: 401 when unauthenticated")
    void commentEndpoints_unauthenticated_returns401() throws Exception {
        UUID taskId = UUID.randomUUID();
        mockMvc.perform(get("/api/tasks/{taskId}/comments", taskId))
                .andExpect(status().isUnauthorized());
    }
}
