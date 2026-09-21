package com.taskoura.service;

import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.dto.TaskDtos.CreateTaskRequest;
import com.taskoura.dto.TaskDtos.TaskResponse;
import com.taskoura.dto.TaskDtos.UpdateTaskStatusRequest;
import com.taskoura.dto.TaskStatusLogDtos.TaskStatusLogResponse;
import com.taskoura.entity.User;
import com.taskoura.exception.NotFoundException;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class TaskLifecycleIntegrationTest {

    @Autowired
    private TaskService taskService;

    @Autowired
    private ProjectService projectService;

    @Autowired
    private UserRepository userRepository;

    private User testUser;
    private ProjectResponse testProject;

    @BeforeEach
    void setUp() {
        testUser = userRepository.save(User.builder()
                .name("Kanban User")
                .email("kanban-" + UUID.randomUUID() + "@example.com")
                .passwordHash("pass")
                .verified(true)
                .build());

        testProject = projectService.createProject(
                testUser.getEmail(),
                new CreateProjectRequest(
                        "Kanban Project", "Description", "React", "Spring Boot", "PostgreSQL", "JUnit 5", LocalDate.now().plusMonths(1)
                )
        );
    }

    @Test
    @DisplayName("End-to-End: Task status defaults to Backlog, transitions produce logs, completedAt set on Completed")
    void fullTaskLifecycleAndStatusLogs() {
        // 1. Create a task with a status in request -> confirm it defaults to Backlog
        CreateTaskRequest createReq = new CreateTaskRequest(
                "Build Auth", "JWT authentication", "Backend", "High", testUser.getId(), LocalDate.now().plusDays(7)
        );

        TaskResponse task = taskService.createTask(testProject.id(), createReq);
        assertThat(task).isNotNull();
        assertThat(task.status()).isEqualTo("Backlog");
        assertThat(task.completedAt()).isNull();

        List<TaskStatusLogResponse> initialLogs = taskService.getStatusHistory(task.id());
        assertThat(initialLogs).isEmpty();

        // 2. Transition 1: Backlog -> InProgress
        TaskResponse inProgressTask = taskService.updateStatus(
                task.id(), new UpdateTaskStatusRequest("InProgress"), testUser.getEmail()
        );
        assertThat(inProgressTask.status()).isEqualTo("InProgress");
        assertThat(inProgressTask.completedAt()).isNull();

        List<TaskStatusLogResponse> logsAfter1 = taskService.getStatusHistory(task.id());
        assertThat(logsAfter1).hasSize(1);
        assertThat(logsAfter1.get(0).fromStatus()).isEqualTo("Backlog");
        assertThat(logsAfter1.get(0).toStatus()).isEqualTo("InProgress");
        assertThat(logsAfter1.get(0).changedByName()).isEqualTo("Kanban User");

        // 3. Transition 2: InProgress -> Testing
        TaskResponse testingTask = taskService.updateStatus(
                task.id(), new UpdateTaskStatusRequest("Testing"), testUser.getEmail()
        );
        assertThat(testingTask.status()).isEqualTo("Testing");
        assertThat(testingTask.completedAt()).isNull();

        List<TaskStatusLogResponse> logsAfter2 = taskService.getStatusHistory(task.id());
        assertThat(logsAfter2).hasSize(2);
        assertThat(logsAfter2.get(1).fromStatus()).isEqualTo("InProgress");
        assertThat(logsAfter2.get(1).toStatus()).isEqualTo("Testing");

        // 4. Transition 3: Testing -> Completed
        TaskResponse completedTask = taskService.updateStatus(
                task.id(), new UpdateTaskStatusRequest("Completed"), testUser.getEmail()
        );
        assertThat(completedTask.status()).isEqualTo("Completed");
        assertThat(completedTask.completedAt()).isNotNull();

        List<TaskStatusLogResponse> logsAfter3 = taskService.getStatusHistory(task.id());
        assertThat(logsAfter3).hasSize(3);
        assertThat(logsAfter3.get(2).fromStatus()).isEqualTo("Testing");
        assertThat(logsAfter3.get(2).toStatus()).isEqualTo("Completed");

        // 5. Creating a task under non-existent project id throws NotFoundException (not 500)
        UUID nonExistentProjectId = UUID.randomUUID();
        assertThatThrownBy(() -> taskService.createTask(nonExistentProjectId, createReq))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Project not found");
    }
}
