package com.taskoura.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.config.SecurityConfig;
import com.taskoura.dto.BugDtos.CreateBugRequest;
import com.taskoura.dto.BugDtos.BugResponse;
import com.taskoura.exception.GlobalExceptionHandler;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.JwtUtil;
import com.taskoura.service.BugService;
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
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(BugController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
    "jwt.secret=taskoura-super-secret-test-jwt-key-256-bits-length!!",
    "jwt.expiration-ms=86400000"
})
class BugControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private BugService bugService;

    @Test
    @DisplayName("POST /api/tasks/{taskId}/bugs: 201 Created on valid bug report")
    void createBug_success() throws Exception {
        UUID taskId = UUID.randomUUID();
        UUID bugId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        CreateBugRequest request = new CreateBugRequest("Critical", "Memory leak", null);
        BugResponse response = new BugResponse(
                bugId, taskId, "Critical", "Open", userId, null, LocalDateTime.now(), null
        );

        when(bugService.createBug(eq(taskId), any(CreateBugRequest.class), eq("tester@example.com")))
                .thenReturn(response);

        String token = jwtUtil.generateToken("tester@example.com");

        mockMvc.perform(post("/api/tasks/{taskId}/bugs", taskId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(bugId.toString()))
                .andExpect(jsonPath("$.severity").value("Critical"))
                .andExpect(jsonPath("$.status").value("Open"));
    }

    @Test
    @DisplayName("PATCH /api/bugs/{bugId}/resolve: 200 OK resolves bug")
    void resolveBug_success() throws Exception {
        UUID bugId = UUID.randomUUID();
        BugResponse response = new BugResponse(
                bugId, UUID.randomUUID(), "High", "Resolved", UUID.randomUUID(), null, LocalDateTime.now().minusHours(1), LocalDateTime.now()
        );

        when(bugService.resolveBug(bugId)).thenReturn(response);

        String token = jwtUtil.generateToken("tester@example.com");

        mockMvc.perform(patch("/api/bugs/{bugId}/resolve", bugId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("Resolved"))
                .andExpect(jsonPath("$.resolvedAt").isNotEmpty());
    }

    @Test
    @DisplayName("GET /api/tasks/{taskId}/bugs: 200 OK returns bug list")
    void getBugs_success() throws Exception {
        UUID taskId = UUID.randomUUID();
        BugResponse response = new BugResponse(
                UUID.randomUUID(), taskId, "Low", "Open", UUID.randomUUID(), null, LocalDateTime.now(), null
        );

        when(bugService.getBugsForTask(taskId)).thenReturn(List.of(response));

        String token = jwtUtil.generateToken("tester@example.com");

        mockMvc.perform(get("/api/tasks/{taskId}/bugs", taskId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(1));
    }
}
