package com.taskoura.repository;

import com.taskoura.entity.Project;
import com.taskoura.entity.Task;
import com.taskoura.entity.TestCase;
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
class TestCaseRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private TestCaseRepository testCaseRepository;

    private Task task;
    private User tester;

    @BeforeEach
    void setUp() {
        tester = entityManager.persistAndFlush(User.builder()
                .name("Tester User")
                .email("tester-tc-test@example.com")
                .passwordHash("hash")
                .verified(true)
                .build());

        Project project = entityManager.persistAndFlush(Project.builder()
                .name("Test Project")
                .owner(tester)
                .build());

        task = entityManager.persistAndFlush(Task.builder()
                .project(project)
                .title("Test Task")
                .build());

        entityManager.clear();
    }

    @Test
    @DisplayName("save and findByTaskIdOrderByExecutedAtAsc returns test cases")
    void saveAndFindByTaskId() {
        TestCase tc1 = TestCase.builder()
                .task(task)
                .description("Check 401 when unauthenticated")
                .expectedResult("HTTP 401")
                .passed(true)
                .executedBy(tester)
                .build();

        TestCase tc2 = TestCase.builder()
                .task(task)
                .description("Check SQL injection")
                .expectedResult("Escaped properly")
                .passed(false)
                .executedBy(tester)
                .build();

        testCaseRepository.save(tc1);
        testCaseRepository.save(tc2);
        entityManager.flush();
        entityManager.clear();

        List<TestCase> cases = testCaseRepository.findByTaskIdOrderByExecutedAtAsc(task.getId());
        assertThat(cases).hasSize(2);
        assertThat(cases.get(0).getDescription()).isEqualTo("Check 401 when unauthenticated");
        assertThat(cases.get(0).isPassed()).isTrue();
        assertThat(cases.get(1).getDescription()).isEqualTo("Check SQL injection");
        assertThat(cases.get(1).isPassed()).isFalse();
    }
}
