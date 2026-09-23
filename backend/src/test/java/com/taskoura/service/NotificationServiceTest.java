package com.taskoura.service;

import com.taskoura.dto.NotificationDtos.*;
import com.taskoura.entity.*;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.ActivityLogRepository;
import com.taskoura.repository.NotificationRepository;
import com.taskoura.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock NotificationRepository notificationRepository;
    @Mock ActivityLogRepository activityLogRepository;
    @Mock UserRepository userRepository;

    @InjectMocks NotificationService notificationService;

    private User testUser;
    private Project testProject;

    @BeforeEach
    void setUp() {
        testUser = User.builder().id(UUID.randomUUID()).name("Alice").email("alice@test.com").build();
        testProject = Project.builder().id(UUID.randomUUID()).name("TestProject").owner(testUser).build();
    }

    @Test
    void getNotifications_all_returnsAll() {
        Notification n = Notification.builder().id(UUID.randomUUID()).user(testUser)
                .message("msg").isRead(false).createdAt(LocalDateTime.now()).build();
        when(userRepository.findByEmail("alice@test.com")).thenReturn(Optional.of(testUser));
        when(notificationRepository.findByUserIdOrderByCreatedAtDesc(testUser.getId()))
                .thenReturn(List.of(n));

        List<NotificationResponse> result = notificationService.getNotifications("alice@test.com", false);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).message()).isEqualTo("msg");
        assertThat(result.get(0).isRead()).isFalse();
    }

    @Test
    void getNotifications_unreadOnly_delegatesToUnreadQuery() {
        when(userRepository.findByEmail("alice@test.com")).thenReturn(Optional.of(testUser));
        when(notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(testUser.getId()))
                .thenReturn(List.of());

        List<NotificationResponse> result = notificationService.getNotifications("alice@test.com", true);

        assertThat(result).isEmpty();
        verify(notificationRepository).findByUserIdAndIsReadFalseOrderByCreatedAtDesc(testUser.getId());
        verify(notificationRepository, never()).findByUserIdOrderByCreatedAtDesc(any());
    }

    @Test
    void markRead_setsIsReadTrue() {
        Notification n = Notification.builder().id(UUID.randomUUID()).user(testUser)
                .message("hello").isRead(false).createdAt(LocalDateTime.now()).build();
        when(userRepository.findByEmail("alice@test.com")).thenReturn(Optional.of(testUser));
        when(notificationRepository.findById(n.getId())).thenReturn(Optional.of(n));
        when(notificationRepository.save(n)).thenReturn(n);

        NotificationResponse result = notificationService.markRead(n.getId(), "alice@test.com");

        assertThat(result.isRead()).isTrue();
        verify(notificationRepository).save(n);
    }

    @Test
    void markRead_wrongUser_throwsNotFound() {
        User other = User.builder().id(UUID.randomUUID()).email("bob@test.com").build();
        Notification n = Notification.builder().id(UUID.randomUUID()).user(other)
                .message("for bob").isRead(false).createdAt(LocalDateTime.now()).build();
        when(userRepository.findByEmail("alice@test.com")).thenReturn(Optional.of(testUser));
        when(notificationRepository.findById(n.getId())).thenReturn(Optional.of(n));

        assertThatThrownBy(() -> notificationService.markRead(n.getId(), "alice@test.com"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void markRead_notFound_throwsNotFound() {
        UUID randomId = UUID.randomUUID();
        when(userRepository.findByEmail("alice@test.com")).thenReturn(Optional.of(testUser));
        when(notificationRepository.findById(randomId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> notificationService.markRead(randomId, "alice@test.com"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void createNotification_savesEntity() {
        notificationService.createNotification(testUser, "Test message");

        verify(notificationRepository).save(argThat(n ->
                n.getUser().equals(testUser) &&
                n.getMessage().equals("Test message") &&
                !n.isRead()
        ));
    }

    @Test
    void logActivity_savesEntity() {
        notificationService.logActivity(testProject, testUser, "TASK_CREATED", "Task X was created");

        verify(activityLogRepository).save(argThat(log ->
                log.getProject().equals(testProject) &&
                log.getUser().equals(testUser) &&
                log.getActionType().equals("TASK_CREATED") &&
                log.getDescription().equals("Task X was created")
        ));
    }

    @Test
    void getActivityFeed_returnsMappedLogs() {
        ActivityLog log = ActivityLog.builder()
                .id(UUID.randomUUID())
                .project(testProject)
                .user(testUser)
                .actionType("TASK_CREATED")
                .description("Task X was created")
                .createdAt(LocalDateTime.now())
                .build();
        when(activityLogRepository.findByProjectIdOrderByCreatedAtAsc(testProject.getId()))
                .thenReturn(List.of(log));

        List<ActivityLogResponse> result = notificationService.getActivityFeed(testProject.getId());

        assertThat(result).hasSize(1);
        assertThat(result.get(0).actionType()).isEqualTo("TASK_CREATED");
        assertThat(result.get(0).userName()).isEqualTo("Alice");
    }
}
