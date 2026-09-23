package com.taskoura.controller;

import com.taskoura.config.SecurityConfig;
import com.taskoura.dto.DashboardReportDtos.*;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.exception.GlobalExceptionHandler;
import com.taskoura.exception.NotFoundException;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.JwtUtil;
import com.taskoura.service.DashboardReportService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DashboardReportController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
    "jwt.secret=taskoura-super-secret-test-jwt-key-256-bits-length!!",
    "jwt.expiration-ms=86400000"
})
class DashboardReportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private DashboardReportService dashboardReportService;

    @Test
    @DisplayName("GET /api/projects/{projectId}/dashboard: 200 OK with dashboard response")
    void getDashboard_success() throws Exception {
        UUID projectId = UUID.randomUUID();
        String token = jwtUtil.generateToken("user@example.com");

        DashboardResponse mockDashboard = new DashboardResponse(
                5, 2, 40.0,
                Map.of("Backlog", 1L, "InProgress", 2L, "Completed", 2L),
                List.of(new MemberTaskStats(UUID.randomUUID(), "Alice", 3, 2)),
                List.of()
        );

        when(dashboardReportService.getDashboard(projectId)).thenReturn(mockDashboard);

        mockMvc.perform(get("/api/projects/{projectId}/dashboard", projectId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTasks").value(5))
                .andExpect(jsonPath("$.completedTasks").value(2))
                .andExpect(jsonPath("$.completionPercentage").value(40.0))
                .andExpect(jsonPath("$.tasksByStatus.Backlog").value(1))
                .andExpect(jsonPath("$.tasksByMember[0].userName").value("Alice"));
    }

    @Test
    @DisplayName("GET /api/projects/{projectId}/report: 200 OK when caller is owner")
    void getReport_owner_success() throws Exception {
        UUID projectId = UUID.randomUUID();
        String token = jwtUtil.generateToken("owner@example.com");

        MemberPerformanceReport report = new MemberPerformanceReport(
                UUID.randomUUID(), "Dev", 4, 3, 2, 1, 3.5, 1, 2, 1, 4.0, 5, 4
        );

        when(dashboardReportService.getPerformanceReport(projectId, "owner@example.com"))
                .thenReturn(List.of(report));

        mockMvc.perform(get("/api/projects/{projectId}/report", projectId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].userName").value("Dev"))
                .andExpect(jsonPath("$[0].tasksAssigned").value(4))
                .andExpect(jsonPath("$[0].tasksCompleted").value(3))
                .andExpect(jsonPath("$[0].averageDelayDays").value(3.5))
                .andExpect(jsonPath("$[0].reworkCount").value(1));
    }

    @Test
    @DisplayName("GET /api/projects/{projectId}/report: 403 Forbidden when caller is non-owner member")
    void getReport_nonOwner_forbidden() throws Exception {
        UUID projectId = UUID.randomUUID();
        String token = jwtUtil.generateToken("member@example.com");

        when(dashboardReportService.getPerformanceReport(projectId, "member@example.com"))
                .thenThrow(new ForbiddenException("Only the project owner can access the performance report"));

        mockMvc.perform(get("/api/projects/{projectId}/report", projectId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.message").value("Only the project owner can access the performance report"));
    }

    @Test
    @DisplayName("GET /api/projects/{projectId}/dashboard: 404 Not Found when project does not exist")
    void getDashboard_projectNotFound_returns404() throws Exception {
        UUID projectId = UUID.randomUUID();
        String token = jwtUtil.generateToken("user@example.com");

        when(dashboardReportService.getDashboard(projectId))
                .thenThrow(new NotFoundException("Project not found"));

        mockMvc.perform(get("/api/projects/{projectId}/dashboard", projectId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }
}
