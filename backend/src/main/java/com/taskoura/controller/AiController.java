package com.taskoura.controller;

import com.taskoura.dto.AiDtos.*;
import com.taskoura.service.AiTaskService;
import com.taskoura.service.ProjectAccessService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.taskoura.exception.ValidationException;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final AiTaskService aiTaskService;
    private final ProjectAccessService projectAccessService;

    public AiController(AiTaskService aiTaskService, ProjectAccessService projectAccessService) {
        this.aiTaskService = aiTaskService;
        this.projectAccessService = projectAccessService;
    }

    @PostMapping("/test-cases")
    public ResponseEntity<GenerateTestCasesResponse> generateTestCases(
            @RequestBody GenerateTestCasesRequest request,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireTaskAccess(request.taskId(), email);
        return ResponseEntity.ok(aiTaskService.generateTestCases(request.taskId()));
    }

    @PostMapping("/project-plan")
    public ResponseEntity<GenerateProjectPlanResponse> generateProjectPlan(
            @RequestBody GenerateProjectPlanRequest request,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        if (request == null || request.projectId() == null) {
            throw new ValidationException(Map.of("projectId", "Project ID is required"));
        }
        projectAccessService.requireMember(request.projectId(), email);
        return ResponseEntity.ok(aiTaskService.generateProjectPlan(request.projectId()));
    }

    @PostMapping("/project-plan/confirm")
    public ResponseEntity<ConfirmProjectPlanResponse> confirmProjectPlan(
            @RequestBody ConfirmProjectPlanRequest request,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        if (request == null || request.projectId() == null) {
            throw new ValidationException(Map.of("projectId", "Project ID is required"));
        }
        projectAccessService.requireMember(request.projectId(), email);
        return ResponseEntity.status(201).body(aiTaskService.confirmProjectPlan(request, email));
    }

    @GetMapping("/next-task/{projectId}")
    public ResponseEntity<NextTaskRecommendationResponse> getNextTaskRecommendation(
            @PathVariable UUID projectId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireMember(projectId, email);
        return ResponseEntity.ok(aiTaskService.recommendNextTask(projectId));
    }
}
