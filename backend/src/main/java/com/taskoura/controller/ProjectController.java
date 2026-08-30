package com.taskoura.controller;

import com.taskoura.dto.ProjectDtos.*;
import com.taskoura.service.ProjectService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @PostMapping
    public ResponseEntity<ProjectResponse> createProject(
            Authentication authentication,
            @RequestBody CreateProjectRequest request
    ) {
        String email = authentication.getName();
        return ResponseEntity.status(201).body(projectService.createProject(email, request));
    }

    @GetMapping
    public ResponseEntity<List<ProjectResponse>> getMyProjects(Authentication authentication) {
        String email = authentication.getName();
        return ResponseEntity.ok(projectService.getProjectsForUser(email));
    }
}