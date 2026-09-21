package com.taskoura.controller;

import com.taskoura.dto.ProjectMemberDtos.*;
import com.taskoura.service.ProjectMemberService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/projects/{projectId}/members")
public class ProjectMemberController {

    private final ProjectMemberService projectMemberService;

    public ProjectMemberController(ProjectMemberService projectMemberService) {
        this.projectMemberService = projectMemberService;
    }

    @PostMapping
    public ResponseEntity<ProjectMemberResponse> inviteMember(
            @PathVariable UUID projectId,
            @RequestBody InviteMemberRequest request
    ) {
        return ResponseEntity.status(201).body(projectMemberService.inviteMember(projectId, request));
    }

    @GetMapping
    public ResponseEntity<List<ProjectMemberResponse>> getMembers(@PathVariable UUID projectId) {
        return ResponseEntity.ok(projectMemberService.getMembers(projectId));
    }

    @PutMapping("/{userId}")
    public ResponseEntity<ProjectMemberResponse> updateRole(
            @PathVariable UUID projectId,
            @PathVariable UUID userId,
            @RequestBody UpdateRoleRequest request
    ) {
        return ResponseEntity.ok(projectMemberService.updateRole(projectId, userId, request));
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> removeMember(
            @PathVariable UUID projectId,
            @PathVariable UUID userId
    ) {
        projectMemberService.removeMember(projectId, userId);
        return ResponseEntity.noContent().build();
    }
}