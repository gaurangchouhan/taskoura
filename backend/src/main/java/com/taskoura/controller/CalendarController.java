package com.taskoura.controller;

import com.taskoura.dto.CalendarDtos.CalendarResponse;
import com.taskoura.dto.CalendarDtos.UpcomingDeadlineResponse;
import com.taskoura.service.CalendarService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class CalendarController {

    private final CalendarService calendarService;

    public CalendarController(CalendarService calendarService) {
        this.calendarService = calendarService;
    }

    @GetMapping("/api/projects/{projectId}/calendar")
    public ResponseEntity<CalendarResponse> getCalendar(
            @PathVariable UUID projectId,
            @RequestParam(required = false) String month
    ) {
        return ResponseEntity.ok(calendarService.getCalendar(projectId, month));
    }

    @GetMapping("/api/projects/{projectId}/deadlines/upcoming")
    public ResponseEntity<List<UpcomingDeadlineResponse>> getUpcomingDeadlines(
            @PathVariable UUID projectId,
            @RequestParam(defaultValue = "7") int withinDays
    ) {
        return ResponseEntity.ok(calendarService.getUpcomingDeadlines(projectId, withinDays));
    }
}
