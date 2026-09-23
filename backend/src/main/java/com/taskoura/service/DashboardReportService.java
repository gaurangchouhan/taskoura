package com.taskoura.service;

import com.taskoura.dto.DashboardReportDtos.*;
import com.taskoura.entity.*;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.*;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DashboardReportService {

    private static final Map<String, Integer> KANBAN_ORDER = Map.of(
            "backlog", 0,
            "inprogress", 1,
            "in progress", 1,
            "testing", 2,
            "completed", 3
    );

    private final ProjectService projectService;
    private final ProjectMemberRepository projectMemberRepository;
    private final TaskRepository taskRepository;
    private final TaskStatusLogRepository taskStatusLogRepository;
    private final BugRepository bugRepository;
    private final TestCaseRepository testCaseRepository;
    private final UserRepository userRepository;

    public DashboardReportService(ProjectService projectService,
                                  ProjectMemberRepository projectMemberRepository,
                                  TaskRepository taskRepository,
                                  TaskStatusLogRepository taskStatusLogRepository,
                                  BugRepository bugRepository,
                                  TestCaseRepository testCaseRepository,
                                  UserRepository userRepository) {
        this.projectService = projectService;
        this.projectMemberRepository = projectMemberRepository;
        this.taskRepository = taskRepository;
        this.taskStatusLogRepository = taskStatusLogRepository;
        this.bugRepository = bugRepository;
        this.testCaseRepository = testCaseRepository;
        this.userRepository = userRepository;
    }

    public DashboardResponse getDashboard(UUID projectId) {
        projectService.getProjectEntityOrThrow(projectId);

        List<Task> tasks = taskRepository.findByProjectId(projectId);
        List<ProjectMember> members = projectMemberRepository.findByProjectId(projectId);

        long totalTasks = tasks.size();
        long completedTasks = tasks.stream()
                .filter(t -> "Completed".equalsIgnoreCase(t.getStatus()))
                .count();

        double completionPercentage = totalTasks > 0
                ? Math.round(((double) completedTasks / totalTasks) * 10000.0) / 100.0
                : 0.0;

        Map<String, Long> tasksByStatus = new LinkedHashMap<>();
        tasksByStatus.put("Backlog", 0L);
        tasksByStatus.put("InProgress", 0L);
        tasksByStatus.put("Testing", 0L);
        tasksByStatus.put("Completed", 0L);

        for (Task task : tasks) {
            String status = task.getStatus() != null ? task.getStatus() : "Backlog";
            tasksByStatus.put(status, tasksByStatus.getOrDefault(status, 0L) + 1);
        }

        List<MemberTaskStats> tasksByMember = members.stream()
                .map(m -> {
                    UUID userId = m.getUser().getId();
                    long assigned = tasks.stream()
                            .filter(t -> t.getAssignedTo() != null && t.getAssignedTo().getId().equals(userId))
                            .count();
                    long completed = tasks.stream()
                            .filter(t -> t.getAssignedTo() != null && t.getAssignedTo().getId().equals(userId)
                                    && "Completed".equalsIgnoreCase(t.getStatus()))
                            .count();
                    return new MemberTaskStats(userId, m.getUser().getName(), assigned, completed);
                })
                .toList();

        List<UpcomingDeadlineTask> upcomingDeadlines = tasks.stream()
                .filter(t -> t.getDeadline() != null && !"Completed".equalsIgnoreCase(t.getStatus()))
                .sorted(Comparator.comparing(Task::getDeadline))
                .map(t -> new UpcomingDeadlineTask(
                        t.getId(),
                        t.getTitle(),
                        t.getDeadline(),
                        t.getStatus(),
                        t.getPriority(),
                        t.getAssignedTo() != null ? t.getAssignedTo().getId() : null,
                        t.getAssignedTo() != null ? t.getAssignedTo().getName() : null
                ))
                .toList();

        return new DashboardResponse(
                totalTasks,
                completedTasks,
                completionPercentage,
                tasksByStatus,
                tasksByMember,
                upcomingDeadlines
        );
    }

    public List<MemberPerformanceReport> getPerformanceReport(UUID projectId, String callerEmail) {
        Project project = projectService.getProjectEntityOrThrow(projectId);
        User caller = userRepository.findByEmail(callerEmail)
                .orElseThrow(() -> new NotFoundException("User not found"));

        boolean isOwner = (project.getOwner() != null && project.getOwner().getId().equals(caller.getId())) ||
                projectMemberRepository.findByProjectIdAndUserId(projectId, caller.getId())
                        .map(m -> "Owner".equalsIgnoreCase(m.getRole()))
                        .orElse(false);

        if (!isOwner) {
            throw new ForbiddenException("Only the project owner can access the performance report");
        }

        List<ProjectMember> members = projectMemberRepository.findByProjectId(projectId);
        List<Task> tasks = taskRepository.findByProjectId(projectId);
        List<TaskStatusLog> statusLogs = taskStatusLogRepository.findByTaskProjectId(projectId);
        List<Bug> bugs = bugRepository.findByTaskProjectId(projectId);
        List<TestCase> testCases = testCaseRepository.findByTaskProjectId(projectId);

        Map<UUID, List<TaskStatusLog>> logsByTaskId = statusLogs.stream()
                .collect(Collectors.groupingBy(log -> log.getTask().getId()));

        return members.stream().map(m -> {
            User u = m.getUser();
            UUID memberUserId = u.getId();

            List<Task> memberTasks = tasks.stream()
                    .filter(t -> t.getAssignedTo() != null && t.getAssignedTo().getId().equals(memberUserId))
                    .toList();

            long tasksAssigned = memberTasks.size();

            List<Task> completedTaskList = memberTasks.stream()
                    .filter(t -> "Completed".equalsIgnoreCase(t.getStatus()))
                    .toList();

            long tasksCompleted = completedTaskList.size();

            long onTimeCompletions = 0;
            long lateCompletions = 0;
            long totalDelayDays = 0;

            for (Task t : completedTaskList) {
                if (t.getDeadline() == null) {
                    onTimeCompletions++;
                } else {
                    LocalDate completionDate = t.getCompletedAt() != null
                            ? t.getCompletedAt().toLocalDate()
                            : LocalDate.now();
                    if (completionDate.isAfter(t.getDeadline())) {
                        lateCompletions++;
                        totalDelayDays += ChronoUnit.DAYS.between(t.getDeadline(), completionDate);
                    } else {
                        onTimeCompletions++;
                    }
                }
            }

            double averageDelayDays = lateCompletions > 0
                    ? Math.round(((double) totalDelayDays / lateCompletions) * 100.0) / 100.0
                    : 0.0;

            long reworkCount = memberTasks.stream()
                    .map(Task::getId)
                    .flatMap(taskId -> logsByTaskId.getOrDefault(taskId, List.of()).stream())
                    .filter(log -> isBackward(log.getFromStatus(), log.getToStatus()))
                    .count();

            List<Bug> memberBugs = bugs.stream()
                    .filter(b -> b.getAssignedTo() != null && b.getAssignedTo().getId().equals(memberUserId))
                    .toList();

            long bugsAssigned = memberBugs.size();

            List<Bug> resolvedBugs = memberBugs.stream()
                    .filter(b -> "Resolved".equalsIgnoreCase(b.getStatus()))
                    .toList();

            long bugsFixed = resolvedBugs.size();

            double totalBugHours = 0.0;
            long resolvedWithDatesCount = 0;
            for (Bug b : resolvedBugs) {
                if (b.getCreatedAt() != null && b.getResolvedAt() != null) {
                    totalBugHours += Duration.between(b.getCreatedAt(), b.getResolvedAt()).toSeconds() / 3600.0;
                    resolvedWithDatesCount++;
                }
            }

            double avgBugTurnaroundHours = resolvedWithDatesCount > 0
                    ? Math.round((totalBugHours / resolvedWithDatesCount) * 100.0) / 100.0
                    : 0.0;

            List<TestCase> memberTestCases = testCases.stream()
                    .filter(tc -> tc.getExecutedBy() != null && tc.getExecutedBy().getId().equals(memberUserId))
                    .toList();

            long testCasesExecuted = memberTestCases.size();
            long testCasesPassed = memberTestCases.stream()
                    .filter(TestCase::isPassed)
                    .count();

            return new MemberPerformanceReport(
                    memberUserId,
                    u.getName(),
                    tasksAssigned,
                    tasksCompleted,
                    onTimeCompletions,
                    lateCompletions,
                    averageDelayDays,
                    reworkCount,
                    bugsAssigned,
                    bugsFixed,
                    avgBugTurnaroundHours,
                    testCasesExecuted,
                    testCasesPassed
            );
        }).toList();
    }

    private boolean isBackward(String from, String to) {
        if (from == null || to == null) return false;
        Integer fromOrder = KANBAN_ORDER.get(from.toLowerCase().trim());
        Integer toOrder = KANBAN_ORDER.get(to.toLowerCase().trim());
        if (fromOrder == null || toOrder == null) return false;
        return toOrder < fromOrder;
    }
}
