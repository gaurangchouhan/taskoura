package com.taskoura.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ProjectEntityTest {

    @Test
    @DisplayName("Project builder sets fields and default createdAt")
    void projectBuilder_defaultsAndFields() {
        User owner = User.builder()
                .id(UUID.randomUUID())
                .email("owner@example.com")
                .name("Project Owner")
                .build();

        LocalDate deadline = LocalDate.now().plusMonths(3);

        Project project = Project.builder()
                .id(UUID.randomUUID())
                .name("Taskoura Core")
                .description("Agile PM platform")
                .frontendStack("React")
                .backendStack("Spring Boot")
                .databaseStack("PostgreSQL")
                .testingStack("JUnit 5")
                .owner(owner)
                .deadline(deadline)
                .build();

        assertThat(project.getId()).isNotNull();
        assertThat(project.getName()).isEqualTo("Taskoura Core");
        assertThat(project.getDescription()).isEqualTo("Agile PM platform");
        assertThat(project.getFrontendStack()).isEqualTo("React");
        assertThat(project.getBackendStack()).isEqualTo("Spring Boot");
        assertThat(project.getDatabaseStack()).isEqualTo("PostgreSQL");
        assertThat(project.getTestingStack()).isEqualTo("JUnit 5");
        assertThat(project.getOwner()).isEqualTo(owner);
        assertThat(project.getDeadline()).isEqualTo(deadline);
        assertThat(project.getCreatedAt()).isNotNull();
        assertThat(project.getCreatedAt()).isBeforeOrEqualTo(LocalDateTime.now());
    }

    @Test
    @DisplayName("Project no-args constructor and setters work")
    void project_noArgsAndSetters() {
        Project project = new Project();
        UUID id = UUID.randomUUID();
        User owner = new User();
        LocalDate deadline = LocalDate.now().plusWeeks(2);
        LocalDateTime now = LocalDateTime.now();

        project.setId(id);
        project.setName("Custom Project");
        project.setDescription("Custom Desc");
        project.setFrontendStack("Vue");
        project.setBackendStack("Go");
        project.setDatabaseStack("MySQL");
        project.setTestingStack("Testify");
        project.setOwner(owner);
        project.setDeadline(deadline);
        project.setCreatedAt(now);

        assertThat(project.getId()).isEqualTo(id);
        assertThat(project.getName()).isEqualTo("Custom Project");
        assertThat(project.getDescription()).isEqualTo("Custom Desc");
        assertThat(project.getFrontendStack()).isEqualTo("Vue");
        assertThat(project.getBackendStack()).isEqualTo("Go");
        assertThat(project.getDatabaseStack()).isEqualTo("MySQL");
        assertThat(project.getTestingStack()).isEqualTo("Testify");
        assertThat(project.getOwner()).isEqualTo(owner);
        assertThat(project.getDeadline()).isEqualTo(deadline);
        assertThat(project.getCreatedAt()).isEqualTo(now);
    }
}
