package com.taskoura.service;

import com.taskoura.dto.BugDtos.CreateBugRequest;
import com.taskoura.dto.BugDtos.BugResponse;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.dto.TaskDtos.CreateTaskRequest;
import com.taskoura.dto.TaskDtos.TaskResponse;
import com.taskoura.dto.TestCaseDtos.CreateTestCaseRequest;
import com.taskoura.dto.TestCaseDtos.TestCaseResponse;
import com.taskoura.entity.User;
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

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class BugAndTestCaseIntegrationTest {

    @Autowired
    private BugService bugService;

    @Autowired
    private TestCaseService testCaseService;

    @Autowired
    private TaskService taskService;

    @Autowired
    private ProjectService projectService;

    @Autowired
    private UserRepository userRepository;

    private User testerUser;
    private TaskResponse task;

    @BeforeEach
    void setUp() {
        testerUser = userRepository.save(User.builder()
                .name("QA Engineer")
                .email("qa-" + UUID.randomUUID() + "@example.com")
                .passwordHash("pass")
                .verified(true)
                .build());

        ProjectResponse project = projectService.createProject(
                testerUser.getEmail(),
                new CreateProjectRequest("QA Project", "Desc", "React", "Spring", "PG", "JUnit", LocalDate.now().plusMonths(1))
        );

        task = taskService.createTask(
                project.id(),
                new CreateTaskRequest("Buggy Feature", "Feature description", "Frontend", "High", testerUser.getId(), LocalDate.now().plusDays(5))
        );
    }

    @Test
    @DisplayName("End-to-End: report a bug, resolve it, confirm status and resolvedAt updated")
    void bugLifecycle() {
        CreateBugRequest createBugReq = new CreateBugRequest("Critical", "UI freezes on modal close", null);
        BugResponse reportedBug = bugService.createBug(task.id(), createBugReq, testerUser.getEmail());

        assertThat(reportedBug).isNotNull();
        assertThat(reportedBug.status()).isEqualTo("Open");
        assertThat(reportedBug.severity()).isEqualTo("Critical");
        assertThat(reportedBug.resolvedAt()).isNull();

        // Resolve bug
        BugResponse resolvedBug = bugService.resolveBug(reportedBug.id());
        assertThat(resolvedBug.status()).isEqualTo("Resolved");
        assertThat(resolvedBug.resolvedAt()).isNotNull();

        // GET bugs for task
        List<BugResponse> bugs = bugService.getBugsForTask(task.id());
        assertThat(bugs).hasSize(1);
        assertThat(bugs.get(0).status()).isEqualTo("Resolved");
        assertThat(bugs.get(0).resolvedAt()).isNotNull();
    }

    @Test
    @DisplayName("End-to-End: record test case with passed=false, then passed=true, verify in GET")
    void testCaseExecutionLifecycle() {
        CreateTestCaseRequest failCase = new CreateTestCaseRequest("Verify unauthorized access", "401 Unauthorized", false);
        CreateTestCaseRequest passCase = new CreateTestCaseRequest("Verify authorized login", "200 OK + JWT", true);

        testCaseService.createTestCase(task.id(), failCase, testerUser.getEmail());
        testCaseService.createTestCase(task.id(), passCase, testerUser.getEmail());

        List<TestCaseResponse> testCases = testCaseService.getTestCasesForTask(task.id());
        assertThat(testCases).hasSize(2);
        assertThat(testCases.get(0).description()).isEqualTo("Verify unauthorized access");
        assertThat(testCases.get(0).passed()).isFalse();
        assertThat(testCases.get(1).description()).isEqualTo("Verify authorized login");
        assertThat(testCases.get(1).passed()).isTrue();
    }
}
