package com.taskoura.service;

import com.taskoura.dto.AiDtos.*;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.dto.TaskDtos.CreateTaskRequest;
import com.taskoura.dto.TaskDtos.TaskResponse;
import com.taskoura.entity.Task;
import com.taskoura.entity.User;
import com.taskoura.exception.BadGatewayException;
import com.taskoura.repository.TaskRepository;
import com.taskoura.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AiLifecycleIntegrationTest {

    @Autowired
    private AiTaskService aiTaskService;

    @Autowired
    private ProjectService projectService;

    @Autowired
    private TaskService taskService;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private UserRepository userRepository;

    @MockitoBean
    private GrokClient grokClient;

    private User testUser;
    private ProjectResponse testProject;
    private TaskResponse testTask;

    @BeforeEach
    void setUp() {
        testUser = userRepository.save(User.builder()
                .name("AI Lead")
                .email("ai-lead-" + UUID.randomUUID() + "@example.com")
                .passwordHash("pass")
                .verified(true)
                .build());

        testProject = projectService.createProject(
                testUser.getEmail(),
                new CreateProjectRequest("AI Integration Project", "Project for testing Grok features", "Vue", "Spring Boot", "PostgreSQL", "JUnit 5", LocalDate.now().plusMonths(2))
        );

        testTask = taskService.createTask(
                testProject.id(),
                new CreateTaskRequest("User Login Flow", "Stateless JWT Auth with OTP", "Backend", "High", testUser.getId(), LocalDate.now().plusDays(10))
        );
    }

    @Test
    @DisplayName("Test case generation returns expected JSON shape")
    void testCaseGeneration() {
        GenerateTestCasesResponse mockResponse = new GenerateTestCasesResponse(
                List.of(
                        new GeneratedTestCase("Valid OTP", "User verified and status 200"),
                        new GeneratedTestCase("Expired OTP", "HTTP 400 Bad Request")
                )
        );
        when(grokClient.callGrokJson(anyString(), anyString(), eq(GenerateTestCasesResponse.class)))
                .thenReturn(mockResponse);

        GenerateTestCasesResponse response = aiTaskService.generateTestCases(testTask.id());

        assertThat(response).isNotNull();
        assertThat(response.testCases()).hasSize(2);
        assertThat(response.testCases().get(0).title()).isEqualTo("Valid OTP");
        assertThat(response.testCases().get(1).title()).isEqualTo("Expired OTP");
    }

    @Test
    @DisplayName("Project plan preview does NOT create tasks, confirm endpoint creates them")
    void projectPlanPreviewAndConfirm() {
        // 1. Generate preview
        GenerateProjectPlanResponse mockPlan = new GenerateProjectPlanResponse(
                List.of(new PlanModule("Module 1: Auth", List.of(
                        new PlanTask("Setup JWT Filter", "Backend", "High"),
                        new PlanTask("Build Login UI", "Frontend", "Medium")
                )))
        );
        when(grokClient.callGrokJson(anyString(), anyString(), eq(GenerateProjectPlanResponse.class)))
                .thenReturn(mockPlan);

        GenerateProjectPlanResponse preview = aiTaskService.generateProjectPlan(testProject.id());
        assertThat(preview).isNotNull();
        assertThat(preview.modules()).hasSize(1);
        assertThat(preview.modules().get(0).tasks()).hasSize(2);

        // Verify that only the initial task exists in DB (no new tasks created by preview)
        List<Task> tasksAfterPreview = taskRepository.findByProjectId(testProject.id());
        assertThat(tasksAfterPreview).hasSize(1);

        // 2. Confirm project plan -> tasks are actually created in DB
        ConfirmProjectPlanRequest confirmReq = new ConfirmProjectPlanRequest(testProject.id(), preview.modules());
        ConfirmProjectPlanResponse confirmResponse = aiTaskService.confirmProjectPlan(confirmReq);

        assertThat(confirmResponse.createdCount()).isEqualTo(2);
        assertThat(confirmResponse.taskIds()).hasSize(2);

        // Verify that 3 total tasks now exist in DB for this project (initial + 2 generated)
        List<Task> tasksAfterConfirm = taskRepository.findByProjectId(testProject.id());
        assertThat(tasksAfterConfirm).hasSize(3);
        assertThat(tasksAfterConfirm).extracting(Task::getStatus).containsOnly("Backlog");
    }

    @Test
    @DisplayName("Simulate Grok failure -> returns clean 502 BadGatewayException")
    void simulateGrokFailure_returns502Exception() {
        TaskResponse failingTask = taskService.createTask(
                testProject.id(),
                new CreateTaskRequest("Uncached Task", "Unique description for failure test", "Testing", "Low", testUser.getId(), LocalDate.now())
        );

        when(grokClient.callGrokJson(anyString(), anyString(), eq(GenerateTestCasesResponse.class)))
                .thenThrow(new BadGatewayException("AI service unavailable, try again"));

        assertThatThrownBy(() -> aiTaskService.generateTestCases(failingTask.id()))
                .isInstanceOf(BadGatewayException.class)
                .hasMessage("AI service unavailable, try again");
    }
}
