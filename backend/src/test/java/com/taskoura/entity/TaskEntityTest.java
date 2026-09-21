package com.taskoura.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class TaskEntityTest {

    @Test
    @DisplayName("Task builder sets defaults properly: status=Backlog, createdAt not null, completedAt null")
    void taskBuilderDefaults() {
        Project project = Project.builder().id(UUID.randomUUID()).name("Sample Project").build();
        User user = User.builder().id(UUID.randomUUID()).name("Assignee").email("assignee@example.com").build();
        UUID taskId = UUID.randomUUID();
        LocalDate deadline = LocalDate.now().plusWeeks(1);

        Task task = Task.builder()
                .id(taskId)
                .project(project)
                .assignedTo(user)
                .title("Implement Login")
                .description("Use JWT")
                .category("Backend")
                .priority("High")
                .deadline(deadline)
                .build();

        assertThat(task.getId()).isEqualTo(taskId);
        assertThat(task.getProject()).isEqualTo(project);
        assertThat(task.getAssignedTo()).isEqualTo(user);
        assertThat(task.getTitle()).isEqualTo("Implement Login");
        assertThat(task.getStatus()).isEqualTo("Backlog");
        assertThat(task.getCreatedAt()).isNotNull();
        assertThat(task.getCompletedAt()).isNull();
    }

    @Test
    @DisplayName("Task no-args constructor and setters work")
    void taskNoArgsAndSetters() {
        Task task = new Task();
        UUID id = UUID.randomUUID();
        LocalDateTime now = LocalDateTime.now();

        task.setId(id);
        task.setTitle("Design DB");
        task.setStatus("InProgress");
        task.setCompletedAt(now);

        assertThat(task.getId()).isEqualTo(id);
        assertThat(task.getTitle()).isEqualTo("Design DB");
        assertThat(task.getStatus()).isEqualTo("InProgress");
        assertThat(task.getCompletedAt()).isEqualTo(now);
    }
}
