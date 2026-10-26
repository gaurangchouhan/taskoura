package com.taskoura.controller;

import com.taskoura.dto.NotificationDtos.*;
import com.taskoura.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
public class NotificationController {

    private final NotificationService notificationService;
    private final com.taskoura.service.DeadlineReminderService deadlineReminderService;
    private final com.taskoura.service.ProjectAccessService projectAccessService;

    public NotificationController(NotificationService notificationService,
                                  com.taskoura.service.DeadlineReminderService deadlineReminderService,
                                  com.taskoura.service.ProjectAccessService projectAccessService) {
        this.notificationService = notificationService;
        this.deadlineReminderService = deadlineReminderService;
        this.projectAccessService = projectAccessService;
    }

    @GetMapping("/api/notifications")
    public ResponseEntity<List<NotificationResponse>> getNotifications(
            @RequestParam(name = "unreadOnly", defaultValue = "false") boolean unreadOnly,
            Authentication authentication
    ) {
        return ResponseEntity.ok(
                notificationService.getNotifications(authentication.getName(), unreadOnly));
    }

    @PatchMapping("/api/notifications/{id}/read")
    public ResponseEntity<NotificationResponse> markRead(
            @PathVariable UUID id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(notificationService.markRead(id, authentication.getName()));
    }

    @GetMapping("/api/projects/{projectId}/activity")
    public ResponseEntity<List<ActivityLogResponse>> getActivityFeed(
            @PathVariable UUID projectId,
            @RequestParam(required = false, defaultValue = "200") Integer limit,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireMember(projectId, email);
        return ResponseEntity.ok(notificationService.getActivityFeed(projectId, limit));
    }

    @PostMapping("/api/reminders/trigger")
    public ResponseEntity<java.util.Map<String, Object>> triggerReminders() {
        int sent = deadlineReminderService.sendDeadlineReminders();
        return ResponseEntity.ok(java.util.Map.of("message", "Reminders triggered successfully", "remindersSent", sent));
    }
}
