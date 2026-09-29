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
    @DisplayName("updateStatus: non-assignee changes status -> assignee gets notification")
    void updateStatus_byNonAssignee_notifiesAssignee() {
        UUID taskId = UUID.randomUUID();
        User assignee = User.builder().id(UUID.randomUUID()).name("Dev").email("dev@test.com").build();
        User manager = User.builder().id(UUID.randomUUID()).name("Manager").email("mgr@test.com").build();

        Task task = Task.builder()
                .id(taskId)
                .title("Fix bug")
                .status("InProgress")
                .assignedTo(assignee)
                .project(project)
                .build();

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(userRepository.findByEmail("mgr@test.com")).thenReturn(Optional.of(manager));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        taskService.updateStatus(taskId, new UpdateTaskStatusRequest("Testing"), "mgr@test.com");

        verify(notificationService).createNotification(assignee,
                "Task 'Fix bug' status changed from InProgress to Testing.");
    }

    @Test
    @DisplayName("updateStatus: assignee changes status themselves -> no notification is created")
    void updateStatus_byAssignee_noNotification() {
        UUID taskId = UUID.randomUUID();
        User assignee = User.builder().id(UUID.randomUUID()).name("Dev").email("dev@test.com").build();

        Task task = Task.builder()
                .id(taskId)
                .title("Fix bug")
                .status("InProgress")
                .assignedTo(assignee)
                .project(project)
                .build();

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(userRepository.findByEmail("dev@test.com")).thenReturn(Optional.of(assignee));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        taskService.updateStatus(taskId, new UpdateTaskStatusRequest("Testing"), "dev@test.com");

        verify(notificationService, never()).createNotification(eq(assignee), contains("status changed"));
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

    @Test
    @DisplayName("createSubtask: successfully creates subtask inheriting parent project")
    void createSubtask_success() {
        UUID parentId = UUID.randomUUID();
        Task parent = Task.builder().id(parentId).title("Parent Feature").project(project).build();
        CreateTaskRequest req = new CreateTaskRequest("Subtask 1", "Subtask details", "Frontend", "High", user.getId(), LocalDate.now().plusDays(3));

        when(taskRepository.findById(parentId)).thenReturn(Optional.of(parent));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> {
            Task t = inv.getArgument(0);
            t.setId(UUID.randomUUID());
            return t;
        });

        TaskResponse res = taskService.createSubtask(parentId, req);

        assertThat(res).isNotNull();
        assertThat(res.title()).isEqualTo("Subtask 1");
        assertThat(res.parentTaskId()).isEqualTo(parentId);
        assertThat(res.status()).isEqualTo("Backlog");
        verify(taskRepository).save(argThat(t -> t.getParentTask().equals(parent) && t.getProject().equals(project)));
    }

    @Test
    @DisplayName("createSubtask: rejects nested subtasks with BadRequestException (only 1 level allowed)")
    void createSubtask_nestedSubtask_throwsBadRequest() {
        UUID grandparentId = UUID.randomUUID();
        Task grandparent = Task.builder().id(grandparentId).title("Grandparent").project(project).build();
        UUID parentId = UUID.randomUUID();
        Task parentSubtask = Task.builder().id(parentId).title("Parent Subtask").project(project).parentTask(grandparent).build();

        CreateTaskRequest req = new CreateTaskRequest("Nested Subtask", "desc", "Backend", "Low", null, null);

        when(taskRepository.findById(parentId)).thenReturn(Optional.of(parentSubtask));

        assertThatThrownBy(() -> taskService.createSubtask(parentId, req))
                .isInstanceOf(com.taskoura.exception.BadRequestException.class)
                .hasMessageContaining("Subtasks cannot have nested subtasks");

        verify(taskRepository, never()).save(any());
    }

    @Test
    @DisplayName("getSubtasks: returns direct subtasks for parent task")
    void getSubtasks_returnsList() {
        UUID parentId = UUID.randomUUID();
        Task parent = Task.builder().id(parentId).title("Parent").project(project).build();
        Task sub1 = Task.builder().id(UUID.randomUUID()).title("Sub 1").project(project).parentTask(parent).build();
        Task sub2 = Task.builder().id(UUID.randomUUID()).title("Sub 2").project(project).parentTask(parent).build();

        when(taskRepository.existsById(parentId)).thenReturn(true);
        when(taskRepository.findByParentTaskIdOrderByCreatedAtAsc(parentId)).thenReturn(List.of(sub1, sub2));

        List<TaskResponse> subtasks = taskService.getSubtasks(parentId);

        assertThat(subtasks).hasSize(2);
        assertThat(subtasks.get(0).title()).isEqualTo("Sub 1");
        assertThat(subtasks.get(1).title()).isEqualTo("Sub 2");
    }
}
