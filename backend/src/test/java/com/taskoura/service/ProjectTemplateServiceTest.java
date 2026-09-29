package com.taskoura.service;

import com.taskoura.dto.TemplateDtos.*;
import com.taskoura.entity.Project;
import com.taskoura.entity.Task;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProjectTemplateServiceTest {

    @Mock private ProjectService projectService;
    @Mock private TaskRepository taskRepository;

    private ProjectTemplateService projectTemplateService;

    private UUID projectId;
    private Project project;

    @BeforeEach
    void setUp() {
        projectTemplateService = new ProjectTemplateService(projectService, taskRepository);
        projectId = UUID.randomUUID();
        project = Project.builder().id(projectId).name("Template Target Project").build();
    }

    @Test
    @DisplayName("getTemplates: returns all 5 required templates with positive module and task counts")
    void getTemplates_returnsAllFiveTemplates() {
        TemplateListResponse response = projectTemplateService.getTemplates();

        assertThat(response).isNotNull();
        assertThat(response.templates()).hasSize(5);

        List<String> keys = response.templates().stream().map(TemplateSummary::key).toList();
        assertThat(keys).containsExactlyInAnyOrder(
                "library-management",
                "hospital-management",
                "e-commerce-website",
                "student-management",
                "portfolio-website"
        );

        for (TemplateSummary t : response.templates()) {
            assertThat(t.moduleCount()).isBetween(3, 5);
            assertThat(t.taskCount()).isGreaterThanOrEqualTo(10);
            assertThat(t.description()).isNotBlank();
        }
    }

    @Test
    @DisplayName("applyTemplate: creates tasks in Backlog status matching template task count")
    void applyTemplate_createsTasksInBacklog() {
        when(projectService.getProjectEntityOrThrow(projectId)).thenReturn(project);
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> {
            Task t = inv.getArgument(0);
            t.setId(UUID.randomUUID());
            return t;
        });

        ApplyTemplateResponse response = projectTemplateService.applyTemplate(projectId, "library-management");

        assertThat(response).isNotNull();
        assertThat(response.createdCount()).isEqualTo(13);
        assertThat(response.taskIds()).hasSize(13);

        verify(taskRepository, times(13)).save(argThat(t ->
                "Backlog".equals(t.getStatus()) && t.getProject().equals(project)
        ));
    }

    @Test
    @DisplayName("applyTemplate: unknown template key throws NotFoundException (404)")
    void applyTemplate_unknownTemplateKey_throwsNotFound() {
        when(projectService.getProjectEntityOrThrow(projectId)).thenReturn(project);

        assertThatThrownBy(() -> projectTemplateService.applyTemplate(projectId, "non-existent-template"))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("Template not found: non-existent-template");

        verifyNoInteractions(taskRepository);
    }
}
