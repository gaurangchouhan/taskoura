package com.taskoura.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.dto.AiDtos.*;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.entity.ActivityLog;
import com.taskoura.entity.Task;
import com.taskoura.entity.User;
import com.taskoura.repository.ActivityLogRepository;
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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AiPlanEditAndConfirmIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtUtil jwtUtil;

    @Autowired private UserRepository userRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private ProjectService projectService;
    @Autowired private SessionService sessionService;

    @MockitoBean private GrokClient grokClient;

    private User owner;
    private User nonMember;
    private ProjectResponse project;
    private String ownerToken;
    private String nonMemberToken;

    private String tokenFor(User user) {
        var s = sessionService.createSession(user, "TestAgent");
        return jwtUtil.generateToken(user.getEmail(), s.getId(), s.getAbsoluteExpiresAt());
    }

    @BeforeEach
    void setUp() {
        owner = userRepository.save(User.builder()
                .name("Owner User")
                .email("owner-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());

        nonMember = userRepository.save(User.builder()
                .name("Non Member")
                .email("nonmember-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());

        project = projectService.createProject(
                owner.getEmail(),
                new CreateProjectRequest(
                        "Plan Confirmation Project",
                        "Testing editable AI plans",
                        "React",
                        "Spring Boot",
                        "PostgreSQL",
                        "JUnit",
                        LocalDate.now().plusMonths(3)
                )
        );

        ownerToken = tokenFor(owner);
        nonMemberToken = tokenFor(nonMember);
    }

    @Test
    @DisplayName("Valid edited plan saves exactly the sent tasks with optional description, Backlog status, and TASKS_ADDED_FROM_AI activity log")
    void validEditedPlan_savesExactlySentTasks() throws Exception {
        ConfirmProjectPlanRequest request = new ConfirmProjectPlanRequest(
                project.id(),
                List.of(
                        new PlanModule("Database & Auth", List.of(
                                new PlanTask("DB Schema", "database", "high", "Core PostgreSQL tables"),
                                new PlanTask("JWT Authentication", "backend", "MEDIUM", "Stateless tokens")
                        )),
                        new PlanModule("UI Module", List.of(
                                new PlanTask("Login Page", "FRONTEND", "low", null)
                        ))
                )
        );

        int initialTaskCount = taskRepository.findByProjectId(project.id()).size();

        mockMvc.perform(post("/api/ai/project-plan/confirm")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.createdCount").value(3))
                .andExpect(jsonPath("$.taskIds").isArray())
                .andExpect(jsonPath("$.taskIds", hasSize(3)));

        List<Task> tasks = taskRepository.findByProjectId(project.id());
        assertThat(tasks).hasSize(initialTaskCount + 3);

        Task dbTask = tasks.stream().filter(t -> t.getTitle().equals("DB Schema")).findFirst().orElseThrow();
        assertThat(dbTask.getCategory()).isEqualTo("Database");
        assertThat(dbTask.getPriority()).isEqualTo("High");
        assertThat(dbTask.getDescription()).isEqualTo("Core PostgreSQL tables");
        assertThat(dbTask.getStatus()).isEqualTo("Backlog");
        assertThat(dbTask.getCreatedBy()).isNotNull();
        assertThat(dbTask.getCreatedBy().getId()).isEqualTo(owner.getId());

        Task jwtTask = tasks.stream().filter(t -> t.getTitle().equals("JWT Authentication")).findFirst().orElseThrow();
        assertThat(jwtTask.getCategory()).isEqualTo("Backend");
        assertThat(jwtTask.getPriority()).isEqualTo("Medium");
        assertThat(jwtTask.getDescription()).isEqualTo("Stateless tokens");
        assertThat(jwtTask.getStatus()).isEqualTo("Backlog");

        Task uiTask = tasks.stream().filter(t -> t.getTitle().equals("Login Page")).findFirst().orElseThrow();
        assertThat(uiTask.getCategory()).isEqualTo("Frontend");
        assertThat(uiTask.getPriority()).isEqualTo("Low");
        assertThat(uiTask.getDescription()).isNull();
        assertThat(uiTask.getStatus()).isEqualTo("Backlog");

        List<ActivityLog> activityLogs = activityLogRepository.findByProjectIdOrderByCreatedAtAsc(project.id());
        assertThat(activityLogs).anyMatch(a ->
                "TASKS_ADDED_FROM_AI".equals(a.getActionType()) &&
                a.getDescription().contains("3") &&
                a.getUser().getId().equals(owner.getId())
        );
    }

    @Test
    @DisplayName("Mixed-case category and priority normalize to canonical strings")
    void mixedCaseCategoryAndPriority_normalizes() throws Exception {
        ConfirmProjectPlanRequest request = new ConfirmProjectPlanRequest(
                project.id(),
                List.of(new PlanModule("Module 1", List.of(
                        new PlanTask("Task A", "testing", "HIGH", "Unit tests"),
                        new PlanTask("Task B", "DOCUMENTATION", "medium", "API docs")
                )))
        );

        mockMvc.perform(post("/api/ai/project-plan/confirm")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.createdCount").value(2));

        List<Task> tasks = taskRepository.findByProjectId(project.id());
        Task testTask = tasks.stream().filter(t -> t.getTitle().equals("Task A")).findFirst().orElseThrow();
        assertThat(testTask.getCategory()).isEqualTo("Testing");
        assertThat(testTask.getPriority()).isEqualTo("High");

        Task docTask = tasks.stream().filter(t -> t.getTitle().equals("Task B")).findFirst().orElseThrow();
        assertThat(docTask.getCategory()).isEqualTo("Documentation");
        assertThat(docTask.getPriority()).isEqualTo("Medium");
    }

    @Test
    @DisplayName("Invalid category returns 400 VALIDATION_FAILED with correct fieldErrors path")
    void invalidCategory_returnsRightFieldErrorsPath() throws Exception {
        ConfirmProjectPlanRequest request = new ConfirmProjectPlanRequest(
                project.id(),
                List.of(new PlanModule("Module 1", List.of(
                        new PlanTask("Task 0", "Frontend", "High", null),
                        new PlanTask("Task 1", "Backend", "Medium", null),
                        new PlanTask("Task 2", "CloudOps", "Low", null) // Invalid category at index 2
                )))
        );

        mockMvc.perform(post("/api/ai/project-plan/confirm")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors['modules[0].tasks[2].category']").value(
                        "Category must be one of: Frontend, Backend, Database, Testing, Documentation"
                ));
    }

    @Test
    @DisplayName("Invalid priority returns 400 VALIDATION_FAILED with correct fieldErrors path")
    void invalidPriority_returnsRightFieldErrorsPath() throws Exception {
        ConfirmProjectPlanRequest request = new ConfirmProjectPlanRequest(
                project.id(),
                List.of(new PlanModule("Module 1", List.of(
                        new PlanTask("Task 0", "Frontend", "Critical", null) // Invalid priority
                )))
        );

        mockMvc.perform(post("/api/ai/project-plan/confirm")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors['modules[0].tasks[0].priority']").value(
                        "Priority must be one of: High, Medium, Low"
                ));
    }

    @Test
    @DisplayName("Invalid title and description return 400 with path-based fieldErrors")
    void invalidTitleAndDescription_returnFieldErrors() throws Exception {
        String longTitle = "A".repeat(201);
        String longDesc = "D".repeat(256);

        ConfirmProjectPlanRequest request = new ConfirmProjectPlanRequest(
                project.id(),
                List.of(
                        new PlanModule("Module 0", List.of(
                                new PlanTask("", "Frontend", "High", null) // Empty title
                        )),
                        new PlanModule("Module 1", List.of(
                                new PlanTask(longTitle, "Backend", "Medium", longDesc) // Title > 200, Desc > 255
                        ))
                )
        );

        mockMvc.perform(post("/api/ai/project-plan/confirm")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors['modules[0].tasks[0].title']").value("Title is required"))
                .andExpect(jsonPath("$.fieldErrors['modules[1].tasks[0].title']").value("Title must be between 1 and 200 characters"))
                .andExpect(jsonPath("$.fieldErrors['modules[1].tasks[0].description']").value("Description cannot exceed 255 characters"));
    }

    @Test
    @DisplayName("Module name > 100 characters returns 400 with path fieldError; blank module name is accepted as General")
    void moduleNameValidation() throws Exception {
        String longModuleName = "M".repeat(101);

        ConfirmProjectPlanRequest requestInvalid = new ConfirmProjectPlanRequest(
                project.id(),
                List.of(new PlanModule(longModuleName, List.of(
                        new PlanTask("Valid Task", "Frontend", "High", null)
                )))
        );

        mockMvc.perform(post("/api/ai/project-plan/confirm")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestInvalid)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors['modules[0].name']").value("Module name cannot exceed 100 characters"));

        // Blank module name is allowed (means General)
        ConfirmProjectPlanRequest requestBlankModule = new ConfirmProjectPlanRequest(
                project.id(),
                List.of(new PlanModule("   ", List.of(
                        new PlanTask("Task in Blank Module", "Frontend", "High", null)
                )))
        );

        mockMvc.perform(post("/api/ai/project-plan/confirm")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestBlankModule)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.createdCount").value(1));
    }

    @Test
    @DisplayName("101 tasks rejected with 400 VALIDATION_FAILED")
    void over100Tasks_rejected() throws Exception {
        List<PlanTask> tasks = new ArrayList<>();
        for (int i = 0; i < 101; i++) {
            tasks.add(new PlanTask("Task " + i, "Frontend", "Low", null));
        }
        ConfirmProjectPlanRequest request = new ConfirmProjectPlanRequest(
                project.id(),
                List.of(new PlanModule("Large Module", tasks))
        );

        mockMvc.perform(post("/api/ai/project-plan/confirm")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.tasks").exists());
    }

    @Test
    @DisplayName("Empty plan rejected with 400 VALIDATION_FAILED")
    void emptyPlan_rejected() throws Exception {
        ConfirmProjectPlanRequest requestEmpty = new ConfirmProjectPlanRequest(
                project.id(),
                List.of(new PlanModule("Empty Module", List.of()))
        );

        mockMvc.perform(post("/api/ai/project-plan/confirm")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestEmpty)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.tasks").exists());
    }

    @Test
    @DisplayName("Non-member gets 403 Forbidden")
    void nonMember_gets403() throws Exception {
        ConfirmProjectPlanRequest request = new ConfirmProjectPlanRequest(
                project.id(),
                List.of(new PlanModule("Module 1", List.of(
                        new PlanTask("Task 1", "Frontend", "High", null)
                )))
        );

        mockMvc.perform(post("/api/ai/project-plan/confirm")
                        .header("Authorization", "Bearer " + nonMemberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    @DisplayName("A failure on one task rolls back all (all-or-nothing)")
    void failureOnOneTask_rollsBackAll() throws Exception {
        int countBefore = taskRepository.findByProjectId(project.id()).size();

        ConfirmProjectPlanRequest request = new ConfirmProjectPlanRequest(
                project.id(),
                List.of(new PlanModule("Module 1", List.of(
                        new PlanTask("Valid Task 1", "Frontend", "High", "Valid desc"),
                        new PlanTask("Valid Task 2", "Backend", "Medium", "Valid desc"),
                        new PlanTask("Invalid Task", "InvalidCategory", "Low", "Desc") // Fails validation
                )))
        );

        mockMvc.perform(post("/api/ai/project-plan/confirm")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        int countAfter = taskRepository.findByProjectId(project.id()).size();
        assertThat(countAfter).isEqualTo(countBefore);
    }

    @Test
    @DisplayName("Generating a plan creates nothing (count unchanged)")
    void generatingPlan_createsNothing() throws Exception {
        GenerateProjectPlanResponse mockPlan = new GenerateProjectPlanResponse(
                List.of(new PlanModule("Module A", List.of(
                        new PlanTask("Preview Task 1", "Database", "High"),
                        new PlanTask("Preview Task 2", "Backend", "Medium")
                )))
        );
        when(grokClient.callGrokJson(anyString(), anyString(), eq(GenerateProjectPlanResponse.class)))
                .thenReturn(mockPlan);

        int countBefore = taskRepository.findByProjectId(project.id()).size();

        mockMvc.perform(post("/api/ai/project-plan")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GenerateProjectPlanRequest(project.id()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.modules").isArray())
                .andExpect(jsonPath("$.modules[0].tasks", hasSize(2)));

        int countAfter = taskRepository.findByProjectId(project.id()).size();
        assertThat(countAfter).isEqualTo(countBefore);
    }
}
