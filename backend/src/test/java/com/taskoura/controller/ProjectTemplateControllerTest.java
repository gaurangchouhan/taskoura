package com.taskoura.controller;

import com.taskoura.config.SecurityConfig;
import com.taskoura.dto.TemplateDtos.*;
import com.taskoura.exception.GlobalExceptionHandler;
import com.taskoura.exception.NotFoundException;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.JwtUtil;
import com.taskoura.service.ProjectTemplateService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProjectTemplateController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
    "jwt.secret=taskoura-super-secret-test-jwt-key-256-bits-length!!",
    "jwt.expiration-ms=86400000"
})
class ProjectTemplateControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private ProjectTemplateService projectTemplateService;

    @Test
    @DisplayName("GET /api/templates: 200 OK with available templates list")
    void getTemplates_success() throws Exception {
        String token = jwtUtil.generateToken("user@test.com");

        TemplateListResponse mockResponse = new TemplateListResponse(List.of(
                new TemplateSummary("library-management", "Library Management System", "Description", 4, 12)
        ));

        when(projectTemplateService.getTemplates()).thenReturn(mockResponse);

        mockMvc.perform(get("/api/templates")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.templates[0].key").value("library-management"))
                .andExpect(jsonPath("$.templates[0].name").value("Library Management System"))
                .andExpect(jsonPath("$.templates[0].taskCount").value(12));
    }

    @Test
    @DisplayName("POST /api/projects/{projectId}/templates/{templateKey}/apply: 200 OK on apply")
    void applyTemplate_success() throws Exception {
        UUID projectId = UUID.randomUUID();
        String token = jwtUtil.generateToken("user@test.com");

        ApplyTemplateResponse mockResponse = new ApplyTemplateResponse(
                14, List.of(UUID.randomUUID(), UUID.randomUUID())
        );

        when(projectTemplateService.applyTemplate(projectId, "e-commerce-website")).thenReturn(mockResponse);

        mockMvc.perform(post("/api/projects/{projectId}/templates/{templateKey}/apply", projectId, "e-commerce-website")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.createdCount").value(14))
                .andExpect(jsonPath("$.taskIds").isArray());
    }

    @Test
    @DisplayName("POST /api/projects/{projectId}/templates/{templateKey}/apply: 404 on unknown templateKey")
    void applyTemplate_unknownKey_returns404() throws Exception {
        UUID projectId = UUID.randomUUID();
        String token = jwtUtil.generateToken("user@test.com");

        when(projectTemplateService.applyTemplate(projectId, "unknown-template"))
                .thenThrow(new NotFoundException("Template not found: unknown-template"));

        mockMvc.perform(post("/api/projects/{projectId}/templates/{templateKey}/apply", projectId, "unknown-template")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Template not found: unknown-template"));
    }
}
