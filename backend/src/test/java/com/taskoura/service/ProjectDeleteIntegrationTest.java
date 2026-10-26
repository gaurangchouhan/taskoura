package com.taskoura.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.dto.AiDtos.GenerateProjectPlanRequest;
import com.taskoura.dto.AiDtos.GenerateTestCasesRequest;
import com.taskoura.dto.AttachmentDtos.AttachmentResponse;
import com.taskoura.dto.BugDtos.CreateBugRequest;
import com.taskoura.dto.CommentDtos.CreateCommentRequest;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.dto.ProjectMemberDtos.InviteMemberRequest;
import com.taskoura.dto.TaskDtos.CreateTaskRequest;
import com.taskoura.dto.TaskDtos.TaskResponse;
import com.taskoura.dto.TestCaseDtos.CreateTestCaseRequest;
import com.taskoura.entity.User;
import com.taskoura.repository.UserRepository;
import com.taskoura.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ProjectDeleteIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Autowired private ProjectService projectService;
    @Autowired private ProjectMemberService projectMemberService;
    @Autowired private TaskService taskService;
    @Autowired private CommentService commentService;
    @Autowired private BugService bugService;
    @Autowired private TestCaseService testCaseService;
    @Autowired private AttachmentService attachmentService;
    @Autowired private NotificationService notificationService;
    @Autowired private UserRepository userRepository;
    @Autowired private SessionService sessionService;

    @MockitoBean private GrokClient grokClient;
    @MockitoBean private AttachmentStorageService attachmentStorageService;

    private User owner;
    private User member;
    private User outsider;

    private String ownerToken;
    private String memberToken;
    private String outsiderToken;

    private ProjectResponse project1;
    private ProjectResponse project2;

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

        member = userRepository.save(User.builder()
                .name("Member Alice")
                .email("member-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hash")
                .verified(true)
                .build());

        outsider = userRepository.save(User.builder()
                .name("Outsider Bob")
                .email("outsider-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hash")
                .verified(true)
                .build());

        ownerToken = tokenFor(owner);
        memberToken = tokenFor(member);
        outsiderToken = tokenFor(outsider);

        LocalDate deadline = LocalDate.now().plusMonths(1);

        // Project 1
        project1 = projectService.createProject(owner.getEmail(), new CreateProjectRequest(
                "Project Alpha", "Description 1", "React", "Spring Boot", "PostgreSQL", "JUnit", deadline
        ));
        projectMemberService.inviteMember(project1.id(), new InviteMemberRequest(member.getEmail(), "Developer"));

        // Project 2 (for isolation testing)
        project2 = projectService.createProject(owner.getEmail(), new CreateProjectRequest(
                "Project Beta", "Description 2", "Vue", "Node", "MongoDB", "Jest", deadline
        ));
        projectMemberService.inviteMember(project2.id(), new InviteMemberRequest(member.getEmail(), "Developer"));
    }

    @Test
    @DisplayName("Owner deletes project (204 No Content with no body), omitted from GET /api/projects for everyone")
    void ownerDeletesProject_returns204_andOmittedFromGetProjects() throws Exception {
        mockMvc.perform(delete("/api/projects/{projectId}", project1.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));

        // GET /api/projects as owner: project1 is omitted, project2 is present
        mockMvc.perform(get("/api/projects")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", not(hasItem(project1.id().toString()))))
                .andExpect(jsonPath("$[*].id", hasItem(project2.id().toString())));

        // GET /api/projects as member: project1 is omitted, project2 is present
        mockMvc.perform(get("/api/projects")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", not(hasItem(project1.id().toString()))))
                .andExpect(jsonPath("$[*].id", hasItem(project2.id().toString())));

        // GET /api/projects as outsider: project1 is absent
        mockMvc.perform(get("/api/projects")
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", not(hasItem(project1.id().toString()))));
    }

    @Test
    @DisplayName("Every endpoint under deleted project returns 404")
    void deletedProject_everySubEndpointReturns404() throws Exception {
        // Delete project1
        projectService.deleteProject(project1.id(), owner.getEmail());

        // GET /api/projects/{projectId}
        mockMvc.perform(get("/api/projects/{projectId}", project1.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // GET /api/projects/{projectId}/tasks
        mockMvc.perform(get("/api/projects/{projectId}/tasks", project1.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // GET /api/projects/{projectId}/members
        mockMvc.perform(get("/api/projects/{projectId}/members", project1.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // GET /api/projects/{projectId}/dashboard
        mockMvc.perform(get("/api/projects/{projectId}/dashboard", project1.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // GET /api/projects/{projectId}/calendar
        mockMvc.perform(get("/api/projects/{projectId}/calendar", project1.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // GET /api/projects/{projectId}/report
        mockMvc.perform(get("/api/projects/{projectId}/report", project1.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // GET /api/projects/{projectId}/activity
        mockMvc.perform(get("/api/projects/{projectId}/activity", project1.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // POST /api/projects/{projectId}/templates/{templateId}/apply
        mockMvc.perform(post("/api/projects/{projectId}/templates/dummy-template/apply", project1.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // GET /api/ai/next-task/{projectId}
        mockMvc.perform(get("/api/ai/next-task/{projectId}", project1.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // POST /api/ai/project-plan
        mockMvc.perform(post("/api/ai/project-plan")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GenerateProjectPlanRequest(project1.id()))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("Tasks and subtasks of deleted project are hidden everywhere and return 404")
    void deletedProject_tasksAndSubtasksReturn404() throws Exception {
        LocalDate taskDeadline = LocalDate.now().plusDays(10);
        TaskResponse parentTask = taskService.createTask(project1.id(), new CreateTaskRequest(
                "Parent Task", "Parent Desc", "Backend", "High", member.getId(), taskDeadline
        ), owner.getEmail());

        TaskResponse subtask = taskService.createSubtask(parentTask.id(), new CreateTaskRequest(
                "Subtask 1", "Subtask Desc", "Backend", "Medium", member.getId(), taskDeadline
        ), owner.getEmail());

        commentService.addComment(parentTask.id(), new CreateCommentRequest("Comment on parent"), owner.getEmail());

        bugService.createBug(parentTask.id(), new CreateBugRequest("High", "Bug desc", null), owner.getEmail());
        testCaseService.createTestCase(parentTask.id(), new CreateTestCaseRequest("Test case title", "Steps", true), owner.getEmail());

        when(attachmentStorageService.uploadFile(any())).thenReturn("https://res.cloudinary.com/test_cloud/image/upload/mockup_v1.png");
        MockMultipartFile file = new MockMultipartFile("file", "test.png", "image/png", new byte[]{1, 2, 3});
        attachmentService.addAttachment(parentTask.id(), file, owner.getEmail());

        // Soft-delete project1
        projectService.deleteProject(project1.id(), owner.getEmail());

        // GET /api/tasks/{taskId}
        mockMvc.perform(get("/api/tasks/{taskId}", parentTask.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // GET /api/tasks/{taskId}/subtasks
        mockMvc.perform(get("/api/tasks/{taskId}/subtasks", parentTask.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // GET /api/tasks/{subtaskId}
        mockMvc.perform(get("/api/tasks/{taskId}", subtask.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // GET /api/tasks/{taskId}/comments
        mockMvc.perform(get("/api/tasks/{taskId}/comments", parentTask.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // GET /api/tasks/{taskId}/attachments
        mockMvc.perform(get("/api/tasks/{taskId}/attachments", parentTask.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // GET /api/tasks/{taskId}/bugs
        mockMvc.perform(get("/api/tasks/{taskId}/bugs", parentTask.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // GET /api/tasks/{taskId}/test-cases
        mockMvc.perform(get("/api/tasks/{taskId}/test-cases", parentTask.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // POST /api/ai/test-cases
        mockMvc.perform(post("/api/ai/test-cases")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GenerateTestCasesRequest(parentTask.id()))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("Non-owner member gets 403 Forbidden when attempting to delete project")
    void memberCannotDeleteProject_returns403() throws Exception {
        mockMvc.perform(delete("/api/projects/{projectId}", project1.id())
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    @DisplayName("Outsider gets 403 Forbidden when attempting to delete project")
    void outsiderCannotDeleteProject_returns403() throws Exception {
        mockMvc.perform(delete("/api/projects/{projectId}", project1.id())
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    @DisplayName("Deleting twice gives 404 Not Found")
    void deletingTwice_returns404() throws Exception {
        // First delete: 204
        mockMvc.perform(delete("/api/projects/{projectId}", project1.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNoContent());

        // Second delete: 404
        mockMvc.perform(delete("/api/projects/{projectId}", project1.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("Other projects are unaffected: member lists, tasks, report, and dashboard remain intact")
    void otherProjectsRemainUnaffected() throws Exception {
        TaskResponse taskP2 = taskService.createTask(project2.id(), new CreateTaskRequest(
                "Beta Task", "Beta Desc", "Frontend", "High", member.getId(), LocalDate.now().plusDays(5)
        ), owner.getEmail());

        // Owner deletes project1
        mockMvc.perform(delete("/api/projects/{projectId}", project1.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNoContent());

        // Project 2 members list is intact
        mockMvc.perform(get("/api/projects/{projectId}/members", project2.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2))); // Owner and Member Alice

        // Project 2 tasks list is intact
        mockMvc.perform(get("/api/projects/{projectId}/tasks", project2.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem(taskP2.id().toString())));

        // Project 2 report is unaffected
        mockMvc.perform(get("/api/projects/{projectId}/report", project2.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        // Project 2 dashboard is unaffected
        mockMvc.perform(get("/api/projects/{projectId}/dashboard", project2.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTasks").value(1));
    }

    @Test
    @DisplayName("Database retention: rows still exist in DB with deleted_at set, child rows retained, Cloudinary not deleted")
    void databaseRetention_rowsStillExistInDatabase() throws Exception {
        LocalDate taskDeadline = LocalDate.now().plusDays(10);
        TaskResponse parentTask = taskService.createTask(project1.id(), new CreateTaskRequest(
                "Retained Parent", "Desc", "Backend", "High", member.getId(), taskDeadline
        ), owner.getEmail());

        TaskResponse subtask = taskService.createSubtask(parentTask.id(), new CreateTaskRequest(
                "Retained Subtask", "Desc", "Backend", "Medium", member.getId(), taskDeadline
        ), owner.getEmail());

        commentService.addComment(parentTask.id(), new CreateCommentRequest("Retained Comment"), owner.getEmail());

        when(attachmentStorageService.uploadFile(any())).thenReturn("https://res.cloudinary.com/test_cloud/image/upload/mockup_v1.png");
        MockMultipartFile file = new MockMultipartFile("file", "test.png", "image/png", new byte[]{1, 2, 3});
        attachmentService.addAttachment(parentTask.id(), file, owner.getEmail());

        // Delete project
        projectService.deleteProject(project1.id(), owner.getEmail());

        // 1. Verify projects table via raw SQL (bypassing Hibernate soft-delete filter)
        Map<String, Object> projectRow = jdbcTemplate.queryForMap(
                "SELECT deleted_at, deleted_by FROM projects WHERE id = ?", project1.id()
        );
        assertThat(projectRow.get("deleted_at")).isNotNull();
        assertThat(projectRow.get("deleted_by")).isEqualTo(owner.getId());

        // 2. Verify tasks table via raw SQL: both parent and subtask have deleted_at and deleted_by set
        Integer deletedTasksCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM tasks WHERE (project_id = ? OR parent_task_id = ?) AND deleted_at IS NOT NULL AND deleted_by = ?",
                Integer.class, project1.id(), parentTask.id(), owner.getId()
        );
        assertThat(deletedTasksCount).isEqualTo(2);

        // 3. Verify child rows in database are kept/retained (not hard deleted)
        Integer membersCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM project_members WHERE project_id = ?",
                Integer.class, project1.id()
        );
        assertThat(membersCount).isGreaterThanOrEqualTo(2); // owner + member

        Integer commentsCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM comments WHERE task_id = ?",
                Integer.class, parentTask.id()
        );
        assertThat(commentsCount).isEqualTo(1);

        Integer attachmentsCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM attachments WHERE task_id = ?",
                Integer.class, parentTask.id()
        );
        assertThat(attachmentsCount).isEqualTo(1);

        Integer activityLogsCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM activity_logs WHERE project_id = ?",
                Integer.class, project1.id()
        );
        assertThat(activityLogsCount).isGreaterThan(0);
    }

    @Test
    @DisplayName("Notifications that mention the project stay readable without error when project is hidden")
    void notificationsRemainReadableWhenProjectDeleted() throws Exception {
        // Adding member generated an activity log / notification
        // Delete project
        projectService.deleteProject(project1.id(), owner.getEmail());

        // Member queries notifications
        mockMvc.perform(get("/api/notifications")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }
}
