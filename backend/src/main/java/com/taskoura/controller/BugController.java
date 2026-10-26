package com.taskoura.controller;

import com.taskoura.dto.BugDtos.CreateBugRequest;
import com.taskoura.dto.BugDtos.BugResponse;
import com.taskoura.service.BugService;
import com.taskoura.service.ProjectAccessService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
public class BugController {

    private final BugService bugService;
    private final ProjectAccessService projectAccessService;

    public BugController(BugService bugService, ProjectAccessService projectAccessService) {
        this.bugService = bugService;
        this.projectAccessService = projectAccessService;
    }

    @PostMapping("/api/tasks/{taskId}/bugs")
    public ResponseEntity<BugResponse> createBug(
            @PathVariable UUID taskId,
            @RequestBody CreateBugRequest request,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireTaskAccess(taskId, email);
        return ResponseEntity.status(201).body(bugService.createBug(taskId, request, email));
    }

    @PatchMapping("/api/bugs/{bugId}/resolve")
    public ResponseEntity<BugResponse> resolveBug(
            @PathVariable UUID bugId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireBugAccess(bugId, email);
        return ResponseEntity.ok(bugService.resolveBug(bugId));
    }

    @GetMapping("/api/tasks/{taskId}/bugs")
    public ResponseEntity<List<BugResponse>> getBugs(
            @PathVariable UUID taskId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireTaskAccess(taskId, email);
        return ResponseEntity.ok(bugService.getBugsForTask(taskId));
    }
}
