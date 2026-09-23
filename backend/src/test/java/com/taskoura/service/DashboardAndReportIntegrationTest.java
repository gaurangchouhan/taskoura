package com.taskoura.service;

import com.taskoura.dto.DashboardReportDtos.*;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.dto.ProjectMemberDtos.InviteMemberRequest;
import com.taskoura.dto.TaskDtos.CreateTaskRequest;
import com.taskoura.dto.TaskDtos.TaskResponse;
import com.taskoura.entity.*;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DashboardAndReportIntegrationTest {

    @Autowired private DashboardReportService dashboardReportService;
    @Autowired private ProjectService projectService;
    @Autowired private ProjectMemberService projectMemberService;
    @Autowired private TaskService taskService;
    @Autowired private UserRepository userRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskStatusLogRepository taskStatusLogRepository;
    @Autowired private BugRepository bugRepository;
    @Autowired private TestCaseRepository testCaseRepository;

    private User owner;
    private User dev1;
    private User dev2;
    private ProjectResponse project;

    @BeforeEach
    void setUp() {
        owner = userRepository.save(User.builder()
                .name("Alice Owner")
                .email("owner-dash-" + UUID.randomUUID() + "@test.com")
                .passwordHash("pass")
                .verified(true)
                .build());

        dev1 = userRepository.save(User.builder()
                .name("Bob Dev")
                .email("dev1-dash-" + UUID.randomUUID() + "@test.com")
                .passwordHash("pass")
                .verified(true)
                .build());

        dev2 = userRepository.save(User.builder()
                .name("Charlie Dev")
                .email("dev2-dash-" + UUID.randomUUID() + "@test.com")
                .passwordHash("pass")
                .verified(true)
                .build());

        project = projectService.createProject(owner.getEmail(),
                new CreateProjectRequest("Analytics Test Project", "Testing dashboard and reports",
                        "React", "Spring Boot", "PostgreSQL", "JUnit 5", LocalDate.now().plusMonths(2)));

        projectMemberService.inviteMember(project.id(), new InviteMemberRequest(dev1.getEmail(), "Member"));
        projectMemberService.inviteMember(project.id(), new InviteMemberRequest(dev2.getEmail(), "Member"));
    }

    @Test
    @DisplayName("End-to-end: Dashboard numbers and upcoming deadlines match raw database data")
    void testDashboardMetrics() {
        LocalDate today = LocalDate.now();

        // Task 1: Dev1 - Completed
        TaskResponse t1 = taskService.createTask(project.id(),
                new CreateTaskRequest("Setup CI", "CI pipeline", "Backend", "High", dev1.getId(), today.plusDays(10)));
        Task entity1 = taskRepository.findById(t1.id()).orElseThrow();
        entity1.setStatus("Completed");
        entity1.setCompletedAt(today.atTime(10, 0));
        taskRepository.save(entity1);

        // Task 2: Dev1 - InProgress (due in 5 days)
        TaskResponse t2 = taskService.createTask(project.id(),
                new CreateTaskRequest("Build API", "REST endpoints", "Backend", "High", dev1.getId(), today.plusDays(5)));
        Task entity2 = taskRepository.findById(t2.id()).orElseThrow();
        entity2.setStatus("InProgress");
        taskRepository.save(entity2);

        // Task 3: Dev2 - Backlog (due in 2 days)
        TaskResponse t3 = taskService.createTask(project.id(),
                new CreateTaskRequest("Design DB", "Schema migrations", "Database", "Medium", dev2.getId(), today.plusDays(2)));

        DashboardResponse dashboard = dashboardReportService.getDashboard(project.id());

        assertThat(dashboard.totalTasks()).isEqualTo(3);
        assertThat(dashboard.completedTasks()).isEqualTo(1);
        assertThat(dashboard.completionPercentage()).isEqualTo(33.33);

        assertThat(dashboard.tasksByStatus().get("Completed")).isEqualTo(1L);
        assertThat(dashboard.tasksByStatus().get("InProgress")).isEqualTo(1L);
        assertThat(dashboard.tasksByStatus().get("Backlog")).isEqualTo(1L);

        // Upcoming deadlines: only t3 (due in 2 days) and t2 (due in 5 days), sorted ascending
        assertThat(dashboard.upcomingDeadlines()).hasSize(2);
        assertThat(dashboard.upcomingDeadlines().get(0).title()).isEqualTo("Design DB");
        assertThat(dashboard.upcomingDeadlines().get(1).title()).isEqualTo("Build API");
    }

    @Test
    @DisplayName("End-to-end: Mixed on-time, late, and reworked tasks calculate exact report metrics; non-owner call returns 403")
    void testPerformanceReportMetricsAndSecurity() {
        LocalDate today = LocalDate.now();
        Project projectEntity = projectService.getProjectEntityOrThrow(project.id());

        // 1. Task 1 (Dev1): on-time completion (deadline 10 days ago, completed 10 days ago)
        LocalDate deadline1 = today.minusDays(10);
        Task t1 = taskRepository.save(Task.builder()
                .project(projectEntity)
                .title("Task 1 - On Time")
                .assignedTo(dev1)
                .status("Completed")
                .deadline(deadline1)
                .completedAt(deadline1.atTime(12, 0))
                .build());

        // 2. Task 2 (Dev1): late completion (deadline 6 days ago, completed 3 days ago -> 3 days late)
        LocalDate deadline2 = today.minusDays(6);
        Task t2 = taskRepository.save(Task.builder()
                .project(projectEntity)
                .title("Task 2 - Late 3 days")
                .assignedTo(dev1)
                .status("Completed")
                .deadline(deadline2)
                .completedAt(deadline2.plusDays(3).atTime(15, 0))
                .build());

        // 3. Task 3 (Dev1): late completion (deadline 8 days ago, completed 2 days ago -> 6 days late)
        LocalDate deadline3 = today.minusDays(8);
        Task t3 = taskRepository.save(Task.builder()
                .project(projectEntity)
                .title("Task 3 - Late 6 days")
                .assignedTo(dev1)
                .status("Completed")
                .deadline(deadline3)
                .completedAt(deadline3.plusDays(6).atTime(18, 0))
                .build());

        // 4. Task 4 (Dev1): reworked task with 2 backward transitions
        Task t4 = taskRepository.save(Task.builder()
                .project(projectEntity)
                .title("Task 4 - Reworked")
                .assignedTo(dev1)
                .status("Testing")
                .deadline(today.plusDays(5))
                .build());

        taskStatusLogRepository.save(TaskStatusLog.builder().task(t4).changedBy(dev1).fromStatus("Backlog").toStatus("InProgress").build());
        taskStatusLogRepository.save(TaskStatusLog.builder().task(t4).changedBy(dev1).fromStatus("InProgress").toStatus("Testing").build());
        taskStatusLogRepository.save(TaskStatusLog.builder().task(t4).changedBy(owner).fromStatus("Testing").toStatus("InProgress").build()); // Rework 1
        taskStatusLogRepository.save(TaskStatusLog.builder().task(t4).changedBy(dev1).fromStatus("InProgress").toStatus("Testing").build());
        taskStatusLogRepository.save(TaskStatusLog.builder().task(t4).changedBy(owner).fromStatus("Testing").toStatus("InProgress").build()); // Rework 2

        // 5. Bugs for Dev1:
        // Bug 1 resolved in 4 hours
        LocalDateTime now = LocalDateTime.now();
        bugRepository.save(Bug.builder()
                .task(t1)
                .assignedTo(dev1)
                .reportedBy(owner)
                .description("Bug 1")
                .status("Resolved")
                .createdAt(now.minusHours(6))
                .resolvedAt(now.minusHours(2))
                .build()); // 4.0 hours

        // Bug 2 resolved in 6 hours
        bugRepository.save(Bug.builder()
                .task(t2)
                .assignedTo(dev1)
                .reportedBy(owner)
                .description("Bug 2")
                .status("Resolved")
                .createdAt(now.minusHours(10))
                .resolvedAt(now.minusHours(4))
                .build()); // 6.0 hours

        // Bug 3 still Open
        bugRepository.save(Bug.builder()
                .task(t3)
                .assignedTo(dev1)
                .reportedBy(owner)
                .description("Bug 3")
                .status("Open")
                .createdAt(now.minusHours(1))
                .build());

        // 6. TestCases executed by Dev1:
        testCaseRepository.save(TestCase.builder().task(t1).executedBy(dev1).description("TC1").expectedResult("Pass").passed(true).build());
        testCaseRepository.save(TestCase.builder().task(t2).executedBy(dev1).description("TC2").expectedResult("Pass").passed(true).build());
        testCaseRepository.save(TestCase.builder().task(t3).executedBy(dev1).description("TC3").expectedResult("Pass").passed(false).build());

        // CALL AS OWNER -> SUCCESS (Verify calculations against manually counted data)
        List<MemberPerformanceReport> reports = dashboardReportService.getPerformanceReport(project.id(), owner.getEmail());

        assertThat(reports).isNotEmpty();
        MemberPerformanceReport dev1Report = reports.stream()
                .filter(r -> r.userId().equals(dev1.getId()))
                .findFirst()
                .orElseThrow();

        assertThat(dev1Report.tasksAssigned()).isEqualTo(4);
        assertThat(dev1Report.tasksCompleted()).isEqualTo(3);
        assertThat(dev1Report.onTimeCompletions()).isEqualTo(1);
        assertThat(dev1Report.lateCompletions()).isEqualTo(2);
        // Delay: Task 2 is 3 days late, Task 3 is 6 days late. Total delay = 9 days. Average delay = 9 / 2 = 4.5 days.
        assertThat(dev1Report.averageDelayDays()).isEqualTo(4.5);
        // Rework: 2 backward transitions on Task 4
        assertThat(dev1Report.reworkCount()).isEqualTo(2);
        // Bugs: 3 assigned, 2 fixed, avg turnaround = (4.0 + 6.0) / 2 = 5.0 hours
        assertThat(dev1Report.bugsAssigned()).isEqualTo(3);
        assertThat(dev1Report.bugsFixed()).isEqualTo(2);
        assertThat(dev1Report.avgBugTurnaroundHours()).isEqualTo(5.0);
        // Test cases: 3 executed, 2 passed
        assertThat(dev1Report.testCasesExecuted()).isEqualTo(3);
        assertThat(dev1Report.testCasesPassed()).isEqualTo(2);

        // CALL AS NON-OWNER MEMBER -> EXPECT 403 FORBIDDEN
        assertThatThrownBy(() -> dashboardReportService.getPerformanceReport(project.id(), dev1.getEmail()))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Only the project owner can access the performance report");
    }
}
