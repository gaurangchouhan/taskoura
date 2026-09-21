package com.taskoura.dto;

import java.util.List;
import java.util.UUID;

public class AiDtos {

    // Feature 1: Test Cases
    public record GenerateTestCasesRequest(UUID taskId) {}

    public record GeneratedTestCase(String title, String expectedResult) {}

    public record GenerateTestCasesResponse(List<GeneratedTestCase> testCases) {}

    // Feature 2: Project Plan
    public record GenerateProjectPlanRequest(UUID projectId) {}

    public record PlanTask(String title, String category, String priority) {}

    public record PlanModule(String name, List<PlanTask> tasks) {}

    public record GenerateProjectPlanResponse(List<PlanModule> modules) {}

    public record ConfirmProjectPlanRequest(UUID projectId, List<PlanModule> modules) {}

    public record ConfirmProjectPlanResponse(int createdCount, List<UUID> taskIds) {}

    // Feature 3: Next Task Recommendation
    public record NextTaskRecommendationResponse(String recommendation, UUID relatedTaskId) {}
}
