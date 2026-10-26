package com.taskoura.controller;

import com.taskoura.dto.DashboardReportDtos.DashboardResponse;
import com.taskoura.dto.DashboardReportDtos.MemberPerformanceReport;
import com.taskoura.service.DashboardReportService;
import com.taskoura.service.ProjectAccessService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class DashboardReportController {

    private final DashboardReportService dashboardReportService;
    private final ProjectAccessService projectAccessService;

    public DashboardReportController(DashboardReportService dashboardReportService, ProjectAccessService projectAccessService) {
        this.dashboardReportService = dashboardReportService;
        this.projectAccessService = projectAccessService;
    }

    @GetMapping("/api/projects/{projectId}/dashboard")
    public ResponseEntity<DashboardResponse> getDashboard(
            @PathVariable UUID projectId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireMember(projectId, email);
        return ResponseEntity.ok(dashboardReportService.getDashboard(projectId));
    }

    @GetMapping("/api/projects/{projectId}/report")
    public ResponseEntity<List<MemberPerformanceReport>> getPerformanceReport(
            @PathVariable UUID projectId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireOwner(projectId, email);
        return ResponseEntity.ok(dashboardReportService.getPerformanceReport(projectId, email));
    }
}
