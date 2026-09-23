package com.taskoura.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class DashboardReportDtos {

    public record DashboardResponse(
            long totalTasks,
            long completedTasks,
            double completionPercentage,
            Map<String, Long> tasksByStatus,
            List<MemberTaskStats> tasksByMember,
            List<UpcomingDeadlineTask> upcomingDeadlines
    ) {}

    public record MemberTaskStats(
            UUID userId,
            String userName,
            long assignedTasks,
            long completedTasks
    ) {}

    public record UpcomingDeadlineTask(
            UUID taskId,
            String title,
            LocalDate deadline,
            String status,
            String priority,
            UUID assignedToId,
            String assignedToName
    ) {}

    public record MemberPerformanceReport(
            UUID userId,
            String userName,
            long tasksAssigned,
            long tasksCompleted,
            long onTimeCompletions,
            long lateCompletions,
            double averageDelayDays,
            long reworkCount,
            long bugsAssigned,
            long bugsFixed,
            double avgBugTurnaroundHours,
            long testCasesExecuted,
            long testCasesPassed
    ) {}
}
