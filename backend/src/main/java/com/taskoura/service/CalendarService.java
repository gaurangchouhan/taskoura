package com.taskoura.service;

import com.taskoura.dto.CalendarDtos.*;
import com.taskoura.entity.Project;
import com.taskoura.entity.Task;
import com.taskoura.exception.BadRequestException;
import com.taskoura.repository.TaskRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class CalendarService {

    private final ProjectService projectService;
    private final TaskRepository taskRepository;

    public CalendarService(ProjectService projectService, TaskRepository taskRepository) {
        this.projectService = projectService;
        this.taskRepository = taskRepository;
    }

    public CalendarResponse getCalendar(UUID projectId, String month) {
        Project project = projectService.getProjectEntityOrThrow(projectId);

        YearMonth targetMonth = null;
        if (month != null && !month.isBlank()) {
            try {
                targetMonth = YearMonth.parse(month.trim());
            } catch (DateTimeParseException e) {
                throw new BadRequestException("Invalid month format: '" + month + "'. Expected YYYY-MM (e.g. 2026-09)");
            }
        }

        List<Task> tasks = taskRepository.findByProjectId(projectId);

        final YearMonth filterMonth = targetMonth;
        List<Task> filteredTasks = tasks.stream()
                .filter(t -> t.getDeadline() != null)
                .filter(t -> filterMonth == null || YearMonth.from(t.getDeadline()).equals(filterMonth))
                .toList();

        Map<LocalDate, List<Task>> tasksByDate = new TreeMap<>();
        for (Task t : filteredTasks) {
            tasksByDate.computeIfAbsent(t.getDeadline(), k -> new ArrayList<>()).add(t);
        }

        List<CalendarDayResponse> days = tasksByDate.entrySet().stream()
                .map(entry -> {
                    LocalDate date = entry.getKey();
                    List<CalendarTaskItem> taskItems = entry.getValue().stream()
                            .map(t -> new CalendarTaskItem(
                                    t.getId(),
                                    t.getTitle(),
                                    t.getStatus(),
                                    t.getPriority(),
                                    t.getAssignedTo() != null ? t.getAssignedTo().getId() : null,
                                    t.getAssignedTo() != null ? t.getAssignedTo().getName() : null
                            ))
                            .toList();
                    return new CalendarDayResponse(date, taskItems);
                })
                .toList();

        return new CalendarResponse(project.getDeadline(), days);
    }

    public List<UpcomingDeadlineResponse> getUpcomingDeadlines(UUID projectId, int withinDays) {
        projectService.getProjectEntityOrThrow(projectId);

        if (withinDays < 0) {
            throw new BadRequestException("withinDays must be non-negative");
        }

        List<Task> tasks = taskRepository.findByProjectId(projectId);
        LocalDate today = LocalDate.now();
        LocalDate cutoff = today.plusDays(withinDays);

        return tasks.stream()
                .filter(t -> t.getDeadline() != null
                        && !"Completed".equalsIgnoreCase(t.getStatus())
                        && !t.getDeadline().isBefore(today)
                        && !t.getDeadline().isAfter(cutoff))
                .sorted(Comparator.comparing(Task::getDeadline))
                .map(t -> new UpcomingDeadlineResponse(
                        t.getId(),
                        t.getTitle(),
                        t.getDeadline(),
                        t.getStatus(),
                        t.getPriority(),
                        t.getAssignedTo() != null ? t.getAssignedTo().getName() : null,
                        ChronoUnit.DAYS.between(today, t.getDeadline())
                ))
                .toList();
    }
}
