package com.taskoura.controller;

import com.taskoura.dto.TestCaseDtos.CreateTestCaseRequest;
import com.taskoura.dto.TestCaseDtos.TestCaseResponse;
import com.taskoura.service.TestCaseService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
public class TestCaseController {

    private final TestCaseService testCaseService;

    public TestCaseController(TestCaseService testCaseService) {
        this.testCaseService = testCaseService;
    }

    @PostMapping("/api/tasks/{taskId}/test-cases")
    public ResponseEntity<TestCaseResponse> createTestCase(
            @PathVariable UUID taskId,
            @RequestBody CreateTestCaseRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.status(201).body(testCaseService.createTestCase(taskId, request, authentication.getName()));
    }

    @GetMapping("/api/tasks/{taskId}/test-cases")
    public ResponseEntity<List<TestCaseResponse>> getTestCases(@PathVariable UUID taskId) {
        return ResponseEntity.ok(testCaseService.getTestCasesForTask(taskId));
    }
}
