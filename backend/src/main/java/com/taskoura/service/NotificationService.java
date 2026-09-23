package com.taskoura.service;

import com.taskoura.dto.NotificationDtos.*;
import com.taskoura.entity.ActivityLog;
import com.taskoura.entity.Notification;
import com.taskoura.entity.Project;
import com.taskoura.entity.User;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.ActivityLogRepository;
import com.taskoura.repository.NotificationRepository;
import com.taskoura.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final ActivityLogRepository activityLogRepository;
    private final UserRepository userRepository;

    public NotificationService(NotificationRepository notificationRepository,
                                ActivityLogRepository activityLogRepository,
                                UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.activityLogRepository = activityLogRepository;
        this.userRepository = userRepository;
    }

    // -------------------------------------------------------------------------
    // Public API endpoints
    // -------------------------------------------------------------------------

    public List<NotificationResponse> getNotifications(String userEmail, boolean unreadOnly) {
        User user = requireUser(userEmail);
        List<Notification> rows = unreadOnly
                ? notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(user.getId())
                : notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        return rows.stream().map(this::toNotificationResponse).toList();
    }

    @Transactional
    public NotificationResponse markRead(UUID notificationId, String userEmail) {
        User user = requireUser(userEmail);
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new NotFoundException("Notification not found"));
        if (!n.getUser().getId().equals(user.getId())) {
            throw new NotFoundException("Notification not found");
        }
        n.setRead(true);
        return toNotificationResponse(notificationRepository.save(n));
    }

    public List<ActivityLogResponse> getActivityFeed(UUID projectId) {
        return activityLogRepository.findByProjectIdOrderByCreatedAtAsc(projectId)
                .stream()
                .map(this::toActivityLogResponse)
                .toList();
    }

    // -------------------------------------------------------------------------
    // Internal helper methods — called by other services to record events
    // -------------------------------------------------------------------------

    /** Creates a Notification for the given user. */
    public void createNotification(User user, String message) {
        Notification n = Notification.builder()
                .user(user)
                .message(message)
                .build();
        notificationRepository.save(n);
    }

    /** Records an ActivityLog entry for a project action. */
    public void logActivity(Project project, User actor, String actionType, String description) {
        ActivityLog log = ActivityLog.builder()
                .project(project)
                .user(actor)
                .actionType(actionType)
                .description(description)
                .build();
        activityLogRepository.save(log);
    }

    // -------------------------------------------------------------------------
    // Mapping helpers
    // -------------------------------------------------------------------------

    private NotificationResponse toNotificationResponse(Notification n) {
        return new NotificationResponse(n.getId(), n.getMessage(), n.isRead(), n.getCreatedAt());
    }

    private ActivityLogResponse toActivityLogResponse(ActivityLog log) {
        return new ActivityLogResponse(
                log.getId(),
                log.getProject().getId(),
                log.getUser().getId(),
                log.getUser().getName(),
                log.getActionType(),
                log.getDescription(),
                log.getCreatedAt()
        );
    }

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }
}
