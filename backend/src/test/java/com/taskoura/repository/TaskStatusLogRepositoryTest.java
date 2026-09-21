package com.taskoura.repository;

import com.taskoura.entity.Project;
import com.taskoura.entity.Task;
import com.taskoura.entity.TaskStatusLog;
import com.taskoura.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class TaskStatusLogRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private TaskStatusLogRepository taskStatusLogRepository;

    private Task task;
    private User user;

    @BeforeEach
    void setUp() {
        user = entityManager.persistAndFlush(User.builder()
                .name("Changer")
                .email("changer@example.com")
                .passwordHash("hash")
                .verified(true)
                .build());

        Project project = entityManager.persistAndFlush(Project.builder()
                .name("Proj")
                .owner(user)
                .build());

        task = entityManager.persistAndFlush(Task.builder()
                .project(project)
                .title("Test Task")
                .status("Backlog")
                .build());

        entityManager.clear();
    }

    @Test
    @DisplayName("findByTaskIdOrderByChangedAtAsc returns logs in chronological order")
    void findByTaskIdOrderByChangedAtAsc() {
        TaskStatusLog log1 = TaskStatusLog.builder()
                .task(task)
                .changedBy(user)
                .fromStatus("Backlog")
                .toStatus("InProgress")
                .changedAt(LocalDateTime.now().minusHours(2))
                .build();

        TaskStatusLog log2 = TaskStatusLog.builder()
                .task(task)
                .changedBy(user)
                .fromStatus("InProgress")
                .toStatus("Testing")
                .changedAt(LocalDateTime.now().minusHours(1))
                .build();

        taskStatusLogRepository.save(log1);
        taskStatusLogRepository.save(log2);
        entityManager.flush();
        entityManager.clear();

        List<TaskStatusLog> logs = taskStatusLogRepository.findByTaskIdOrderByChangedAtAsc(task.getId());
        assertThat(logs).hasSize(2);
        assertThat(logs.get(0).getFromStatus()).isEqualTo("Backlog");
        assertThat(logs.get(0).getToStatus()).isEqualTo("InProgress");
        assertThat(logs.get(1).getFromStatus()).isEqualTo("InProgress");
        assertThat(logs.get(1).getToStatus()).isEqualTo("Testing");
    }
}
