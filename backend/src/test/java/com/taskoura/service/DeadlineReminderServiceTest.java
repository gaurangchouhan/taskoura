package com.taskoura.service;

import com.taskoura.entity.Task;
import com.taskoura.entity.User;
import com.taskoura.repository.NotificationRepository;
import com.taskoura.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DeadlineReminderServiceTest {

    @Mock private TaskRepository taskRepository;
    @Mock private NotificationRepository notificationRepository;
    @Mock private NotificationService notificationService;

    @InjectMocks private DeadlineReminderService deadlineReminderService;

    private User assignee;

    @BeforeEach
    void setUp() {
        assignee = User.builder().id(UUID.randomUUID()).name("Dev Bob").email("bob@test.com").build();
    }

    @Test
    @DisplayName("sendDeadlineReminders: sends reminder for task due tomorrow")
    void sendDeadlineReminders_taskDueTomorrow_sendsNotification() {
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        Task task = Task.builder()
                .id(UUID.randomUUID())
                .title("Release v1.0")
                .deadline(tomorrow)
                .status("InProgress")
                .assignedTo(assignee)
                .build();

        when(taskRepository.findAll()).thenReturn(List.of(task));
        when(notificationRepository.existsByUserIdAndMessageAndCreatedAtAfter(eq(assignee.getId()), anyString(), any()))
                .thenReturn(false);

        int sent = deadlineReminderService.sendDeadlineReminders();

        assertThat(sent).isEqualTo(1);
        verify(notificationService).createNotification(assignee, "Task 'Release v1.0' is due tomorrow.");
    }

    @Test
    @DisplayName("sendDeadlineReminders: skips duplicate reminder if already sent within 20 hours")
    void sendDeadlineReminders_alreadySentWithin20Hours_skipsDuplicate() {
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        Task task = Task.builder()
                .id(UUID.randomUUID())
                .title("Release v1.0")
                .deadline(tomorrow)
                .status("InProgress")
                .assignedTo(assignee)
                .build();

        when(taskRepository.findAll()).thenReturn(List.of(task));
        when(notificationRepository.existsByUserIdAndMessageAndCreatedAtAfter(eq(assignee.getId()), anyString(), any()))
                .thenReturn(true);

        int sent = deadlineReminderService.sendDeadlineReminders();

        assertThat(sent).isEqualTo(0);
        verify(notificationService, never()).createNotification(any(), any());
    }

    @Test
    @DisplayName("sendDeadlineReminders: ignores completed tasks and tasks without assignee")
    void sendDeadlineReminders_completedOrUnassigned_ignored() {
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        Task completedTask = Task.builder()
                .id(UUID.randomUUID()).title("Done task").deadline(tomorrow).status("Completed").assignedTo(assignee).build();
        Task unassignedTask = Task.builder()
                .id(UUID.randomUUID()).title("Unassigned task").deadline(tomorrow).status("InProgress").assignedTo(null).build();

        when(taskRepository.findAll()).thenReturn(List.of(completedTask, unassignedTask));

        int sent = deadlineReminderService.sendDeadlineReminders();

        assertThat(sent).isEqualTo(0);
        verifyNoInteractions(notificationService);
    }
}
