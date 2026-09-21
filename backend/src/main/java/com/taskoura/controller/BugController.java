package com.taskoura.controller;

import com.taskoura.dto.BugDtos.CreateBugRequest;
import com.taskoura.dto.BugDtos.BugResponse;
import com.taskoura.service.BugService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
public class BugController {

    private final BugService bugService;

    public BugController(BugService bugService) {
        this.bugService = bugService;
    }

    @PostMapping("/api/tasks/{taskId}/bugs")
    public ResponseEntity<BugResponse> createBug(
            @PathVariable UUID taskId,
            @RequestBody CreateBugRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.status(201).body(bugService.createBug(taskId, request, authentication.getName()));
    }

    @PatchMapping("/api/bugs/{bugId}/resolve")
    public ResponseEntity<BugResponse> resolveBug(@PathVariable UUID bugId) {
        return ResponseEntity.ok(bugService.resolveBug(bugId));
    }

    @GetMapping("/api/tasks/{taskId}/bugs")
    public ResponseEntity<List<BugResponse>> getBugs(@PathVariable UUID taskId) {
        return ResponseEntity.ok(bugService.getBugsForTask(taskId));
    }
}
