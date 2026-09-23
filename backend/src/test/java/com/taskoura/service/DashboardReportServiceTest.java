package com.taskoura.service;

import com.taskoura.dto.DashboardReportDtos.*;
import com.taskoura.entity.*;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardReportServiceTest {

    @Mock private ProjectService projectService;
    @Mock private ProjectMemberRepository projectMemberRepository;
    @Mock private TaskRepository taskRepository;
    @Mock private TaskStatusLogRepository taskStatusLogRepository;
    @Mock private BugRepository bugRepository;
    @Mock private TestCaseRepository testCaseRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks private DashboardReportService dashboardReportService;

    private UUID projectId;
    private User owner;
    private User dev1;
    private Project project;
    private ProjectMember ownerMember;
    private ProjectMember dev1Member;

    @BeforeEach
    void setUp() {
        projectId = UUID.randomUUID();
        owner = User.builder().id(UUID.randomUUID()).name("Owner User").email("owner@example.com").build();
        dev1 = User.builder().id(UUID.randomUUID()).name("Dev One").email("dev1@example.com").build();

        project = Project.builder()
                .id(projectId)
                .name("Analytics Project")
                .owner(owner)
                .build();

        ownerMember = ProjectMember.builder()
                .id(UUID.randomUUID())
                .project(project)
                .user(owner)
                .role("Owner")
                .build();

        dev1Member = ProjectMember.builder()
                .id(UUID.randomUUID())
                .project(project)
                .user(dev1)
                .role("Member")
                .build();
    }

    @Test
    @DisplayName("getDashboard: correctly aggregates total, completed, percentage, status map, and upcoming deadlines")
    void getDashboard_aggregatesCorrectly() {
        Task t1 = Task.builder()
                .id(UUID.randomUUID())
                .project(project)
                .title("Task 1")
                .status("Completed")
                .assignedTo(dev1)
                .deadline(LocalDate.now().minusDays(1))
                .build();

        Task t2 = Task.builder()
                .id(UUID.randomUUID())
                .project(project)
                .title("Task 2")
                .status("InProgress")
                .assignedTo(dev1)
                .deadline(LocalDate.now().plusDays(5))
                .priority("High")
                .build();

        Task t3 = Task.builder()
                .id(UUID.randomUUID())
                .project(project)
                .title("Task 3")
                .status("Backlog")
                .assignedTo(owner)
                .deadline(LocalDate.now().plusDays(2))
                .priority("Medium")
                .build();

        Task t4 = Task.builder()
                .id(UUID.randomUUID())
                .project(project)
                .title("Task 4 without deadline")
                .status("Testing")
                .assignedTo(null)
                .deadline(null)
                .build();

        when(projectService.getProjectEntityOrThrow(projectId)).thenReturn(project);
        when(taskRepository.findByProjectId(projectId)).thenReturn(List.of(t1, t2, t3, t4));
        when(projectMemberRepository.findByProjectId(projectId)).thenReturn(List.of(ownerMember, dev1Member));

        DashboardResponse response = dashboardReportService.getDashboard(projectId);

        assertThat(response).isNotNull();
        assertThat(response.totalTasks()).isEqualTo(4);
        assertThat(response.completedTasks()).isEqualTo(1);
        assertThat(response.completionPercentage()).isEqualTo(25.0);

        assertThat(response.tasksByStatus()).containsEntry("Completed", 1L);
        assertThat(response.tasksByStatus()).containsEntry("InProgress", 1L);
        assertThat(response.tasksByStatus()).containsEntry("Backlog", 1L);
        assertThat(response.tasksByStatus()).containsEntry("Testing", 1L);

        assertThat(response.tasksByMember()).hasSize(2);
        MemberTaskStats dev1Stats = response.tasksByMember().stream()
                .filter(s -> s.userId().equals(dev1.getId())).findFirst().orElseThrow();
        assertThat(dev1Stats.assignedTasks()).isEqualTo(2);
        assertThat(dev1Stats.completedTasks()).isEqualTo(1);

        // Upcoming deadlines should exclude completed (t1) and tasks with no deadline (t4)
        // t3 is due in 2 days, t2 is due in 5 days -> sorted t3, then t2
        assertThat(response.upcomingDeadlines()).hasSize(2);
        assertThat(response.upcomingDeadlines().get(0).title()).isEqualTo("Task 3");
        assertThat(response.upcomingDeadlines().get(1).title()).isEqualTo("Task 2");
    }

    @Test
    @DisplayName("getPerformanceReport: throws ForbiddenException when caller is not project owner")
    void getPerformanceReport_nonOwner_throwsForbidden() {
        when(projectService.getProjectEntityOrThrow(projectId)).thenReturn(project);
        when(userRepository.findByEmail("dev1@example.com")).thenReturn(Optional.of(dev1));
        when(projectMemberRepository.findByProjectIdAndUserId(projectId, dev1.getId()))
                .thenReturn(Optional.of(dev1Member));

        assertThatThrownBy(() -> dashboardReportService.getPerformanceReport(projectId, "dev1@example.com"))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Only the project owner can access the performance report");
    }

    @Test
    @DisplayName("getPerformanceReport: owner access returns accurate metrics for on-time, late, rework, bugs, and tests")
    void getPerformanceReport_ownerAccess_accurateMetrics() {
        // Dev1 tasks:
        // Task 1: On-time (completed on deadline)
        LocalDate deadline1 = LocalDate.now().minusDays(5);
        Task t1 = Task.builder()
                .id(UUID.randomUUID())
                .project(project)
                .title("Task 1")
                .status("Completed")
                .assignedTo(dev1)
                .deadline(deadline1)
                .completedAt(deadline1.atTime(14, 0))
                .build();

        // Task 2: Late (deadline was 10 days ago, completed 6 days ago -> 4 delay days)
        LocalDate deadline2 = LocalDate.now().minusDays(10);
        Task t2 = Task.builder()
                .id(UUID.randomUUID())
                .project(project)
                .title("Task 2")
                .status("Completed")
                .assignedTo(dev1)
                .deadline(deadline2)
                .completedAt(deadline2.plusDays(4).atTime(17, 30))
                .build();

        // Task 3: InProgress, reworked twice (Testing -> InProgress, Completed -> Testing)
        Task t3 = Task.builder()
                .id(UUID.randomUUID())
                .project(project)
                .title("Task 3")
                .status("InProgress")
                .assignedTo(dev1)
                .deadline(LocalDate.now().plusDays(2))
                .build();

        // Status logs for t3:
        TaskStatusLog log1 = TaskStatusLog.builder().id(UUID.randomUUID()).task(t3)
                .fromStatus("Backlog").toStatus("InProgress").build(); // forward
        TaskStatusLog log2 = TaskStatusLog.builder().id(UUID.randomUUID()).task(t3)
                .fromStatus("InProgress").toStatus("Testing").build(); // forward
        TaskStatusLog log3 = TaskStatusLog.builder().id(UUID.randomUUID()).task(t3)
                .fromStatus("Testing").toStatus("InProgress").build(); // BACKWARD (rework 1)
        TaskStatusLog log4 = TaskStatusLog.builder().id(UUID.randomUUID()).task(t3)
                .fromStatus("InProgress").toStatus("Testing").build(); // forward
        TaskStatusLog log5 = TaskStatusLog.builder().id(UUID.randomUUID()).task(t3)
                .fromStatus("Completed").toStatus("Testing").build(); // BACKWARD (rework 2)

        // Bugs for dev1:
        // Bug 1: resolved in 3 hours
        LocalDateTime now = LocalDateTime.now();
        Bug b1 = Bug.builder()
                .id(UUID.randomUUID())
                .task(t1)
                .assignedTo(dev1)
                .status("Resolved")
                .createdAt(now.minusHours(5))
                .resolvedAt(now.minusHours(2))
                .build(); // 3 hours

        // Bug 2: resolved in 5 hours
        Bug b2 = Bug.builder()
                .id(UUID.randomUUID())
                .task(t2)
                .assignedTo(dev1)
                .status("Resolved")
                .createdAt(now.minusHours(10))
                .resolvedAt(now.minusHours(5))
                .build(); // 5 hours (avg = (3+5)/2 = 4.0)

        // Bug 3: open
        Bug b3 = Bug.builder()
                .id(UUID.randomUUID())
                .task(t3)
                .assignedTo(dev1)
                .status("Open")
                .createdAt(now.minusHours(1))
                .build();

        // Test cases executed by dev1:
        TestCase tc1 = TestCase.builder()
                .id(UUID.randomUUID())
                .task(t1)
                .executedBy(dev1)
                .passed(true)
                .build();

        TestCase tc2 = TestCase.builder()
                .id(UUID.randomUUID())
                .task(t2)
                .executedBy(dev1)
                .passed(false)
                .build();

        when(projectService.getProjectEntityOrThrow(projectId)).thenReturn(project);
        when(userRepository.findByEmail("owner@example.com")).thenReturn(Optional.of(owner));
        when(projectMemberRepository.findByProjectId(projectId)).thenReturn(List.of(ownerMember, dev1Member));
        when(taskRepository.findByProjectId(projectId)).thenReturn(List.of(t1, t2, t3));
        when(taskStatusLogRepository.findByTaskProjectId(projectId)).thenReturn(List.of(log1, log2, log3, log4, log5));
        when(bugRepository.findByTaskProjectId(projectId)).thenReturn(List.of(b1, b2, b3));
        when(testCaseRepository.findByTaskProjectId(projectId)).thenReturn(List.of(tc1, tc2));

        List<MemberPerformanceReport> reports = dashboardReportService.getPerformanceReport(projectId, "owner@example.com");

        assertThat(reports).hasSize(2);
        MemberPerformanceReport dev1Report = reports.stream()
                .filter(r -> r.userId().equals(dev1.getId()))
                .findFirst()
                .orElseThrow();

        assertThat(dev1Report.tasksAssigned()).isEqualTo(3);
        assertThat(dev1Report.tasksCompleted()).isEqualTo(2);
        assertThat(dev1Report.onTimeCompletions()).isEqualTo(1);
        assertThat(dev1Report.lateCompletions()).isEqualTo(1);
        assertThat(dev1Report.averageDelayDays()).isEqualTo(4.0);
        assertThat(dev1Report.reworkCount()).isEqualTo(2);
        assertThat(dev1Report.bugsAssigned()).isEqualTo(3);
        assertThat(dev1Report.bugsFixed()).isEqualTo(2);
        assertThat(dev1Report.avgBugTurnaroundHours()).isEqualTo(4.0);
        assertThat(dev1Report.testCasesExecuted()).isEqualTo(2);
        assertThat(dev1Report.testCasesPassed()).isEqualTo(1);
    }
}
