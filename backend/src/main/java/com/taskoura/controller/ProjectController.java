package com.taskoura.controller;

import com.taskoura.dto.ProjectDtos.*;
import com.taskoura.service.ProjectAccessService;
import com.taskoura.service.ProjectService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService projectService;
    private final ProjectAccessService projectAccessService;

    public ProjectController(ProjectService projectService, ProjectAccessService projectAccessService) {
        this.projectService = projectService;
        this.projectAccessService = projectAccessService;
    }

    @PostMapping
    public ResponseEntity<ProjectResponse> createProject(
            Authentication authentication,
            @RequestBody CreateProjectRequest request
    ) {
        String email = authentication != null ? authentication.getName() : null;
        return ResponseEntity.status(201).body(projectService.createProject(email, request));
    }

    @GetMapping
    public ResponseEntity<List<ProjectResponse>> getMyProjects(Authentication authentication) {
        String email = authentication != null ? authentication.getName() : null;
        return ResponseEntity.ok(projectService.getProjectsForUser(email));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProjectResponse> getProject(
            @PathVariable java.util.UUID id,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireMember(id, email);
        return ResponseEntity.ok(projectService.getProjectById(id, email));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProject(
            @PathVariable java.util.UUID id,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectService.deleteProject(id, email);
        return ResponseEntity.noContent().build();
    }
}