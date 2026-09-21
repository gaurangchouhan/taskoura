package com.taskoura.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.config.SecurityConfig;
import com.taskoura.dto.AiDtos.*;
import com.taskoura.exception.BadGatewayException;
import com.taskoura.exception.GlobalExceptionHandler;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.JwtUtil;
import com.taskoura.service.AiTaskService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AiController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
    "jwt.secret=taskoura-super-secret-test-jwt-key-256-bits-length!!",
    "jwt.expiration-ms=86400000"
})
class AiControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private AiTaskService aiTaskService;

    @Test
    @DisplayName("POST /api/ai/test-cases: 200 OK returns generated test cases")
    void generateTestCases_success() throws Exception {
        UUID taskId = UUID.randomUUID();
        GenerateTestCasesRequest request = new GenerateTestCasesRequest(taskId);
        GenerateTestCasesResponse response = new GenerateTestCasesResponse(
                List.of(new GeneratedTestCase("Login test", "200 OK"))
        );

        when(aiTaskService.generateTestCases(eq(taskId))).thenReturn(response);

        String token = jwtUtil.generateToken("developer@example.com");

        mockMvc.perform(post("/api/ai/test-cases")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.testCases").isArray())
                .andExpect(jsonPath("$.testCases[0].title").value("Login test"));
    }

    @Test
    @DisplayName("POST /api/ai/test-cases: 502 Bad Gateway when AI service fails")
    void generateTestCases_aiFails_returns502() throws Exception {
        UUID taskId = UUID.randomUUID();
        GenerateTestCasesRequest request = new GenerateTestCasesRequest(taskId);

        when(aiTaskService.generateTestCases(eq(taskId)))
                .thenThrow(new BadGatewayException("AI service unavailable, try again"));

        String token = jwtUtil.generateToken("developer@example.com");

        mockMvc.perform(post("/api/ai/test-cases")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.status").value(502))
                .andExpect(jsonPath("$.message").value("AI service unavailable, try again"));
    }

    @Test
    @DisplayName("POST /api/ai/project-plan: 200 OK returns project plan preview")
    void generateProjectPlan_success() throws Exception {
        UUID projectId = UUID.randomUUID();
        GenerateProjectPlanRequest request = new GenerateProjectPlanRequest(projectId);
        GenerateProjectPlanResponse response = new GenerateProjectPlanResponse(
                List.of(new PlanModule("Core", List.of(new PlanTask("Task 1", "Backend", "High"))))
        );

        when(aiTaskService.generateProjectPlan(eq(projectId))).thenReturn(response);

        String token = jwtUtil.generateToken("developer@example.com");

        mockMvc.perform(post("/api/ai/project-plan")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.modules").isArray())
                .andExpect(jsonPath("$.modules[0].name").value("Core"));
    }

    @Test
    @DisplayName("POST /api/ai/project-plan/confirm: 201 Created returns created task IDs")
    void confirmProjectPlan_success() throws Exception {
        UUID projectId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();
        ConfirmProjectPlanRequest request = new ConfirmProjectPlanRequest(
                projectId,
                List.of(new PlanModule("Core", List.of(new PlanTask("Task 1", "Backend", "High"))))
        );
        ConfirmProjectPlanResponse response = new ConfirmProjectPlanResponse(1, List.of(taskId));

        when(aiTaskService.confirmProjectPlan(any())).thenReturn(response);

        String token = jwtUtil.generateToken("developer@example.com");

        mockMvc.perform(post("/api/ai/project-plan/confirm")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.createdCount").value(1))
                .andExpect(jsonPath("$.taskIds[0]").value(taskId.toString()));
    }

    @Test
    @DisplayName("GET /api/ai/next-task/{projectId}: 200 OK returns recommendation")
    void getNextTask_success() throws Exception {
        UUID projectId = UUID.randomUUID();
        NextTaskRecommendationResponse response = new NextTaskRecommendationResponse(
                "Prioritize the database schema task.", UUID.randomUUID()
        );

        when(aiTaskService.recommendNextTask(eq(projectId))).thenReturn(response);

        String token = jwtUtil.generateToken("developer@example.com");

        mockMvc.perform(get("/api/ai/next-task/{projectId}", projectId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendation").value("Prioritize the database schema task."));
    }
}
