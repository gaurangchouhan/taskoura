package com.taskoura.service;

import com.taskoura.dto.DashboardReportDtos.DashboardResponse;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.dto.TaskDtos.CreateTaskRequest;
import com.taskoura.dto.TaskDtos.TaskResponse;
import com.taskoura.entity.User;
import com.taskoura.exception.BadRequestException;
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
class SubtaskIntegrationTest {

    @Autowired private TaskService taskService;
    @Autowired private ProjectService projectService;
    @Autowired private DashboardReportService dashboardReportService;
    @Autowired private UserRepository userRepository;

    private User owner;
    private ProjectResponse project;

    @BeforeEach
    void setUp() {
        owner = userRepository.save(User.builder()
                .name("Subtask Owner")
                .email("subtask-owner-" + UUID.randomUUID() + "@test.com")
                .passwordHash("pass")
                .verified(true)
                .build());

        project = projectService.createProject(owner.getEmail(),
                new CreateProjectRequest("Subtask Project", "Testing subtask hierarchies",
                        "React", "Spring Boot", "PostgreSQL", "JUnit 5", LocalDate.now().plusMonths(2)));
    }

    @Test
    @DisplayName("Create parent task and 2 subtasks: GET returns both, parent shows subtaskCount: 2")
    void testCreateParentAndSubtasks() {
        // 1. Create parent task
        TaskResponse parentTask = taskService.createTask(project.id(), new CreateTaskRequest(
                "Epic Feature", "Main feature parent", "Backend", "High", owner.getId(), LocalDate.now().plusDays(10)
        ));

        assertThat(parentTask.subtaskCount()).isEqualTo(0);
        assertThat(parentTask.parentTaskId()).isNull();

        // 2. Add 2 subtasks to it
        TaskResponse subtask1 = taskService.createSubtask(parentTask.id(), new CreateTaskRequest(
                "Database Migration", "Write Liquibase/Flyway migration", "Database", "High", owner.getId(), LocalDate.now().plusDays(3)
        ));

        TaskResponse subtask2 = taskService.createSubtask(parentTask.id(), new CreateTaskRequest(
                "API Endpoint", "Controller and service implementation", "Backend", "High", owner.getId(), LocalDate.now().plusDays(5)
        ));

        assertThat(subtask1.parentTaskId()).isEqualTo(parentTask.id());
        assertThat(subtask2.parentTaskId()).isEqualTo(parentTask.id());

        // 3. GET the parent's subtasks -> confirm both appear
        List<TaskResponse> subtasks = taskService.getSubtasks(parentTask.id());
        assertThat(subtasks).hasSize(2);
        assertThat(subtasks).extracting(TaskResponse::title)
                .containsExactlyInAnyOrder("Database Migration", "API Endpoint");

        // 4. Confirm the parent task's TaskResponse now shows subtaskCount: 2
        List<TaskResponse> projectTasks = taskService.getTasksForProject(project.id());
        TaskResponse updatedParent = projectTasks.stream()
                .filter(t -> t.id().equals(parentTask.id()))
                .findFirst()
                .orElseThrow();

        assertThat(updatedParent.subtaskCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("Attempt to create a subtask of a subtask -> clear BadRequestException rejection")
    void testNestedSubtaskRejection() {
        // 1. Create top-level parent task
        TaskResponse parentTask = taskService.createTask(project.id(), new CreateTaskRequest(
                "Root Task", "Root task", "Backend", "Medium", owner.getId(), LocalDate.now().plusDays(7)
        ));

        // 2. Create subtask
        TaskResponse subtask = taskService.createSubtask(parentTask.id(), new CreateTaskRequest(
                "Level 1 Subtask", "Direct child", "Frontend", "Medium", owner.getId(), LocalDate.now().plusDays(4)
        ));

        // 3. Attempt to create a child of the subtask (Level 2 nesting) -> Expect rejection!
        CreateTaskRequest nestedReq = new CreateTaskRequest(
                "Level 2 Subtask", "Disallowed nesting", "Testing", "Low", owner.getId(), LocalDate.now().plusDays(2)
        );

        assertThatThrownBy(() -> taskService.createSubtask(subtask.id(), nestedReq))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Subtasks cannot have nested subtasks (maximum 1 level of nesting allowed)");
    }

    @Test
    @DisplayName("Dashboard stats: subtasks are excluded from totalTasks to prevent double-counting parent progress")
    void testDashboardExcludesSubtasks() {
        // Create 1 parent task
        TaskResponse parentTask = taskService.createTask(project.id(), new CreateTaskRequest(
                "Deliverable 1", "Parent milestone", "Backend", "High", owner.getId(), LocalDate.now().plusDays(5)
        ));

        // Create 2 subtasks under it
        taskService.createSubtask(parentTask.id(), new CreateTaskRequest(
                "Subtask A", "Part A", "Backend", "Medium", owner.getId(), LocalDate.now().plusDays(2)
        ));
        taskService.createSubtask(parentTask.id(), new CreateTaskRequest(
                "Subtask B", "Part B", "Frontend", "Medium", owner.getId(), LocalDate.now().plusDays(3)
        ));

        // Dashboard stats should reflect 1 deliverable task (parent), not 3
        DashboardResponse dashboard = dashboardReportService.getDashboard(project.id());
        assertThat(dashboard.totalTasks()).isEqualTo(1);
    }
}
