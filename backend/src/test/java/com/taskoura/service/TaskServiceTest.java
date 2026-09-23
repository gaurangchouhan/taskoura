package com.taskoura.service;

import com.taskoura.dto.TaskDtos.CreateTaskRequest;
import com.taskoura.dto.TaskDtos.TaskResponse;
import com.taskoura.dto.TaskDtos.UpdateTaskStatusRequest;
import com.taskoura.dto.TaskStatusLogDtos.TaskStatusLogResponse;
import com.taskoura.entity.Project;
import com.taskoura.entity.Task;
import com.taskoura.entity.TaskStatusLog;
import com.taskoura.entity.User;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.TaskRepository;
import com.taskoura.repository.TaskStatusLogRepository;
import com.taskoura.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectService projectService;

    @Mock
    private TaskStatusLogRepository taskStatusLogRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private TaskService taskService;

    private UUID projectId;
    private Project project;
    private User user;

    @BeforeEach
    void setUp() {
        projectId = UUID.randomUUID();
        project = Project.builder().id(projectId).name("Taskoura Project").build();
        user = User.builder().id(UUID.randomUUID()).name("Alex Worker").email("worker@example.com").build();
    }

    @Test
    @DisplayName("createTask: always defaults status to Backlog regardless of input")
    void createTask_defaultsToBacklog() {
        CreateTaskRequest request = new CreateTaskRequest(
                "New Feature", "Build feature", "Backend", "High", user.getId(), LocalDate.now().plusDays(7)
        );

        when(projectService.getProjectEntityOrThrow(projectId)).thenReturn(project);
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> {
            Task t = inv.getArgument(0);
            t.setId(UUID.randomUUID());
            return t;
        });

        TaskResponse response = taskService.createTask(projectId, request);

        assertThat(response).isNotNull();
        assertThat(response.status()).isEqualTo("Backlog");
        assertThat(response.title()).isEqualTo("New Feature");
        verify(taskRepository).save(argThat(t -> "Backlog".equals(t.getStatus())));
    }

    @Test
    @DisplayName("createTask: throws NotFoundException when project does not exist")
    void createTask_projectNotFound_throwsNotFound() {
        CreateTaskRequest request = new CreateTaskRequest(
                "New Feature", "Build feature", "Backend", "High", null, LocalDate.now()
        );

        when(projectService.getProjectEntityOrThrow(projectId))
                .thenThrow(new NotFoundException("Project not found"));

        assertThatThrownBy(() -> taskService.createTask(projectId, request))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Project not found");
    }

    @Test
    @DisplayName("updateStatus: inserts TaskStatusLog and sets completedAt when status is Completed")
    void updateStatus_toCompleted_setsCompletedAtAndInsertsLog() {
        UUID taskId = UUID.randomUUID();
        Task existingTask = Task.builder()
                .id(taskId)
                .title("Complete Testing")
                .status("Testing")
                .project(project)
                .build();

        UpdateTaskStatusRequest request = new UpdateTaskStatusRequest("Completed");

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(existingTask));
        when(userRepository.findByEmail("worker@example.com")).thenReturn(Optional.of(user));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskResponse response = taskService.updateStatus(taskId, request, "worker@example.com");

        assertThat(response.status()).isEqualTo("Completed");
        assertThat(response.completedAt()).isNotNull();

        verify(taskStatusLogRepository).save(argThat(log ->
                "Testing".equals(log.getFromStatus()) &&
                "Completed".equals(log.getToStatus()) &&
                log.getChangedBy().equals(user)
        ));
    }

    @Test
    @DisplayName("updateStatus: moving away from Completed resets completedAt to null")
    void updateStatus_toInProgress_completedAtNull() {
        UUID taskId = UUID.randomUUID();
        Task existingTask = Task.builder()
                .id(taskId)
                .title("Reopen Task")
                .status("Backlog")
                .project(project)
                .build();

        UpdateTaskStatusRequest request = new UpdateTaskStatusRequest("InProgress");

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(existingTask));
        when(userRepository.findByEmail("worker@example.com")).thenReturn(Optional.of(user));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskResponse response = taskService.updateStatus(taskId, request, "worker@example.com");

        assertThat(response.status()).isEqualTo("InProgress");
        assertThat(response.completedAt()).isNull();

        verify(taskStatusLogRepository).save(argThat(log ->
                "Backlog".equals(log.getFromStatus()) && "InProgress".equals(log.getToStatus())
        ));
    }

    @Test
    @DisplayName("getStatusHistory: returns ordered logs for existing task")
    void getStatusHistory_success() {
        UUID taskId = UUID.randomUUID();
        Task task = Task.builder().id(taskId).build();
        TaskStatusLog log = TaskStatusLog.builder()
                .id(UUID.randomUUID())
                .task(task)
                .changedBy(user)
                .fromStatus("Backlog")
                .toStatus("InProgress")
                .changedAt(LocalDateTime.now())
                .build();

        when(taskRepository.existsById(taskId)).thenReturn(true);
        when(taskStatusLogRepository.findByTaskIdOrderByChangedAtAsc(taskId)).thenReturn(List.of(log));

        List<TaskStatusLogResponse> history = taskService.getStatusHistory(taskId);

        assertThat(history).hasSize(1);
        assertThat(history.get(0).fromStatus()).isEqualTo("Backlog");
        assertThat(history.get(0).toStatus()).isEqualTo("InProgress");
        assertThat(history.get(0).changedByName()).isEqualTo("Alex Worker");
    }

    @Test
    @DisplayName("getStatusHistory: throws NotFoundException when task does not exist")
    void getStatusHistory_taskNotFound_throwsNotFound() {
        UUID taskId = UUID.randomUUID();
        when(taskRepository.existsById(taskId)).thenReturn(false);

        assertThatThrownBy(() -> taskService.getStatusHistory(taskId))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Task not found");
    }
}
