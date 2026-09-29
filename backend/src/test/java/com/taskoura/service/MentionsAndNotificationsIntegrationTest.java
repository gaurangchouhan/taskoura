package com.taskoura.service;

import com.taskoura.dto.CommentDtos.CreateCommentRequest;
import com.taskoura.dto.CommentDtos.CommentResponse;
import com.taskoura.dto.NotificationDtos.NotificationResponse;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.dto.ProjectMemberDtos.InviteMemberRequest;
import com.taskoura.dto.TaskDtos.CreateTaskRequest;
import com.taskoura.dto.TaskDtos.TaskResponse;
import com.taskoura.dto.TaskDtos.UpdateTaskStatusRequest;
import com.taskoura.entity.User;
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
class MentionsAndNotificationsIntegrationTest {

    @Autowired private CommentService commentService;
    @Autowired private TaskService taskService;
    @Autowired private ProjectService projectService;
    @Autowired private ProjectMemberService projectMemberService;
    @Autowired private NotificationService notificationService;
    @Autowired private DeadlineReminderService deadlineReminderService;
    @Autowired private UserRepository userRepository;

    private User owner;
    private User devAlice;
    private User devBob;
    private ProjectResponse project;
    private TaskResponse task;

    @BeforeEach
    void setUp() {
        owner = userRepository.save(User.builder()
                .name("Project Owner")
                .email("owner-m15-" + UUID.randomUUID() + "@test.com")
                .passwordHash("pass")
                .verified(true)
                .build());

        devAlice = userRepository.save(User.builder()
                .name("Alice Developer")
                .email("alice-m15-" + UUID.randomUUID() + "@test.com")
                .passwordHash("pass")
                .verified(true)
                .build());

        devBob = userRepository.save(User.builder()
                .name("Bob Architect")
                .email("bob-m15-" + UUID.randomUUID() + "@test.com")
                .passwordHash("pass")
                .verified(true)
                .build());

        project = projectService.createProject(owner.getEmail(),
                new CreateProjectRequest("M15 Project", "Testing mentions and notifications",
                        "React", "Spring Boot", "PostgreSQL", "JUnit 5", LocalDate.now().plusMonths(1)));

        projectMemberService.inviteMember(project.id(), new InviteMemberRequest(devAlice.getEmail(), "Member"));
        projectMemberService.inviteMember(project.id(), new InviteMemberRequest(devBob.getEmail(), "Member"));

        task = taskService.createTask(project.id(),
                new CreateTaskRequest("Integrate OAuth2", "Add login flow", "Security", "High", devAlice.getId(), LocalDate.now().plusDays(10)));
    }

    @Test
    @DisplayName("Write a comment mentioning a real project member by name -> Notification created for that user and not others")
    void testMentionRealMember_createsTargetedNotification() {
        // Owner writes a comment mentioning Alice by name
        CommentResponse comment = commentService.addComment(task.id(),
                new CreateCommentRequest("Hey @Alice Developer could you review this PR?"),
                owner.getEmail());

        assertThat(comment).isNotNull();
        assertThat(comment.mentionedUserIds()).contains(devAlice.getId());
        assertThat(comment.mentionedUserIds()).doesNotContain(devBob.getId());

        // Confirm Alice received the targeted notification
        List<NotificationResponse> aliceNotifications = notificationService.getNotifications(devAlice.getEmail(), false);
        assertThat(aliceNotifications).extracting(NotificationResponse::message)
                .anyMatch(msg -> msg.contains("Project Owner mentioned you in a comment on 'Integrate OAuth2'"));

        // Confirm Bob did NOT receive a mention notification
        List<NotificationResponse> bobNotifications = notificationService.getNotifications(devBob.getEmail(), false);
        assertThat(bobNotifications).extracting(NotificationResponse::message)
                .noneMatch(msg -> msg.contains("mentioned you"));
    }

    @Test
    @DisplayName("Write a comment mentioning someone who ISN'T a project member -> no notification created, comment saves fine")
    void testMentionNonMember_noNotification_commentSavesFine() {
        CommentResponse comment = commentService.addComment(task.id(),
                new CreateCommentRequest("Hey @GhostUser what do you think?"),
                owner.getEmail());

        assertThat(comment).isNotNull();
        assertThat(comment.content()).isEqualTo("Hey @GhostUser what do you think?");
        assertThat(comment.mentionedUserIds()).isEmpty();

        // Confirm no mention notification was sent to anyone
        List<NotificationResponse> aliceNotifications = notificationService.getNotifications(devAlice.getEmail(), false);
        assertThat(aliceNotifications).extracting(NotificationResponse::message)
                .noneMatch(msg -> msg.contains("mentioned you"));

        List<NotificationResponse> bobNotifications = notificationService.getNotifications(devBob.getEmail(), false);
        assertThat(bobNotifications).extracting(NotificationResponse::message)
                .noneMatch(msg -> msg.contains("mentioned you"));
    }

    @Test
    @DisplayName("Deadline reminders: runs against task due tomorrow, creates exactly 1 reminder, second run does NOT duplicate")
    void testDeadlineReminders_singleNotificationAndNoDuplicate() {
        // Create a task assigned to devBob due tomorrow (exactly 1 day away)
        TaskResponse dueTomorrowTask = taskService.createTask(project.id(),
                new CreateTaskRequest("Database Migration", "Run migration scripts", "Database", "High", devBob.getId(), LocalDate.now().plusDays(1)));

        // Run 1: Should send 1 reminder to Bob
        int firstRunCount = deadlineReminderService.sendDeadlineReminders();
        assertThat(firstRunCount).isGreaterThanOrEqualTo(1);

        List<NotificationResponse> bobNotifs = notificationService.getNotifications(devBob.getEmail(), false);
        long reminderCount = bobNotifs.stream()
                .filter(n -> n.message().equals("Task 'Database Migration' is due tomorrow."))
                .count();
        assertThat(reminderCount).isEqualTo(1);

        // Run 2: Immediately run again -> Should skip duplicate because it was already sent within 20 hours
        int secondRunCount = deadlineReminderService.sendDeadlineReminders();
        assertThat(secondRunCount).isEqualTo(0);

        List<NotificationResponse> bobNotifsAfter = notificationService.getNotifications(devBob.getEmail(), false);
        long reminderCountAfter = bobNotifsAfter.stream()
                .filter(n -> n.message().equals("Task 'Database Migration' is due tomorrow."))
                .count();
        assertThat(reminderCountAfter).isEqualTo(1); // Still exactly 1, no duplicate!
    }

    @Test
    @DisplayName("Status change: someone other than assignee changes status -> assignee notified; assignee changes -> no self notification")
    void testStatusChangeNotifications() {
        // 1. Task is assigned to Alice. Owner (someone other than assignee) changes status to InProgress
        taskService.updateStatus(task.id(), new UpdateTaskStatusRequest("InProgress"), owner.getEmail());

        List<NotificationResponse> aliceNotifs = notificationService.getNotifications(devAlice.getEmail(), false);
        assertThat(aliceNotifs).extracting(NotificationResponse::message)
                .contains("Task 'Integrate OAuth2' status changed from Backlog to InProgress.");

        int countBeforeSelfChange = aliceNotifs.size();

        // 2. Alice (the assignee herself) changes status to Testing -> No self-notification
        taskService.updateStatus(task.id(), new UpdateTaskStatusRequest("Testing"), devAlice.getEmail());

        List<NotificationResponse> aliceNotifsAfter = notificationService.getNotifications(devAlice.getEmail(), false);
        // Ensure no notification for "from InProgress to Testing" was created for Alice
        assertThat(aliceNotifsAfter).extracting(NotificationResponse::message)
                .noneMatch(msg -> msg.contains("status changed from InProgress to Testing"));
    }
}
