package com.taskoura.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.dto.CommentDtos.CreateCommentRequest;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.dto.ProjectMemberDtos.InviteMemberRequest;
import com.taskoura.dto.TaskDtos.CreateTaskRequest;
import com.taskoura.dto.TaskDtos.TaskResponse;
import com.taskoura.dto.TaskDtos.UpdateTaskRequest;
import com.taskoura.entity.Task;
import com.taskoura.entity.User;
import com.taskoura.repository.TaskRepository;
import com.taskoura.repository.UserRepository;
import com.taskoura.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class TaskEditAndDeleteIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtUtil jwtUtil;

    @Autowired private TaskService taskService;
    @Autowired private ProjectService projectService;
    @Autowired private ProjectMemberService projectMemberService;
    @Autowired private CommentService commentService;
    @Autowired private UserRepository userRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private SessionService sessionService;

    @MockitoBean private GrokClient grokClient;

    private User owner;
    private User memberA;
    private User memberB;
    private User outsider;

    private String ownerToken;
    private String memberAToken;
    private String memberBToken;
    private String outsiderToken;

    private ProjectResponse project;

    private String tokenFor(User user) {
        var s = sessionService.createSession(user, "TestAgent");
        return jwtUtil.generateToken(user.getEmail(), s.getId(), s.getAbsoluteExpiresAt());
    }

    @BeforeEach
    void setUp() {
        owner = userRepository.save(User.builder()
                .name("Owner User")
                .email("owner-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hash")
                .verified(true)
                .build());

        memberA = userRepository.save(User.builder()
                .name("Member Alice")
                .email("alice-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hash")
                .verified(true)
                .build());

        memberB = userRepository.save(User.builder()
                .name("Member Bob")
                .email("bob-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hash")
                .verified(true)
                .build());

        outsider = userRepository.save(User.builder()
                .name("Outsider User")
                .email("outsider-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hash")
                .verified(true)
                .build());

        ownerToken = tokenFor(owner);
        memberAToken = tokenFor(memberA);
        memberBToken = tokenFor(memberB);
        outsiderToken = tokenFor(outsider);

        project = projectService.createProject(owner.getEmail(), new CreateProjectRequest(
                "Task Edit Project", "Testing edits and deletes", "React", "Spring Boot", "PostgreSQL", "JUnit 5",
                LocalDate.now().plusMonths(2)
        ));

        // Add memberA and memberB
        projectMemberService.inviteMember(project.id(), new InviteMemberRequest(memberA.getEmail(), "Member"));
        projectMemberService.inviteMember(project.id(), new InviteMemberRequest(memberB.getEmail(), "Member"));
    }

    @Test
    @DisplayName("Edit task: each editable field can be updated")
    void editTask_eachFieldUpdated() throws Exception {
        TaskResponse created = taskService.createTask(project.id(), new CreateTaskRequest(
                "Initial Title", "Initial Desc", "Backend", "Low", null, null
        ), owner.getEmail());

        LocalDate newDeadline = LocalDate.now().plusDays(10);
        UpdateTaskRequest updateReq = new UpdateTaskRequest(
                "Updated Title", "Updated Desc", "Frontend", "High", memberA.getId(), newDeadline
        );

        mockMvc.perform(put("/api/tasks/{taskId}", created.id())
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(created.id().toString()))
                .andExpect(jsonPath("$.title").value("Updated Title"))
                .andExpect(jsonPath("$.description").value("Updated Desc"))
                .andExpect(jsonPath("$.category").value("Frontend"))
                .andExpect(jsonPath("$.priority").value("High"))
                .andExpect(jsonPath("$.assignedTo").value(memberA.getId().toString()))
                .andExpect(jsonPath("$.deadline").value(newDeadline.toString()))
                .andExpect(jsonPath("$.status").value("Backlog"))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty())
                .andExpect(jsonPath("$.updatedBy.id").value(owner.getId().toString()))
                .andExpect(jsonPath("$.updatedBy.name").value("Owner User"))
                .andExpect(jsonPath("$.createdBy.id").value(owner.getId().toString()))
                .andExpect(jsonPath("$.createdBy.name").value("Owner User"));
    }

    @Test
    @DisplayName("Edit task: no-change save leaves updatedAt null and status untouched")
    void editTask_noChange_leavesUpdatedAtNull() throws Exception {
        TaskResponse created = taskService.createTask(project.id(), new CreateTaskRequest(
                "Unchanged Title", "Unchanged Desc", "Backend", "Medium", null, null
        ), memberA.getEmail());

        assertThat(created.updatedAt()).isNull();

        UpdateTaskRequest noChangeReq = new UpdateTaskRequest(
                "Unchanged Title", "Unchanged Desc", "Backend", "Medium", null, null
        );

        mockMvc.perform(put("/api/tasks/{taskId}", created.id())
                        .header("Authorization", "Bearer " + memberAToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(noChangeReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updatedAt").doesNotExist())
                .andExpect(jsonPath("$.status").value("Backlog"));

        Task fresh = taskRepository.findById(created.id()).orElseThrow();
        assertThat(fresh.getUpdatedAt()).isNull();
        assertThat(fresh.getUpdatedBy()).isNull();
        assertThat(fresh.getStatus()).isEqualTo("Backlog");
    }

    @Test
    @DisplayName("Edit task: invalid category returns 400 VALIDATION_FAILED with fieldErrors")
    void editTask_invalidCategory_returns400() throws Exception {
        TaskResponse created = taskService.createTask(project.id(), new CreateTaskRequest(
                "Valid Title", "Desc", "Backend", "Medium", null, null
        ), owner.getEmail());

        UpdateTaskRequest badCategory = new UpdateTaskRequest(
                "Valid Title", "Desc", "DevOps", "Medium", null, null
        );

        mockMvc.perform(put("/api/tasks/{taskId}", created.id())
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badCategory)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.category").isNotEmpty());
    }

    @Test
    @DisplayName("Edit task: invalid title lengths return 400 VALIDATION_FAILED with fieldErrors")
    void editTask_invalidTitle_returns400() throws Exception {
        TaskResponse created = taskService.createTask(project.id(), new CreateTaskRequest(
                "Valid Title", "Desc", "Backend", "Medium", null, null
        ), owner.getEmail());

        // Blank title
        UpdateTaskRequest emptyTitle = new UpdateTaskRequest(
                "   ", "Desc", "Backend", "Medium", null, null
        );
        mockMvc.perform(put("/api/tasks/{taskId}", created.id())
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(emptyTitle)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.title").isNotEmpty());

        // > 200 chars title
        String tooLong = "A".repeat(201);
        UpdateTaskRequest longTitle = new UpdateTaskRequest(
                tooLong, "Desc", "Backend", "Medium", null, null
        );
        mockMvc.perform(put("/api/tasks/{taskId}", created.id())
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(longTitle)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.title").isNotEmpty());
    }

    @Test
    @DisplayName("Edit task: assignee not in project returns 400 VALIDATION_FAILED with fieldErrors")
    void editTask_assigneeNotInProject_returns400() throws Exception {
        TaskResponse created = taskService.createTask(project.id(), new CreateTaskRequest(
                "Task", "Desc", "Backend", "Medium", null, null
        ), owner.getEmail());

        UpdateTaskRequest outsiderAssignee = new UpdateTaskRequest(
                "Task", "Desc", "Backend", "Medium", outsider.getId(), null
        );

        mockMvc.perform(put("/api/tasks/{taskId}", created.id())
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(outsiderAssignee)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.assignedTo").isNotEmpty());
    }

    @Test
    @DisplayName("Edit task: non-member returns 403 FORBIDDEN")
    void editTask_nonMember_returns403() throws Exception {
        TaskResponse created = taskService.createTask(project.id(), new CreateTaskRequest(
                "Task", "Desc", "Backend", "Medium", null, null
        ), owner.getEmail());

        UpdateTaskRequest validReq = new UpdateTaskRequest(
                "New Title", "Desc", "Backend", "Medium", null, null
        );

        mockMvc.perform(put("/api/tasks/{taskId}", created.id())
                        .header("Authorization", "Bearer " + outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    @DisplayName("Edit task: deleted task returns 404 NOT_FOUND")
    void editTask_deletedTask_returns404() throws Exception {
        TaskResponse created = taskService.createTask(project.id(), new CreateTaskRequest(
                "Task To Delete", "Desc", "Backend", "Medium", null, null
        ), owner.getEmail());

        taskService.deleteTask(created.id(), owner.getEmail());

        UpdateTaskRequest updateReq = new UpdateTaskRequest(
                "Updated", "Desc", "Backend", "Medium", null, null
        );

        mockMvc.perform(put("/api/tasks/{taskId}", created.id())
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("Delete task: project Owner is allowed and receives 204 No Content")
    void deleteTask_ownerAllowed() throws Exception {
        TaskResponse created = taskService.createTask(project.id(), new CreateTaskRequest(
                "Owner Task", "Desc", "Backend", "Medium", null, null
        ), memberA.getEmail());

        mockMvc.perform(delete("/api/tasks/{taskId}", created.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/tasks/{taskId}", created.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Delete task: task creator is allowed and receives 204 No Content")
    void deleteTask_creatorAllowed() throws Exception {
        TaskResponse created = taskService.createTask(project.id(), new CreateTaskRequest(
                "Alice Task", "Desc", "Backend", "Medium", null, null
        ), memberA.getEmail());

        mockMvc.perform(delete("/api/tasks/{taskId}", created.id())
                        .header("Authorization", "Bearer " + memberAToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/tasks/{taskId}", created.id())
                        .header("Authorization", "Bearer " + memberAToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Delete task: non-creator member returns 403 FORBIDDEN")
    void deleteTask_otherMember_returns403() throws Exception {
        TaskResponse created = taskService.createTask(project.id(), new CreateTaskRequest(
                "Alice's Private Task", "Desc", "Backend", "Medium", null, null
        ), memberA.getEmail());

        mockMvc.perform(delete("/api/tasks/{taskId}", created.id())
                        .header("Authorization", "Bearer " + memberBToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    @DisplayName("Delete task: subtasks are hidden in cascade soft delete")
    void deleteTask_subtasksHiddenCascade() throws Exception {
        TaskResponse parent = taskService.createTask(project.id(), new CreateTaskRequest(
                "Parent Task", "Desc", "Backend", "High", null, null
        ), owner.getEmail());

        TaskResponse subtask1 = taskService.createSubtask(parent.id(), new CreateTaskRequest(
                "Subtask 1", "Desc", "Frontend", "Medium", null, null
        ), owner.getEmail());

        TaskResponse subtask2 = taskService.createSubtask(parent.id(), new CreateTaskRequest(
                "Subtask 2", "Desc", "Testing", "Low", null, null
        ), owner.getEmail());

        // Delete parent task
        mockMvc.perform(delete("/api/tasks/{taskId}", parent.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNoContent());

        // Parent returns 404
        mockMvc.perform(get("/api/tasks/{taskId}", parent.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound());

        // Subtask endpoint returns 404
        mockMvc.perform(get("/api/tasks/{taskId}/subtasks", parent.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound());

        // Direct subtasks return 404
        mockMvc.perform(get("/api/tasks/{taskId}", subtask1.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/tasks/{taskId}", subtask2.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Delete task: dashboard, calendar, report exclude the deleted task")
    void deleteTask_excludedFromDashboardCalendarReport() throws Exception {
        LocalDate deadline = LocalDate.now().plusDays(5);
        TaskResponse task1 = taskService.createTask(project.id(), new CreateTaskRequest(
                "Keep Task", "Desc", "Backend", "High", owner.getId(), deadline
        ), owner.getEmail());

        TaskResponse task2 = taskService.createTask(project.id(), new CreateTaskRequest(
                "Delete Task", "Desc", "Frontend", "Medium", owner.getId(), deadline
        ), owner.getEmail());

        // Dashboard before delete has 2 tasks
        mockMvc.perform(get("/api/projects/{projectId}/dashboard", project.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTasks").value(2));

        // Delete task2
        taskService.deleteTask(task2.id(), owner.getEmail());

        // Dashboard after delete has 1 task
        mockMvc.perform(get("/api/projects/{projectId}/dashboard", project.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTasks").value(1));

        // Calendar excludes task2
        mockMvc.perform(get("/api/projects/{projectId}/calendar", project.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days[*].tasks[*].id", not(hasItem(task2.id().toString()))));

        // Report excludes task2
        mockMvc.perform(get("/api/projects/{projectId}/report", project.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.userId == '" + owner.getId() + "')].tasksAssigned", hasItem(1)));
    }

    @Test
    @DisplayName("Delete task: comments endpoint returns 404 afterwards")
    void deleteTask_commentsEndpointReturns404() throws Exception {
        TaskResponse task = taskService.createTask(project.id(), new CreateTaskRequest(
                "Comment Task", "Desc", "Backend", "Medium", null, null
        ), owner.getEmail());

        commentService.addComment(task.id(), new CreateCommentRequest("Nice task!"), owner.getEmail());

        // Verify comment exists
        mockMvc.perform(get("/api/tasks/{taskId}/comments", task.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));

        // Delete task
        taskService.deleteTask(task.id(), owner.getEmail());

        // Comments endpoint now returns 404
        mockMvc.perform(get("/api/tasks/{taskId}/comments", task.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }
}
