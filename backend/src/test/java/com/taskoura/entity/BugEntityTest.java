package com.taskoura.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class BugEntityTest {

    @Test
    @DisplayName("Bug builder sets defaults: status=Open, createdAt not null, resolvedAt null")
    void bugBuilderDefaults() {
        Task task = Task.builder().id(UUID.randomUUID()).build();
        User reporter = User.builder().id(UUID.randomUUID()).name("Reporter").build();
        User assignee = User.builder().id(UUID.randomUUID()).name("Assignee").build();
        UUID bugId = UUID.randomUUID();

        Bug bug = Bug.builder()
                .id(bugId)
                .task(task)
                .reportedBy(reporter)
                .assignedTo(assignee)
                .description("Crash on submit")
                .severity("High")
                .build();

        assertThat(bug.getId()).isEqualTo(bugId);
        assertThat(bug.getTask()).isEqualTo(task);
        assertThat(bug.getReportedBy()).isEqualTo(reporter);
        assertThat(bug.getAssignedTo()).isEqualTo(assignee);
        assertThat(bug.getDescription()).isEqualTo("Crash on submit");
        assertThat(bug.getSeverity()).isEqualTo("High");
        assertThat(bug.getStatus()).isEqualTo("Open");
        assertThat(bug.getCreatedAt()).isNotNull();
        assertThat(bug.getResolvedAt()).isNull();
    }

    @Test
    @DisplayName("Bug setters work")
    void bugSetters() {
        Bug bug = new Bug();
        UUID id = UUID.randomUUID();
        LocalDateTime now = LocalDateTime.now();

        bug.setId(id);
        bug.setStatus("Resolved");
        bug.setResolvedAt(now);

        assertThat(bug.getId()).isEqualTo(id);
        assertThat(bug.getStatus()).isEqualTo("Resolved");
        assertThat(bug.getResolvedAt()).isEqualTo(now);
    }
}
