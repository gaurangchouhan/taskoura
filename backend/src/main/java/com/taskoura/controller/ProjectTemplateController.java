package com.taskoura.controller;

import com.taskoura.dto.TemplateDtos.ApplyTemplateResponse;
import com.taskoura.dto.TemplateDtos.TemplateListResponse;
import com.taskoura.service.ProjectAccessService;
import com.taskoura.service.ProjectTemplateService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class ProjectTemplateController {

    private final ProjectTemplateService projectTemplateService;
    private final ProjectAccessService projectAccessService;

    public ProjectTemplateController(ProjectTemplateService projectTemplateService, ProjectAccessService projectAccessService) {
        this.projectTemplateService = projectTemplateService;
        this.projectAccessService = projectAccessService;
    }

    @GetMapping("/api/templates")
    public ResponseEntity<TemplateListResponse> getTemplates() {
        return ResponseEntity.ok(projectTemplateService.getTemplates());
    }

    @PostMapping("/api/projects/{projectId}/templates/{templateKey}/apply")
    public ResponseEntity<ApplyTemplateResponse> applyTemplate(
            @PathVariable UUID projectId,
            @PathVariable String templateKey,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireMember(projectId, email);
        return ResponseEntity.ok(projectTemplateService.applyTemplate(projectId, templateKey, email));
    }
}
