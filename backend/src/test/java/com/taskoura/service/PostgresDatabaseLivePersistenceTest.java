package com.taskoura.service;

import com.taskoura.dto.BugDtos.CreateBugRequest;
import com.taskoura.dto.CommentDtos.CreateCommentRequest;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.dto.TaskDtos.CreateTaskRequest;
import com.taskoura.dto.TaskDtos.TaskResponse;
import com.taskoura.dto.TaskDtos.UpdateTaskStatusRequest;
import com.taskoura.dto.TestCaseDtos.CreateTestCaseRequest;
import com.taskoura.entity.User;
import com.taskoura.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-End PostgreSQL Live Persistence Test.
 *
 * NOTE: This test does NOT use @Transactional rollback so that all entities,
 * projects, tasks, status logs, comments, bugs, test cases, and activity logs
 * are physically committed and preserved in the real PostgreSQL database (taskoura).
 */
@SpringBootTest
class PostgresDatabaseLivePersistenceTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProjectService projectService;

    @Autowired
    private TaskService taskService;

    @Autowired
    private CommentService commentService;

    @Autowired
    private BugService bugService;

    @Autowired
    private TestCaseService testCaseService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Verify PostgreSQL database connection and persist full application workflow")
    void testAndPersistWorkflowInPostgres() {
        // 1. Verify direct JDBC connectivity to PostgreSQL
        String currentDb = jdbcTemplate.queryForObject("SELECT current_database()", String.class);
        String pgVersion = jdbcTemplate.queryForObject("SELECT version()", String.class);
        assertThat(currentDb).isEqualTo("taskoura");
        assertThat(pgVersion).contains("PostgreSQL");

        // 2. Persist a verified User in PostgreSQL
        String uniqueId = UUID.randomUUID().toString().substring(0, 8);
        String email = "engineer." + uniqueId + "@taskoura.io";
        User user = userRepository.save(User.builder()
                .name("Postgres Test Engineer " + uniqueId)
                .email(email)
                .passwordHash(passwordEncoder.encode("SecurePass123!"))
                .verified(true)
                .build());

        assertThat(user.getId()).isNotNull();

        // Direct SQL check
        Integer userCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM users WHERE email = ?", Integer.class, email
        );
        assertThat(userCount).isEqualTo(1);

        // 3. Persist a Project in PostgreSQL
        CreateProjectRequest projectReq = new CreateProjectRequest(
                "PostgreSQL Verified Project " + uniqueId,
                "Demonstrating live transactional persistence in Taskoura PostgreSQL DB",
                "React + TypeScript + Tailwind",
                "Spring Boot 3.4 + Java 21",
                "PostgreSQL 16",
                "JUnit 5 + Mockito + AssertJ",
                LocalDate.now().plusMonths(2)
        );

        ProjectResponse project = projectService.createProject(email, projectReq);
        assertThat(project.id()).isNotNull();

        // Direct SQL check for project and project_members
        Integer projectCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM projects WHERE id = ?", Integer.class, project.id()
        );
        assertThat(projectCount).isEqualTo(1);

        Integer memberCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM project_members WHERE project_id = ? AND user_id = ?",
                Integer.class, project.id(), user.getId()
        );
        assertThat(memberCount).isEqualTo(1);

        // 4. Persist Tasks in PostgreSQL
        CreateTaskRequest taskReq1 = new CreateTaskRequest(
                "Live Postgres Task: " + uniqueId,
                "Ensuring tasks are physically written to database",
                "Database",
                "High",
                user.getId(),
                LocalDate.now().plusDays(10)
        );
        TaskResponse task1 = taskService.createTask(project.id(), taskReq1);
        assertThat(task1.id()).isNotNull();

        CreateTaskRequest taskReq2 = new CreateTaskRequest(
                "Frontend API Integration: " + uniqueId,
                "Connect React frontend with PostgreSQL backend",
                "Frontend",
                "Medium",
                user.getId(),
                LocalDate.now().plusDays(14)
        );
        TaskResponse task2 = taskService.createTask(project.id(), taskReq2);
        assertThat(task2.id()).isNotNull();

        // Direct SQL check for tasks
        Integer taskCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM tasks WHERE project_id = ?", Integer.class, project.id()
        );
        assertThat(taskCount).isEqualTo(2);

        // 5. Update Task Status -> creates TaskStatusLog in PostgreSQL
        taskService.updateStatus(task1.id(), new UpdateTaskStatusRequest("InProgress"), email);
        taskService.updateStatus(task1.id(), new UpdateTaskStatusRequest("Completed"), email);

        Integer logCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM task_status_logs WHERE task_id = ?", Integer.class, task1.id()
        );
        assertThat(logCount).isEqualTo(2);

        // 6. Persist a Comment on Task
        commentService.addComment(task1.id(), new CreateCommentRequest("Task completed and verified in PostgreSQL!"), email);

        Integer commentCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM comments WHERE task_id = ?", Integer.class, task1.id()
        );
        assertThat(commentCount).isEqualTo(1);

        // 7. Persist a Bug in PostgreSQL
        CreateBugRequest bugReq = new CreateBugRequest(
                "High",
                "Edge case verified in DB: " + uniqueId,
                user.getId()
        );
        bugService.createBug(task1.id(), bugReq, email);

        Integer bugCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM bugs WHERE task_id = ?", Integer.class, task1.id()
        );
        assertThat(bugCount).isEqualTo(1);

        // 8. Persist a Test Case in PostgreSQL
        CreateTestCaseRequest testCaseReq = new CreateTestCaseRequest(
                "Verify DB Persistence " + uniqueId,
                "All rows present in taskoura DB",
                true
        );
        testCaseService.createTestCase(task1.id(), testCaseReq, email);

        Integer testCaseCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM test_cases WHERE task_id = ?", Integer.class, task1.id()
        );
        assertThat(testCaseCount).isEqualTo(1);

        // 9. Verify Activity Logs in PostgreSQL
        Integer activityCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM activity_logs WHERE project_id = ?", Integer.class, project.id()
        );
        assertThat(activityCount).isGreaterThanOrEqualTo(3);

        System.out.println("==================================================================");
        System.out.println(">>> POSTGRESQL LIVE PERSISTENCE VERIFIED SUCCESSFULLY <<<");
        System.out.println("Database Name: " + currentDb);
        System.out.println("Committed User: " + email + " (" + user.getId() + ")");
        System.out.println("Committed Project: " + project.name() + " (" + project.id() + ")");
        System.out.println("Committed Tasks: " + taskCount);
        System.out.println("Committed Task Status Logs: " + logCount);
        System.out.println("Committed Comments: " + commentCount);
        System.out.println("Committed Bugs: " + bugCount);
        System.out.println("Committed Test Cases: " + testCaseCount);
        System.out.println("Committed Activity Logs: " + activityCount);
        System.out.println("==================================================================");
    }
}
