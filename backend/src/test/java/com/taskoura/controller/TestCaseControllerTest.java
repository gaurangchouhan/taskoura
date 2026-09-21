package com.taskoura.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.config.SecurityConfig;
import com.taskoura.dto.TestCaseDtos.CreateTestCaseRequest;
import com.taskoura.dto.TestCaseDtos.TestCaseResponse;
import com.taskoura.exception.GlobalExceptionHandler;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.JwtUtil;
import com.taskoura.service.TestCaseService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TestCaseController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
    "jwt.secret=taskoura-super-secret-test-jwt-key-256-bits-length!!",
    "jwt.expiration-ms=86400000"
})
class TestCaseControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private TestCaseService testCaseService;

    @Test
    @DisplayName("POST /api/tasks/{taskId}/test-cases: 201 Created on valid test case")
    void createTestCase_success() throws Exception {
        UUID taskId = UUID.randomUUID();
        UUID tcId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        CreateTestCaseRequest request = new CreateTestCaseRequest("API validation", "200 OK", true);
        TestCaseResponse response = new TestCaseResponse(
                tcId, "API validation", "200 OK", true, userId, LocalDateTime.now()
        );

        when(testCaseService.createTestCase(eq(taskId), any(CreateTestCaseRequest.class), eq("tester@example.com")))
                .thenReturn(response);

        String token = jwtUtil.generateToken("tester@example.com");

        mockMvc.perform(post("/api/tasks/{taskId}/test-cases", taskId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(tcId.toString()))
                .andExpect(jsonPath("$.passed").value(true));
    }

    @Test
    @DisplayName("GET /api/tasks/{taskId}/test-cases: 200 OK returns test cases")
    void getTestCases_success() throws Exception {
        UUID taskId = UUID.randomUUID();
        TestCaseResponse response = new TestCaseResponse(
                UUID.randomUUID(), "API validation", "200 OK", false, UUID.randomUUID(), LocalDateTime.now()
        );

        when(testCaseService.getTestCasesForTask(taskId)).thenReturn(List.of(response));

        String token = jwtUtil.generateToken("tester@example.com");

        mockMvc.perform(get("/api/tasks/{taskId}/test-cases", taskId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].passed").value(false));
    }
}
