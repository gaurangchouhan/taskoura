package com.taskoura.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class TaskStatusLogEntityTest {

    @Test
    @DisplayName("TaskStatusLog builder sets defaults properly")
    void logBuilderDefaults() {
        Task task = Task.builder().id(UUID.randomUUID()).title("Task").build();
        User user = User.builder().id(UUID.randomUUID()).name("User").build();
        UUID id = UUID.randomUUID();

        TaskStatusLog log = TaskStatusLog.builder()
                .id(id)
                .task(task)
                .changedBy(user)
                .fromStatus("Backlog")
                .toStatus("InProgress")
                .build();

        assertThat(log.getId()).isEqualTo(id);
        assertThat(log.getTask()).isEqualTo(task);
        assertThat(log.getChangedBy()).isEqualTo(user);
        assertThat(log.getFromStatus()).isEqualTo("Backlog");
        assertThat(log.getToStatus()).isEqualTo("InProgress");
        assertThat(log.getChangedAt()).isNotNull();
    }

    @Test
    @DisplayName("TaskStatusLog setters work")
    void logSetters() {
        TaskStatusLog log = new TaskStatusLog();
        LocalDateTime now = LocalDateTime.now();
        log.setFromStatus("InProgress");
        log.setToStatus("Testing");
        log.setChangedAt(now);

        assertThat(log.getFromStatus()).isEqualTo("InProgress");
        assertThat(log.getToStatus()).isEqualTo("Testing");
        assertThat(log.getChangedAt()).isEqualTo(now);
    }
}
