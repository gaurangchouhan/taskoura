package com.taskoura.controller;

import com.taskoura.dto.TestCaseDtos.CreateTestCaseRequest;
import com.taskoura.dto.TestCaseDtos.TestCaseResponse;
import com.taskoura.service.ProjectAccessService;
import com.taskoura.service.TestCaseService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
public class TestCaseController {

    private final TestCaseService testCaseService;
    private final ProjectAccessService projectAccessService;

    public TestCaseController(TestCaseService testCaseService, ProjectAccessService projectAccessService) {
        this.testCaseService = testCaseService;
        this.projectAccessService = projectAccessService;
    }

    @PostMapping("/api/tasks/{taskId}/test-cases")
    public ResponseEntity<TestCaseResponse> createTestCase(
            @PathVariable UUID taskId,
            @RequestBody CreateTestCaseRequest request,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireTaskAccess(taskId, email);
        return ResponseEntity.status(201).body(testCaseService.createTestCase(taskId, request, email));
    }

    @GetMapping("/api/tasks/{taskId}/test-cases")
    public ResponseEntity<List<TestCaseResponse>> getTestCases(
            @PathVariable UUID taskId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireTaskAccess(taskId, email);
        return ResponseEntity.ok(testCaseService.getTestCasesForTask(taskId));
    }
}
