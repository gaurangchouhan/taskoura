package com.taskoura.repository;

import com.taskoura.entity.Bug;
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

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class BugRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private BugRepository bugRepository;

    private Task task;
    private User reporter;

    @BeforeEach
    void setUp() {
        reporter = entityManager.persistAndFlush(User.builder()
                .name("Bug Reporter")
                .email("reporter-bug-test@example.com")
                .passwordHash("hash")
                .verified(true)
                .build());

        Project project = entityManager.persistAndFlush(Project.builder()
                .name("Bug Project")
                .owner(reporter)
                .build());

        task = entityManager.persistAndFlush(Task.builder()
                .project(project)
                .title("Bug Task")
                .build());

        entityManager.clear();
    }

    @Test
    @DisplayName("save and findByTaskIdOrderByCreatedAtAsc returns bugs")
    void saveAndFindByTaskId() {
        Bug bug = Bug.builder()
                .task(task)
                .reportedBy(reporter)
                .description("NullPointerException on logout")
                .severity("Critical")
                .build();

        bugRepository.save(bug);
        entityManager.flush();
        entityManager.clear();

        List<Bug> bugs = bugRepository.findByTaskIdOrderByCreatedAtAsc(task.getId());
        assertThat(bugs).hasSize(1);
        assertThat(bugs.get(0).getDescription()).isEqualTo("NullPointerException on logout");
        assertThat(bugs.get(0).getSeverity()).isEqualTo("Critical");
        assertThat(bugs.get(0).getStatus()).isEqualTo("Open");
    }
}
