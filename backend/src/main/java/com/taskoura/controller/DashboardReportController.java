package com.taskoura.controller;

import com.taskoura.dto.DashboardReportDtos.DashboardResponse;
import com.taskoura.dto.DashboardReportDtos.MemberPerformanceReport;
import com.taskoura.service.DashboardReportService;
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

    public DashboardReportController(DashboardReportService dashboardReportService) {
        this.dashboardReportService = dashboardReportService;
    }

    @GetMapping("/api/projects/{projectId}/dashboard")
    public ResponseEntity<DashboardResponse> getDashboard(@PathVariable UUID projectId) {
        return ResponseEntity.ok(dashboardReportService.getDashboard(projectId));
    }

    @GetMapping("/api/projects/{projectId}/report")
    public ResponseEntity<List<MemberPerformanceReport>> getPerformanceReport(
            @PathVariable UUID projectId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(dashboardReportService.getPerformanceReport(projectId, authentication.getName()));
    }
}
