package com.taskoura.controller;

import com.taskoura.dto.AiDtos.*;
import com.taskoura.service.AiTaskService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final AiTaskService aiTaskService;

    public AiController(AiTaskService aiTaskService) {
        this.aiTaskService = aiTaskService;
    }

    @PostMapping("/test-cases")
    public ResponseEntity<GenerateTestCasesResponse> generateTestCases(@RequestBody GenerateTestCasesRequest request) {
        return ResponseEntity.ok(aiTaskService.generateTestCases(request.taskId()));
    }

    @PostMapping("/project-plan")
    public ResponseEntity<GenerateProjectPlanResponse> generateProjectPlan(@RequestBody GenerateProjectPlanRequest request) {
        return ResponseEntity.ok(aiTaskService.generateProjectPlan(request.projectId()));
    }

    @PostMapping("/project-plan/confirm")
    public ResponseEntity<ConfirmProjectPlanResponse> confirmProjectPlan(@RequestBody ConfirmProjectPlanRequest request) {
        return ResponseEntity.status(201).body(aiTaskService.confirmProjectPlan(request));
    }

    @GetMapping("/next-task/{projectId}")
    public ResponseEntity<NextTaskRecommendationResponse> getNextTaskRecommendation(@PathVariable UUID projectId) {
        return ResponseEntity.ok(aiTaskService.recommendNextTask(projectId));
    }
}
