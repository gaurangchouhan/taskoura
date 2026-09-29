package com.taskoura.service;

import com.taskoura.entity.Task;
import com.taskoura.entity.User;
import com.taskoura.repository.NotificationRepository;
import com.taskoura.repository.TaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class DeadlineReminderService {

    private static final Logger log = LoggerFactory.getLogger(DeadlineReminderService.class);

    private final TaskRepository taskRepository;
    private final NotificationRepository notificationRepository;
    private final NotificationService notificationService;

    public DeadlineReminderService(TaskRepository taskRepository,
                                   NotificationRepository notificationRepository,
                                   NotificationService notificationService) {
        this.taskRepository = taskRepository;
        this.notificationRepository = notificationRepository;
        this.notificationService = notificationService;
    }

    /**
     * Daily scheduled job (and manually callable):
     * Finds tasks due exactly 1 day away, not Completed, and creates a notification
     * for the assigned user if no identical reminder exists within the last 20 hours.
     *
     * @return number of reminders created
     */
    @Scheduled(cron = "${reminders.cron:0 0 9 * * *}")
    public int sendDeadlineReminders() {
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        LocalDateTime twentyHoursAgo = LocalDateTime.now().minusHours(20);

        List<Task> tasks = taskRepository.findAll().stream()
                .filter(t -> t.getDeadline() != null && t.getDeadline().equals(tomorrow))
                .filter(t -> !"Completed".equalsIgnoreCase(t.getStatus()))
                .filter(t -> t.getAssignedTo() != null)
                .toList();

        int sentCount = 0;
        for (Task task : tasks) {
            User assignee = task.getAssignedTo();
            String message = "Task '" + task.getTitle() + "' is due tomorrow.";

            boolean alreadySent = notificationRepository.existsByUserIdAndMessageAndCreatedAtAfter(
                    assignee.getId(), message, twentyHoursAgo
            );

            if (!alreadySent) {
                notificationService.createNotification(assignee, message);
                sentCount++;
                log.info("Sent deadline reminder to user {} for task '{}'", assignee.getEmail(), task.getTitle());
            } else {
                log.debug("Skipped duplicate deadline reminder for user {} on task '{}'", assignee.getEmail(), task.getTitle());
            }
        }
        return sentCount;
    }
}
