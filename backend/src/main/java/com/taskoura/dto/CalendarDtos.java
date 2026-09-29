package com.taskoura.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class CalendarDtos {

    public record CalendarResponse(
            LocalDate projectDeadline,
            List<CalendarDayResponse> days
    ) {}

    public record CalendarDayResponse(
            LocalDate date,
            List<CalendarTaskItem> tasks
    ) {}

    public record CalendarTaskItem(
            UUID id,
            String title,
            String status,
            String priority,
            UUID assignedTo,
            String assignedToName
    ) {}

    public record UpcomingDeadlineResponse(
            UUID taskId,
            String title,
            LocalDate deadline,
            String status,
            String priority,
            String assignedToName,
            long daysRemaining
    ) {}
}
