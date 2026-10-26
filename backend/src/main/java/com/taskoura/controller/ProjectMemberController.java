package com.taskoura.controller;

import com.taskoura.dto.ProjectMemberDtos.*;
import com.taskoura.service.ProjectAccessService;
import com.taskoura.service.ProjectMemberService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/projects/{projectId}/members")
public class ProjectMemberController {

    private final ProjectMemberService projectMemberService;
    private final ProjectAccessService projectAccessService;

    public ProjectMemberController(ProjectMemberService projectMemberService, ProjectAccessService projectAccessService) {
        this.projectMemberService = projectMemberService;
        this.projectAccessService = projectAccessService;
    }

    @PostMapping
    public ResponseEntity<ProjectMemberResponse> inviteMember(
            @PathVariable UUID projectId,
            @RequestBody InviteMemberRequest request,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireOwner(projectId, email);
        return ResponseEntity.status(201).body(projectMemberService.inviteMember(projectId, request));
    }

    @GetMapping
    public ResponseEntity<List<ProjectMemberResponse>> getMembers(
            @PathVariable UUID projectId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireMember(projectId, email);
        return ResponseEntity.ok(projectMemberService.getMembers(projectId));
    }

    @PutMapping("/{userId}")
    public ResponseEntity<ProjectMemberResponse> updateRole(
            @PathVariable UUID projectId,
            @PathVariable UUID userId,
            @RequestBody UpdateRoleRequest request,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireOwner(projectId, email);
        return ResponseEntity.ok(projectMemberService.updateRole(projectId, userId, request));
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> removeMember(
            @PathVariable UUID projectId,
            @PathVariable UUID userId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireOwner(projectId, email);
        projectMemberService.removeMember(projectId, userId);
        return ResponseEntity.noContent().build();
    }
}