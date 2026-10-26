package com.taskoura.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.dto.AiDtos.ConfirmProjectPlanRequest;
import com.taskoura.dto.AiDtos.PlanModule;
import com.taskoura.dto.AiDtos.PlanTask;
import com.taskoura.dto.NotificationDtos.ActivityLogResponse;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.dto.TaskDtos.CreateTaskRequest;
import com.taskoura.dto.TaskDtos.TaskResponse;
import com.taskoura.dto.TaskDtos.UpdateTaskRequest;
import com.taskoura.dto.TaskDtos.UpdateTaskStatusRequest;
import com.taskoura.entity.ActivityLog;
import com.taskoura.entity.Project;
import com.taskoura.entity.User;
import com.taskoura.repository.ActivityLogRepository;
import com.taskoura.repository.ProjectRepository;
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
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ActivityFeedIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtUtil jwtUtil;

    @Autowired private UserRepository userRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private ActivityLogRepository activityLogRepository;

    @Autowired private ProjectService projectService;
    @Autowired private TaskService taskService;
    @Autowired private AiTaskService aiTaskService;
    @Autowired private SessionService sessionService;

    @MockitoBean private JavaMailSender javaMailSender;

    private User owner;
    private User outsider;
    private String ownerToken;
    private String outsiderToken;
    private ProjectResponse project;
    private Project projectEntity;

    private String tokenFor(User user) {
        var s = sessionService.createSession(user, "TestAgent");
        return jwtUtil.generateToken(user.getEmail(), s.getId(), s.getAbsoluteExpiresAt());
    }

    @BeforeEach
    void setUp() {
        owner = userRepository.save(User.builder()
                .name("Alice Owner")
                .email("alice.owner." + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());
        ownerToken = tokenFor(owner);

        outsider = userRepository.save(User.builder()
                .name("Bob Outsider")
                .email("bob.outsider." + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());
        outsiderToken = tokenFor(outsider);

        project = projectService.createProject(
                owner.getEmail(),
                new CreateProjectRequest("Activity Project", "Description", "React", "Spring Boot", "PostgreSQL", "JUnit", null)
        );
        projectEntity = projectRepository.findById(project.id()).orElseThrow();
    }

    @Test
    @DisplayName("Activity feed orders newest first, with id descending as tie-breaker for identical timestamps")
    void activityFeed_orderedNewestFirst_withIdTieBreaker() throws Exception {
        LocalDateTime t1 = LocalDateTime.of(2026, 1, 1, 10, 0, 0);
        LocalDateTime t2 = LocalDateTime.of(2026, 1, 1, 11, 0, 0); // Identical timestamp
        LocalDateTime t3 = LocalDateTime.of(2026, 1, 1, 12, 0, 0);

        // Oldest log at T1
        activityLogRepository.save(ActivityLog.builder()
                .project(projectEntity)
                .user(owner)
                .actionType("LOG_T1")
                .description("Log at T1")
                .createdAt(t1)
                .build());

        // Two logs at identical timestamp T2
        ActivityLog logT2A = activityLogRepository.save(ActivityLog.builder()
                .project(projectEntity)
                .user(owner)
                .actionType("LOG_T2_A")
                .description("Log at T2 A")
                .createdAt(t2)
                .build());

        ActivityLog logT2B = activityLogRepository.save(ActivityLog.builder()
                .project(projectEntity)
                .user(owner)
                .actionType("LOG_T2_B")
                .description("Log at T2 B")
                .createdAt(t2)
                .build());

        // Newest log at T3
        activityLogRepository.save(ActivityLog.builder()
                .project(projectEntity)
                .user(owner)
                .actionType("LOG_T3")
                .description("Log at T3")
                .createdAt(t3)
                .build());

        MvcResult result = mockMvc.perform(get("/api/projects/{projectId}/activity", project.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andReturn();

        List<ActivityLogResponse> feed = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructCollectionType(List.class, ActivityLogResponse.class)
        );

        assertThat(feed).hasSize(4);
        // Newest first: T3
        assertThat(feed.get(0).actionType()).isEqualTo("LOG_T3");

        // For identical timestamp T2: ID descending determines order (lexicographically in Postgres)
        UUID higherId = logT2A.getId().toString().compareTo(logT2B.getId().toString()) > 0 ? logT2A.getId() : logT2B.getId();
        UUID lowerId = logT2A.getId().toString().compareTo(logT2B.getId().toString()) > 0 ? logT2B.getId() : logT2A.getId();

        assertThat(feed.get(1).id()).isEqualTo(higherId);
        assertThat(feed.get(2).id()).isEqualTo(lowerId);

        // Oldest: T1
        assertThat(feed.get(3).actionType()).isEqualTo("LOG_T1");
    }

    @Test
    @DisplayName("Activity feed limit parameter: optional default 200, respects custom limit, and caps at 500")
    void activityFeed_limitParameter() throws Exception {
        LocalDateTime baseTime = LocalDateTime.of(2026, 1, 1, 10, 0, 0);
        for (int i = 0; i < 15; i++) {
            activityLogRepository.save(ActivityLog.builder()
                    .project(projectEntity)
                    .user(owner)
                    .actionType("TASK_CREATED")
                    .description("Action " + i)
                    .createdAt(baseTime.plusMinutes(i))
                    .build());
        }

        // 1. Custom limit = 5
        mockMvc.perform(get("/api/projects/{projectId}/activity", project.id())
                        .param("limit", "5")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(5)));

        // 2. Default limit (no param) returns all 15 (as 15 < default 200)
        mockMvc.perform(get("/api/projects/{projectId}/activity", project.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(15)));

        // 3. Maximum limit check (e.g. limit=600 capped at 500 without error)
        mockMvc.perform(get("/api/projects/{projectId}/activity", project.id())
                        .param("limit", "600")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(15)));
    }

    @Test
    @DisplayName("Deleted task's activity is still readable in the project activity feed")
    void activityFeed_deletedTaskActivityStillReadable() throws Exception {
        // 1. Create task -> writes TASK_CREATED
        TaskResponse task = taskService.createTask(
                project.id(),
                new CreateTaskRequest("Bug Hunting", "Find and log bugs", "Testing", "High", null, LocalDate.now().plusDays(5)),
                owner.getEmail()
        );

        // 2. Update task -> writes TASK_UPDATED
        taskService.updateTask(
                task.id(),
                new UpdateTaskRequest("Bug Hunting (Urgent)", "Updated description", "Testing", "High", null, LocalDate.now().plusDays(2)),
                owner.getEmail()
        );

        // 3. Delete task -> writes TASK_DELETED
        taskService.deleteTask(task.id(), owner.getEmail());

        // Verify task is soft deleted
        assertThat(taskRepository.findById(task.id())).isEmpty();

        // 4. Query project activity feed
        MvcResult result = mockMvc.perform(get("/api/projects/{projectId}/activity", project.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andReturn();

        List<ActivityLogResponse> feed = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructCollectionType(List.class, ActivityLogResponse.class)
        );

        assertThat(feed).hasSizeGreaterThanOrEqualTo(3);

        // Newest action is TASK_DELETED
        ActivityLogResponse deleteLog = feed.get(0);
        assertThat(deleteLog.actionType()).isEqualTo("TASK_DELETED");
        assertThat(deleteLog.description()).contains("deleted task 'Bug Hunting (Urgent)'");
        assertThat(deleteLog.userName()).isEqualTo("Alice Owner");

        // Preceding action is TASK_UPDATED
        ActivityLogResponse updateLog = feed.get(1);
        assertThat(updateLog.actionType()).isEqualTo("TASK_UPDATED");
        assertThat(updateLog.description()).contains("edited task 'Bug Hunting (Urgent)'");

        // Preceding action is TASK_CREATED
        ActivityLogResponse createLog = feed.get(2);
        assertThat(createLog.actionType()).isEqualTo("TASK_CREATED");
        assertThat(createLog.description()).contains("Bug Hunting");
    }

    @Test
    @DisplayName("Non-member gets 403, unauthenticated gets 401")
    void activityFeed_authorization() throws Exception {
        // Outsider -> 403 Forbidden
        mockMvc.perform(get("/api/projects/{projectId}/activity", project.id())
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        // Anonymous -> 401 Unauthorized
        mockMvc.perform(get("/api/projects/{projectId}/activity", project.id()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Timestamps are ISO UTC ending in Z, userName can be null if user is unlinked")
    void activityFeed_isoUtcFormatAndNullableUserName() throws Exception {
        // Save log with null user (e.g. system or unlinked)
        ActivityLog logWithNullUser = activityLogRepository.save(ActivityLog.builder()
                .project(projectEntity)
                .user(null)
                .actionType("SYSTEM_EVENT")
                .description("Automated maintenance")
                .createdAt(LocalDateTime.of(2026, 3, 15, 12, 30, 45))
                .build());

        MvcResult result = mockMvc.perform(get("/api/projects/{projectId}/activity", project.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andReturn();

        String json = result.getResponse().getContentAsString();

        // Verify createdAt is serialized with 'Z' (ISO-8601 UTC Instant)
        assertThat(json).contains("2026-03-15T12:30:45Z");

        // Verify log with null user has userName null and does not throw NPE
        List<ActivityLogResponse> feed = objectMapper.readValue(
                json,
                objectMapper.getTypeFactory().constructCollectionType(List.class, ActivityLogResponse.class)
        );

        ActivityLogResponse systemLog = feed.stream()
                .filter(l -> l.id().equals(logWithNullUser.getId()))
                .findFirst()
                .orElseThrow();
        assertThat(systemLog.userId()).isNull();
        assertThat(systemLog.userName()).isNull();
        assertThat(systemLog.actionType()).isEqualTo("SYSTEM_EVENT");
    }

    @Test
    @DisplayName("TASKS_ADDED_FROM_AI is written to feed upon AI plan confirmation")
    void activityFeed_includesTasksAddedFromAi() throws Exception {
        ConfirmProjectPlanRequest confirmReq = new ConfirmProjectPlanRequest(
                project.id(),
                List.of(new PlanModule("Core", List.of(new PlanTask("AI Architecture", "Backend", "High"))))
        );

        aiTaskService.confirmProjectPlan(confirmReq, owner.getEmail());

        MvcResult result = mockMvc.perform(get("/api/projects/{projectId}/activity", project.id())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andReturn();

        List<ActivityLogResponse> feed = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructCollectionType(List.class, ActivityLogResponse.class)
        );

        ActivityLogResponse aiLog = feed.get(0);
        assertThat(aiLog.actionType()).isEqualTo("TASKS_ADDED_FROM_AI");
        assertThat(aiLog.description()).contains("Added 1 tasks from AI plan");
        assertThat(aiLog.userName()).isEqualTo("Alice Owner");
    }
}
