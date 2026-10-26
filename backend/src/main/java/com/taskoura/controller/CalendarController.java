package com.taskoura.controller;

import com.taskoura.dto.CalendarDtos.CalendarResponse;
import com.taskoura.dto.CalendarDtos.UpcomingDeadlineResponse;
import com.taskoura.service.CalendarService;
import com.taskoura.service.ProjectAccessService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class CalendarController {

    private final CalendarService calendarService;
    private final ProjectAccessService projectAccessService;

    public CalendarController(CalendarService calendarService, ProjectAccessService projectAccessService) {
        this.calendarService = calendarService;
        this.projectAccessService = projectAccessService;
    }

    @GetMapping("/api/projects/{projectId}/calendar")
    public ResponseEntity<CalendarResponse> getCalendar(
            @PathVariable UUID projectId,
            @RequestParam(required = false) String month,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireMember(projectId, email);
        return ResponseEntity.ok(calendarService.getCalendar(projectId, month));
    }

    @GetMapping("/api/projects/{projectId}/deadlines/upcoming")
    public ResponseEntity<List<UpcomingDeadlineResponse>> getUpcomingDeadlines(
            @PathVariable UUID projectId,
            @RequestParam(defaultValue = "7") int withinDays,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireMember(projectId, email);
        return ResponseEntity.ok(calendarService.getUpcomingDeadlines(projectId, withinDays));
    }
}
