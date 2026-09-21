package com.taskoura.service;

import com.taskoura.dto.AiDtos.*;
import com.taskoura.entity.Project;
import com.taskoura.entity.Task;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.ProjectRepository;
import com.taskoura.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiTaskServiceTest {

    @Mock
    private GrokClient grokClient;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private ProjectRepository projectRepository;

    @InjectMocks
    private AiTaskService aiTaskService;

    private UUID taskId;
    private Task task;
    private UUID projectId;
    private Project project;

    @BeforeEach
    void setUp() {
        taskId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        project = Project.builder()
                .id(projectId)
                .name("AI Project")
                .description("Test Description")
                .frontendStack("React")
                .backendStack("Spring Boot")
                .build();

        task = Task.builder()
                .id(taskId)
                .project(project)
                .title("Implement Authentication")
                .description("Use JWT stateless auth")
                .status("Backlog")
                .build();
    }

    @Test
    @DisplayName("generateTestCases: returns generated test cases and caches result")
    void generateTestCases_success() {
        GenerateTestCasesResponse mockResponse = new GenerateTestCasesResponse(
                List.of(new GeneratedTestCase("Valid Login", "200 OK + JWT"))
        );

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(grokClient.callGrokJson(anyString(), anyString(), eq(GenerateTestCasesResponse.class)))
                .thenReturn(mockResponse);

        GenerateTestCasesResponse firstCall = aiTaskService.generateTestCases(taskId);
        assertThat(firstCall.testCases()).hasSize(1);
        assertThat(firstCall.testCases().get(0).title()).isEqualTo("Valid Login");

        // Second call should hit the in-memory cache without calling Grok again
        GenerateTestCasesResponse secondCall = aiTaskService.generateTestCases(taskId);
        assertThat(secondCall.testCases()).hasSize(1);

        verify(grokClient, times(1)).callGrokJson(anyString(), anyString(), eq(GenerateTestCasesResponse.class));
    }

    @Test
    @DisplayName("generateTestCases: throws NotFoundException when task does not exist")
    void generateTestCases_taskNotFound() {
        when(taskRepository.findById(taskId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> aiTaskService.generateTestCases(taskId))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Task not found");
    }

    @Test
    @DisplayName("generateProjectPlan: returns modules preview without saving tasks")
    void generateProjectPlan_previewOnly() {
        GenerateProjectPlanResponse mockResponse = new GenerateProjectPlanResponse(
                List.of(new PlanModule("Auth Module", List.of(new PlanTask("Login Endpoint", "Backend", "High"))))
        );

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(grokClient.callGrokJson(anyString(), anyString(), eq(GenerateProjectPlanResponse.class)))
                .thenReturn(mockResponse);

        GenerateProjectPlanResponse response = aiTaskService.generateProjectPlan(projectId);

        assertThat(response.modules()).hasSize(1);
        assertThat(response.modules().get(0).tasks()).hasSize(1);
        verify(taskRepository, never()).save(any());
    }

    @Test
    @DisplayName("confirmProjectPlan: bulk creates tasks in Backlog status")
    void confirmProjectPlan_createsTasks() {
        ConfirmProjectPlanRequest request = new ConfirmProjectPlanRequest(
                projectId,
                List.of(new PlanModule("DB Module", List.of(
                        new PlanTask("Schema setup", "Database", "High"),
                        new PlanTask("Migration script", "Database", "Medium")
                )))
        );

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> {
            Task t = inv.getArgument(0);
            t.setId(UUID.randomUUID());
            return t;
        });

        ConfirmProjectPlanResponse response = aiTaskService.confirmProjectPlan(request);

        assertThat(response.createdCount()).isEqualTo(2);
        assertThat(response.taskIds()).hasSize(2);
        verify(taskRepository, times(2)).save(argThat(t -> "Backlog".equals(t.getStatus())));
    }

    @Test
    @DisplayName("recommendNextTask: returns AI recommendation with related task ID")
    void recommendNextTask_success() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(taskRepository.findByProjectId(projectId)).thenReturn(List.of(task));

        NextTaskRecommendationResponse mockResponse = new NextTaskRecommendationResponse(
                "Focus on implementing authentication as it blocks all other modules.", taskId
        );
        when(grokClient.callGrokJson(anyString(), anyString(), eq(NextTaskRecommendationResponse.class)))
                .thenReturn(mockResponse);

        NextTaskRecommendationResponse response = aiTaskService.recommendNextTask(projectId);

        assertThat(response.recommendation()).contains("Focus on implementing authentication");
        assertThat(response.relatedTaskId()).isEqualTo(taskId);
    }
}
