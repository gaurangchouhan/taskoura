package com.taskoura.service;

import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.dto.TaskDtos.TaskResponse;
import com.taskoura.dto.TemplateDtos.ApplyTemplateResponse;
import com.taskoura.dto.TemplateDtos.TemplateListResponse;
import com.taskoura.dto.TemplateDtos.TemplateSummary;
import com.taskoura.entity.User;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ProjectTemplateIntegrationTest {

    @Autowired private ProjectTemplateService projectTemplateService;
    @Autowired private ProjectService projectService;
    @Autowired private TaskService taskService;
    @Autowired private UserRepository userRepository;

    private User owner;
    private ProjectResponse project;

    @BeforeEach
    void setUp() {
        owner = userRepository.save(User.builder()
                .name("Template Owner")
                .email("tmpl-owner-" + UUID.randomUUID() + "@test.com")
                .passwordHash("pass")
                .verified(true)
                .build());

        project = projectService.createProject(owner.getEmail(),
                new CreateProjectRequest("Template Test Project", "Testing project templates",
                        "React", "Spring Boot", "PostgreSQL", "JUnit 5", LocalDate.now().plusMonths(3)));
    }

    @Test
    @DisplayName("GET /api/templates: confirms all 5 templates appear with correct module and task counts")
    void testGetTemplatesList() {
        TemplateListResponse response = projectTemplateService.getTemplates();

        assertThat(response).isNotNull();
        assertThat(response.templates()).hasSize(5);

        List<String> expectedKeys = List.of(
                "library-management",
                "hospital-management",
                "e-commerce-website",
                "student-management",
                "portfolio-website"
        );

        List<String> actualKeys = response.templates().stream().map(TemplateSummary::key).toList();
        assertThat(actualKeys).containsExactlyInAnyOrderElementsOf(expectedKeys);

        for (TemplateSummary summary : response.templates()) {
            assertThat(summary.moduleCount()).isGreaterThanOrEqualTo(3);
            assertThat(summary.taskCount()).isGreaterThan(0);
            assertThat(summary.description()).isNotBlank();
        }
    }

    @Test
    @DisplayName("Apply 'E-Commerce Website' template -> task count matches /api/templates reported count and tasks exist in Backlog")
    void testApplyEcommerceTemplate() {
        // 1. Get reported task count from templates
        TemplateListResponse templates = projectTemplateService.getTemplates();
        TemplateSummary ecommerceSummary = templates.templates().stream()
                .filter(t -> "e-commerce-website".equals(t.key()))
                .findFirst()
                .orElseThrow();
        int expectedTaskCount = ecommerceSummary.taskCount();

        // 2. Apply template to project
        ApplyTemplateResponse applyResponse = projectTemplateService.applyTemplate(project.id(), "e-commerce-website");

        assertThat(applyResponse.createdCount()).isEqualTo(expectedTaskCount);
        assertThat(applyResponse.taskIds()).hasSize(expectedTaskCount);

        // 3. GET project tasks and confirm count matches exactly
        List<TaskResponse> projectTasks = taskService.getTasksForProject(project.id());
        assertThat(projectTasks).hasSize(expectedTaskCount);

        // Confirm all tasks start in "Backlog"
        assertThat(projectTasks).extracting(TaskResponse::status).containsOnly("Backlog");
    }

    @Test
    @DisplayName("Apply template using an invalid/unknown templateKey -> clear 404 NotFoundException")
    void testApplyInvalidTemplateKey_throwsNotFound() {
        assertThatThrownBy(() -> projectTemplateService.applyTemplate(project.id(), "non-existent-template-key"))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Template not found: non-existent-template-key");
    }
}
