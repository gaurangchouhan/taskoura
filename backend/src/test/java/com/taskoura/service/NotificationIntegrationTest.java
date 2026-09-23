package com.taskoura.service;

import com.taskoura.dto.NotificationDtos.*;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.dto.TaskDtos.CreateTaskRequest;
import com.taskoura.dto.TaskDtos.TaskResponse;
import com.taskoura.dto.TaskDtos.UpdateTaskStatusRequest;
import com.taskoura.entity.User;
import com.taskoura.repository.NotificationRepository;
import com.taskoura.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class NotificationIntegrationTest {

    @Autowired private TaskService taskService;
    @Autowired private ProjectService projectService;
    @Autowired private NotificationService notificationService;
    @Autowired private UserRepository userRepository;
    @Autowired private NotificationRepository notificationRepository;

    private User owner;
    private User assignee;
    private ProjectResponse project;

    @BeforeEach
    void setUp() {
        owner = userRepository.save(User.builder()
                .name("Owner")
                .email("owner-notif-" + UUID.randomUUID() + "@test.com")
                .passwordHash("pass").verified(true).build());

        assignee = userRepository.save(User.builder()
                .name("Assignee")
                .email("assignee-notif-" + UUID.randomUUID() + "@test.com")
                .passwordHash("pass").verified(true).build());

        project = projectService.createProject(owner.getEmail(),
                new CreateProjectRequest("Notification Test Project", "desc",
                        "React", "Spring", "Postgres", "JUnit", LocalDate.now().plusMonths(1)));
    }

    @Test
    @DisplayName("Assigning a task at creation creates a notification for the assignee")
    void assignTask_createsNotificationForAssignee() {
        // Create task assigned to 'assignee'
        TaskResponse task = taskService.createTask(project.id(),
                new CreateTaskRequest("Fix login bug", "Details", "Backend", "High",
                        assignee.getId(), LocalDate.now().plusDays(3)));

        // Verify notification row was created for assignee
        List<NotificationResponse> notifications =
                notificationService.getNotifications(assignee.getEmail(), false);

        assertThat(notifications).hasSize(1);
        assertThat(notifications.get(0).message()).contains("Fix login bug");
        assertThat(notifications.get(0).isRead()).isFalse();
    }

    @Test
    @DisplayName("Reassigning task fires a notification for the new assignee")
    void reassignTask_createsNotificationForNewAssignee() {
        // Create task with no assignee
        TaskResponse task = taskService.createTask(project.id(),
                new CreateTaskRequest("Unassigned task", "desc", "Backend", "Medium",
                        null, LocalDate.now().plusDays(5)));

        long countBefore = notificationRepository.findByUserIdOrderByCreatedAtDesc(assignee.getId()).size();

        // Reassign to 'assignee'
        taskService.reassignTask(task.id(), assignee.getId(), owner.getEmail());

        List<NotificationResponse> notifications =
                notificationService.getNotifications(assignee.getEmail(), false);

        assertThat(notifications).hasSizeGreaterThan((int) countBefore);
        assertThat(notifications.get(0).message()).contains("Unassigned task");
    }

    @Test
    @DisplayName("Status change produces an ActivityLog entry for the project")
    void statusChange_createsActivityLog() {
        TaskResponse task = taskService.createTask(project.id(),
                new CreateTaskRequest("Build API", "desc", "Backend", "High",
                        null, LocalDate.now().plusDays(7)));

        // Change status
        taskService.updateStatus(task.id(), new UpdateTaskStatusRequest("InProgress"), owner.getEmail());

        List<ActivityLogResponse> feed = notificationService.getActivityFeed(project.id());

        // At minimum: TASK_CREATED + TASK_STATUS_CHANGED
        assertThat(feed).hasSizeGreaterThanOrEqualTo(2);
        assertThat(feed.stream().map(ActivityLogResponse::actionType))
                .contains("TASK_CREATED", "TASK_STATUS_CHANGED");

        ActivityLogResponse statusLog = feed.stream()
                .filter(e -> "TASK_STATUS_CHANGED".equals(e.actionType()))
                .findFirst()
                .orElseThrow();
        assertThat(statusLog.description()).contains("Backlog").contains("InProgress");
    }

    @Test
    @DisplayName("markRead removes notification from unreadOnly list")
    void markRead_removedFromUnreadOnlyList() {
        // Create a notification via task assignment
        taskService.createTask(project.id(),
                new CreateTaskRequest("Notif task", "desc", "Backend", "Low",
                        assignee.getId(), LocalDate.now().plusDays(2)));

        // Verify unread list has it
        List<NotificationResponse> unread = notificationService.getNotifications(assignee.getEmail(), true);
        assertThat(unread).isNotEmpty();
        UUID notifId = unread.get(0).id();

        // Mark it as read
        notificationService.markRead(notifId, assignee.getEmail());

        // Should no longer appear in unreadOnly query
        List<NotificationResponse> afterRead = notificationService.getNotifications(assignee.getEmail(), true);
        assertThat(afterRead.stream().map(NotificationResponse::id)).doesNotContain(notifId);

        // But should still appear in full list
        List<NotificationResponse> allNotifs = notificationService.getNotifications(assignee.getEmail(), false);
        assertThat(allNotifs.stream().map(NotificationResponse::id)).contains(notifId);
    }
}
