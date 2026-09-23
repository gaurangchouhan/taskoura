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

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
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
            @PathVariable UUID projectId
    ) {
        return ResponseEntity.ok(notificationService.getActivityFeed(projectId));
    }
}
