package com.taskoura.controller;

import com.taskoura.dto.TemplateDtos.ApplyTemplateResponse;
import com.taskoura.dto.TemplateDtos.TemplateListResponse;
import com.taskoura.service.ProjectTemplateService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class ProjectTemplateController {

    private final ProjectTemplateService projectTemplateService;

    public ProjectTemplateController(ProjectTemplateService projectTemplateService) {
        this.projectTemplateService = projectTemplateService;
    }

    @GetMapping("/api/templates")
    public ResponseEntity<TemplateListResponse> getTemplates() {
        return ResponseEntity.ok(projectTemplateService.getTemplates());
    }

    @PostMapping("/api/projects/{projectId}/templates/{templateKey}/apply")
    public ResponseEntity<ApplyTemplateResponse> applyTemplate(
            @PathVariable UUID projectId,
            @PathVariable String templateKey
    ) {
        return ResponseEntity.ok(projectTemplateService.applyTemplate(projectId, templateKey));
    }
}
