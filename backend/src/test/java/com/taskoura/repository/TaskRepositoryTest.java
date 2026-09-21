package com.taskoura.repository;

import com.taskoura.entity.Project;
import com.taskoura.entity.Task;
import com.taskoura.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class TaskRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private TaskRepository taskRepository;

    private Project project;
    private User assignee;

    @BeforeEach
    void setUp() {
        User owner = entityManager.persistAndFlush(User.builder()
                .name("Project Owner")
                .email("task-owner@example.com")
                .passwordHash("hash")
                .verified(true)
                .build());

        assignee = entityManager.persistAndFlush(User.builder()
                .name("Assignee User")
                .email("assignee-user@example.com")
                .passwordHash("hash")
                .verified(true)
                .build());

        project = entityManager.persistAndFlush(Project.builder()
                .name("Task Test Project")
                .description("Project for testing tasks")
                .owner(owner)
                .deadline(LocalDate.now().plusMonths(1))
                .build());

        entityManager.clear();
    }

    @Test
    @DisplayName("save and findByProjectId returns project tasks")
    void saveAndFindByProjectId() {
        Task task1 = Task.builder()
                .project(project)
                .assignedTo(assignee)
                .title("Task 1")
                .description("Desc 1")
                .category("Backend")
                .priority("High")
                .status("Backlog")
                .deadline(LocalDate.now().plusDays(5))
                .build();

        Task task2 = Task.builder()
                .project(project)
                .title("Task 2")
                .description("Desc 2")
                .category("Frontend")
                .priority("Low")
                .status("InProgress")
                .build();

        taskRepository.save(task1);
        taskRepository.save(task2);
        entityManager.flush();
        entityManager.clear();

        List<Task> tasks = taskRepository.findByProjectId(project.getId());
        assertThat(tasks).hasSize(2);
        assertThat(tasks).extracting(Task::getTitle).containsExactlyInAnyOrder("Task 1", "Task 2");
    }
}
