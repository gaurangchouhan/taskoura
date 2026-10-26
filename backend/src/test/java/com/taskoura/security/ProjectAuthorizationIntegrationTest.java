package com.taskoura.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.dto.AiDtos.ConfirmProjectPlanRequest;
import com.taskoura.dto.AiDtos.GenerateProjectPlanRequest;
import com.taskoura.dto.AiDtos.GenerateTestCasesRequest;
import com.taskoura.dto.BugDtos.CreateBugRequest;
import com.taskoura.dto.CommentDtos.CreateCommentRequest;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.dto.ProjectMemberDtos.InviteMemberRequest;
import com.taskoura.dto.ProjectMemberDtos.UpdateRoleRequest;
import com.taskoura.dto.TaskDtos.CreateTaskRequest;
import com.taskoura.dto.TaskDtos.TaskResponse;
import com.taskoura.dto.TaskDtos.UpdateTaskStatusRequest;
import com.taskoura.dto.TestCaseDtos.CreateTestCaseRequest;
import com.taskoura.entity.Attachment;
import com.taskoura.entity.Bug;
import com.taskoura.entity.Project;
import com.taskoura.entity.TestCase;
import com.taskoura.entity.User;
import com.taskoura.repository.*;
import com.taskoura.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ProjectAuthorizationIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtUtil jwtUtil;

    @Autowired private UserRepository userRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private ProjectMemberRepository projectMemberRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private BugRepository bugRepository;
    @Autowired private TestCaseRepository testCaseRepository;
    @Autowired private AttachmentRepository attachmentRepository;

    @Autowired private ProjectService projectService;
    @Autowired private ProjectMemberService projectMemberService;
    @Autowired private TaskService taskService;
    @Autowired private SessionService sessionService;

    @MockitoBean private GrokClient grokClient;
    @MockitoBean private JavaMailSender mailSender;
    @MockitoBean private AttachmentStorageService attachmentStorageService;

    private User owner;
    private User member;
    private User outsider;

    private String ownerToken;
    private String memberToken;
    private String outsiderToken;

    private ProjectResponse project;
    private TaskResponse task;
    private Bug bug;
    private TestCase testCase;
    private Project legacyProject;
    private Attachment attachment;

    private String tokenFor(User user) {
        var s = sessionService.createSession(user, "TestAgent");
        return jwtUtil.generateToken(user.getEmail(), s.getId(), s.getAbsoluteExpiresAt());
    }

    @BeforeEach
    void setUp() {
        owner = userRepository.save(User.builder()
                .name("Alice Owner")
                .email("owner-auth-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());

        member = userRepository.save(User.builder()
                .name("Bob Member")
                .email("member-auth-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());

        outsider = userRepository.save(User.builder()
                .name("Charlie Outsider")
                .email("outsider-auth-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());

        ownerToken = tokenFor(owner);
        memberToken = tokenFor(member);
        outsiderToken = tokenFor(outsider);

        // Create main project
        project = projectService.createProject(owner.getEmail(),
                new CreateProjectRequest("Auth Test Project", "Testing authorization",
                        "React", "Spring Boot", "PostgreSQL", "JUnit 5", LocalDate.now().plusMonths(2)));

        // Invite member
        projectMemberService.inviteMember(project.id(), new InviteMemberRequest(member.getEmail(), "Member"));

        // Create task
        task = taskService.createTask(project.id(),
                new CreateTaskRequest("Auth Test Task", "Verify access controls", "Security", "High", member.getId(), LocalDate.now().plusDays(7)));

        // Create a bug directly on the task
        bug = bugRepository.save(Bug.builder()
                .task(taskRepository.findById(task.id()).orElseThrow())
                .description("Sample Bug")
                .severity("High")
                .status("Open")
                .reportedBy(member)
                .build());

        // Create a test case directly on the task
        testCase = testCaseRepository.save(TestCase.builder()
                .task(taskRepository.findById(task.id()).orElseThrow())
                .description("Sample Test Case")
                .expectedResult("Passes successfully")
                .passed(true)
                .executedBy(member)
                .build());

        // Create a legacy project directly in DB (owner set, but NO ProjectMember row)
        legacyProject = projectRepository.save(Project.builder()
                .name("Legacy Project")
                .description("Project created prior to member tracking")
                .owner(owner)
                .frontendStack("Vue")
                .backendStack("Node")
                .databaseStack("Mongo")
                .testingStack("Jest")
                .deadline(LocalDate.now().plusMonths(3))
                .build());

        // Create attachment
        attachment = attachmentRepository.save(Attachment.builder()
                .task(taskRepository.findById(task.id()).orElseThrow())
                .fileName("spec.pdf")
                .fileType("application/pdf")
                .fileUrl("https://example.com/spec.pdf")
                .uploadedBy(member)
                .build());
    }

    // ==========================================
    // 1. GET /api/projects
    // ==========================================
    @Test
    @DisplayName("GET /api/projects returns owned and member projects with proper roles, excludes outsider, no duplicates")
    void getProjects_returnsOwnedAndMemberProjectsWithRole() throws Exception {
        // Owner sees project with role "Owner" and legacyProject with role "Owner"
        mockMvc.perform(get("/api/projects").header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[?(@.id == '" + project.id() + "')].role").value("Owner"))
                .andExpect(jsonPath("$[?(@.id == '" + legacyProject.getId() + "')].role").value("Owner"));

        // Member sees invited project with role "Member"
        mockMvc.perform(get("/api/projects").header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(project.id().toString()))
                .andExpect(jsonPath("$[0].role").value("Member"));

        // Outsider sees empty list
        mockMvc.perform(get("/api/projects").header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    // ==========================================
    // 2. GET /api/projects/{id}
    // ==========================================
    @Test
    @DisplayName("GET /api/projects/{id} allows owner and member, rejects outsider with 403, unknown with 404")
    void getProjectById_accessControl() throws Exception {
        // Owner allowed with role Owner
        mockMvc.perform(get("/api/projects/" + project.id()).header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("Owner"));

        // Member allowed with role Member
        mockMvc.perform(get("/api/projects/" + project.id()).header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("Member"));

        // Outsider rejected with 403
        mockMvc.perform(get("/api/projects/" + project.id()).header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")));

        // Unknown id rejected with 404
        mockMvc.perform(get("/api/projects/" + UUID.randomUUID()).header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // Legacy project works for its owner
        mockMvc.perform(get("/api/projects/" + legacyProject.getId()).header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("Owner"));
    }

    // ==========================================
    // 3. Member Management (Owner Only)
    // ==========================================
    @Test
    @DisplayName("Owner-only: invite, change role, remove member reject member and outsider with 403")
    void memberManagement_ownerOnlyEnforced() throws Exception {
        User newUser = userRepository.save(User.builder()
                .name("New User")
                .email("new-user-" + UUID.randomUUID() + "@example.com")
                .passwordHash("pass")
                .verified(true)
                .build());

        InviteMemberRequest inviteReq = new InviteMemberRequest(newUser.getEmail(), "Member");

        // 1. Invite: plain member gets 403
        mockMvc.perform(post("/api/projects/" + project.id() + "/members")
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(inviteReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        // Invite: outsider gets 403
        mockMvc.perform(post("/api/projects/" + project.id() + "/members")
                        .header("Authorization", "Bearer " + outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(inviteReq)))
                .andExpect(status().isForbidden());

        // Invite: unknown project gets 404
        mockMvc.perform(post("/api/projects/" + UUID.randomUUID() + "/members")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(inviteReq)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // 2. Change role: plain member gets 403
        UpdateRoleRequest updateRoleReq = new UpdateRoleRequest("Owner");
        mockMvc.perform(put("/api/projects/" + project.id() + "/members/" + member.getId())
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRoleReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        // 3. Remove member: plain member gets 403
        mockMvc.perform(delete("/api/projects/" + project.id() + "/members/" + member.getId())
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        // Owner succeeds with invite
        mockMvc.perform(post("/api/projects/" + project.id() + "/members")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(inviteReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userEmail").value(newUser.getEmail()));
    }

    // ==========================================
    // 4. Members List (Members Only)
    // ==========================================
    @Test
    @DisplayName("GET /api/projects/{projectId}/members allows member, rejects outsider with 403, unknown with 404")
    void getMembers_accessControl() throws Exception {
        // Member allowed
        mockMvc.perform(get("/api/projects/" + project.id() + "/members")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));

        // Outsider gets 403
        mockMvc.perform(get("/api/projects/" + project.id() + "/members")
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        // Unknown gets 404
        mockMvc.perform(get("/api/projects/" + UUID.randomUUID() + "/members")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isNotFound());
    }

    // ==========================================
    // 5. Tasks Endpoints
    // ==========================================
    @Test
    @DisplayName("Task endpoints: member allowed, outsider gets 403, unknown gets 404")
    void taskEndpoints_accessControl() throws Exception {
        CreateTaskRequest createReq = new CreateTaskRequest("New Task", "Desc", "Backend", "Medium", null, null);

        // POST /api/projects/{id}/tasks
        mockMvc.perform(post("/api/projects/" + project.id() + "/tasks")
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/projects/" + project.id() + "/tasks")
                        .header("Authorization", "Bearer " + outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        mockMvc.perform(post("/api/projects/" + UUID.randomUUID() + "/tasks")
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isNotFound());

        // GET /api/projects/{id}/tasks
        mockMvc.perform(get("/api/projects/" + project.id() + "/tasks")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/projects/" + project.id() + "/tasks")
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());

        // GET /api/tasks/{id}
        mockMvc.perform(get("/api/tasks/" + task.id())
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/tasks/" + task.id())
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/tasks/" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isNotFound());

        // PATCH /api/tasks/{id}/status
        UpdateTaskStatusRequest statusReq = new UpdateTaskStatusRequest("IN_PROGRESS");
        mockMvc.perform(patch("/api/tasks/" + task.id() + "/status")
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(statusReq)))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/tasks/" + task.id() + "/status")
                        .header("Authorization", "Bearer " + outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(statusReq)))
                .andExpect(status().isForbidden());

        // GET /api/tasks/{id}/status-logs
        mockMvc.perform(get("/api/tasks/" + task.id() + "/status-logs")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/tasks/" + task.id() + "/status-logs")
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());

        // Subtasks: POST & GET
        CreateTaskRequest subtaskReq = new CreateTaskRequest("Subtask 1", "Sub desc", "Backend", "Low", null, null);
        mockMvc.perform(post("/api/tasks/" + task.id() + "/subtasks")
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(subtaskReq)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/tasks/" + task.id() + "/subtasks")
                        .header("Authorization", "Bearer " + outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(subtaskReq)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/tasks/" + task.id() + "/subtasks")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/tasks/" + task.id() + "/subtasks")
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
    }

    // ==========================================
    // 6. Comments Endpoints
    // ==========================================
    @Test
    @DisplayName("Comments endpoints: member allowed, outsider gets 403, unknown task gets 404")
    void commentsEndpoints_accessControl() throws Exception {
        CreateCommentRequest req = new CreateCommentRequest("Looks great!");

        // POST /api/tasks/{taskId}/comments
        mockMvc.perform(post("/api/tasks/" + task.id() + "/comments")
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/tasks/" + task.id() + "/comments")
                        .header("Authorization", "Bearer " + outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/tasks/" + UUID.randomUUID() + "/comments")
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isNotFound());

        // GET /api/tasks/{taskId}/comments
        mockMvc.perform(get("/api/tasks/" + task.id() + "/comments")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/tasks/" + task.id() + "/comments")
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
    }

    // ==========================================
    // 7. Bugs Endpoints
    // ==========================================
    @Test
    @DisplayName("Bugs endpoints: member allowed, outsider gets 403, unknown gets 404")
    void bugsEndpoints_accessControl() throws Exception {
        CreateBugRequest req = new CreateBugRequest("High", "Found bug in login", null);

        // POST /api/tasks/{taskId}/bugs
        mockMvc.perform(post("/api/tasks/" + task.id() + "/bugs")
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/tasks/" + task.id() + "/bugs")
                        .header("Authorization", "Bearer " + outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());

        // GET /api/tasks/{taskId}/bugs
        mockMvc.perform(get("/api/tasks/" + task.id() + "/bugs")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/tasks/" + task.id() + "/bugs")
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());

        // PATCH /api/bugs/{bugId}/resolve
        mockMvc.perform(patch("/api/bugs/" + bug.getId() + "/resolve")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/bugs/" + bug.getId() + "/resolve")
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/bugs/" + UUID.randomUUID() + "/resolve")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isNotFound());
    }

    // ==========================================
    // 8. Test Cases Endpoints
    // ==========================================
    @Test
    @DisplayName("Test cases endpoints: member allowed, outsider gets 403, unknown gets 404")
    void testCaseEndpoints_accessControl() throws Exception {
        CreateTestCaseRequest req = new CreateTestCaseRequest("Verify token expiration", "Returns 401", true);

        // POST /api/tasks/{taskId}/test-cases
        mockMvc.perform(post("/api/tasks/" + task.id() + "/test-cases")
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/tasks/" + task.id() + "/test-cases")
                        .header("Authorization", "Bearer " + outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());

        // GET /api/tasks/{taskId}/test-cases
        mockMvc.perform(get("/api/tasks/" + task.id() + "/test-cases")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/tasks/" + task.id() + "/test-cases")
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
    }

    // ==========================================
    // 9. Dashboard and Report
    // ==========================================
    @Test
    @DisplayName("Dashboard allows members; Report is owner-only (member gets 403)")
    void dashboardAndReport_accessControl() throws Exception {
        // Dashboard: member allowed, outsider gets 403
        mockMvc.perform(get("/api/projects/" + project.id() + "/dashboard")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/projects/" + project.id() + "/dashboard")
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/projects/" + UUID.randomUUID() + "/dashboard")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isNotFound());

        // Report: owner allowed
        mockMvc.perform(get("/api/projects/" + project.id() + "/report")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk());

        // Report: plain member gets 403
        mockMvc.perform(get("/api/projects/" + project.id() + "/report")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        // Report: outsider gets 403
        mockMvc.perform(get("/api/projects/" + project.id() + "/report")
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
    }

    // ==========================================
    // 10. Calendar and Upcoming Deadlines
    // ==========================================
    @Test
    @DisplayName("Calendar endpoints: member allowed, outsider gets 403, unknown gets 404")
    void calendarEndpoints_accessControl() throws Exception {
        // Calendar
        mockMvc.perform(get("/api/projects/" + project.id() + "/calendar")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/projects/" + project.id() + "/calendar")
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/projects/" + UUID.randomUUID() + "/calendar")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isNotFound());

        // Upcoming deadlines
        mockMvc.perform(get("/api/projects/" + project.id() + "/deadlines/upcoming")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/projects/" + project.id() + "/deadlines/upcoming")
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
    }

    // ==========================================
    // 11. Activity Feed
    // ==========================================
    @Test
    @DisplayName("Activity feed: member allowed, outsider gets 403, unknown gets 404")
    void activityFeed_accessControl() throws Exception {
        mockMvc.perform(get("/api/projects/" + project.id() + "/activity")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/projects/" + project.id() + "/activity")
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/projects/" + UUID.randomUUID() + "/activity")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isNotFound());
    }

    // ==========================================
    // 12. Templates
    // ==========================================
    @Test
    @DisplayName("Templates: list is open to all logged in users; apply requires project membership")
    void templates_accessControl() throws Exception {
        // List templates: any authenticated user allowed
        mockMvc.perform(get("/api/templates").header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.templates", not(empty())));

        // Apply template: member allowed
        mockMvc.perform(post("/api/projects/" + project.id() + "/templates/library-management/apply")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk());

        // Apply template: outsider gets 403
        mockMvc.perform(post("/api/projects/" + project.id() + "/templates/library-management/apply")
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());

        // Apply template: unknown project gets 404
        mockMvc.perform(post("/api/projects/" + UUID.randomUUID() + "/templates/library-management/apply")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isNotFound());
    }

    // ==========================================
    // 13. Attachments
    // ==========================================
    @Test
    @DisplayName("Attachments: list & upload require task access; outsider gets 403")
    void attachments_accessControl() throws Exception {
        when(attachmentStorageService.uploadFile(any()))
                .thenReturn("https://example.com/uploaded.png");

        // GET attachments
        mockMvc.perform(get("/api/tasks/" + task.id() + "/attachments")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/tasks/" + task.id() + "/attachments")
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());

        // POST attachment
        MockMultipartFile file = new MockMultipartFile("file", "test.png", "image/png", "dummy".getBytes());
        mockMvc.perform(multipart("/api/tasks/" + task.id() + "/attachments")
                        .file(file)
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isCreated());

        mockMvc.perform(multipart("/api/tasks/" + task.id() + "/attachments")
                        .file(file)
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());

        // DELETE attachment by outsider -> 403
        mockMvc.perform(delete("/api/attachments/" + attachment.getId())
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());

        // DELETE attachment by unknown id -> 404
        mockMvc.perform(delete("/api/attachments/" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isNotFound());
    }

    // ==========================================
    // 14. AI Endpoints
    // ==========================================
    @Test
    @DisplayName("AI endpoints: member allowed, outsider gets 403, unknown gets 404")
    void aiEndpoints_accessControl() throws Exception {
        // Confirm plan: member allowed (returns 201)
        ConfirmProjectPlanRequest confirmReq = new ConfirmProjectPlanRequest(
                project.id(),
                List.of(new com.taskoura.dto.AiDtos.PlanModule("General", List.of(new com.taskoura.dto.AiDtos.PlanTask("Setup Auth", "Backend", "High"))))
        );
        mockMvc.perform(post("/api/ai/project-plan/confirm")
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(confirmReq)))
                .andExpect(status().isCreated());

        // Confirm plan: outsider gets 403
        mockMvc.perform(post("/api/ai/project-plan/confirm")
                        .header("Authorization", "Bearer " + outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(confirmReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        // Next task: member allowed
        mockMvc.perform(get("/api/ai/next-task/" + project.id())
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk());

        // Next task: outsider gets 403
        mockMvc.perform(get("/api/ai/next-task/" + project.id())
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        // Generate test cases: outsider gets 403
        GenerateTestCasesRequest tcReq = new GenerateTestCasesRequest(task.id());
        mockMvc.perform(post("/api/ai/test-cases")
                        .header("Authorization", "Bearer " + outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(tcReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        // Generate project plan: outsider gets 403
        GenerateProjectPlanRequest planReq = new GenerateProjectPlanRequest(project.id());
        mockMvc.perform(post("/api/ai/project-plan")
                        .header("Authorization", "Bearer " + outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(planReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    // ==========================================
    // 15. Legacy Project (No ProjectMember row for owner)
    // ==========================================
    @Test
    @DisplayName("Legacy project with no owner membership row works fully for its owner")
    void legacyProjectWithoutMembershipRow_worksForOwner() throws Exception {
        // Confirm no ProjectMember row exists for legacyProject
        boolean memberRowExists = projectMemberRepository.existsByProjectIdAndUserId(legacyProject.getId(), owner.getId());
        org.assertj.core.api.Assertions.assertThat(memberRowExists).isFalse();

        // 1. Owner can fetch project details
        mockMvc.perform(get("/api/projects/" + legacyProject.getId()).header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(legacyProject.getId().toString()))
                .andExpect(jsonPath("$.role").value("Owner"));

        // 2. Owner can list tasks
        mockMvc.perform(get("/api/projects/" + legacyProject.getId() + "/tasks").header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk());

        // 3. Owner can view dashboard
        mockMvc.perform(get("/api/projects/" + legacyProject.getId() + "/dashboard").header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk());

        // 4. Owner can view report
        mockMvc.perform(get("/api/projects/" + legacyProject.getId() + "/report").header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk());

        // 5. Owner can invite a member
        InviteMemberRequest inviteReq = new InviteMemberRequest(member.getEmail(), "Member");
        mockMvc.perform(post("/api/projects/" + legacyProject.getId() + "/members")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(inviteReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userEmail").value(member.getEmail()));
    }
}
