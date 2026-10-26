package com.taskoura.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.UUID;

public class AiDtos {

    // Feature 1: Test Cases
    public record GenerateTestCasesRequest(UUID taskId) {}

    public record GeneratedTestCase(String title, String expectedResult) {}

    public record GenerateTestCasesResponse(List<GeneratedTestCase> testCases) {}

    // Feature 2: Project Plan
    public record GenerateProjectPlanRequest(UUID projectId) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PlanTask(
            @JsonProperty("title") String title,
            @JsonProperty("category") String category,
            @JsonProperty("priority") String priority,
            @JsonProperty("description") @JsonInclude(JsonInclude.Include.NON_NULL) String description
    ) {
        @com.fasterxml.jackson.annotation.JsonCreator
        public PlanTask(
                @JsonProperty("title") String title,
                @JsonProperty("category") String category,
                @JsonProperty("priority") String priority,
                @JsonProperty("description") String description
        ) {
            this.title = title;
            this.category = category;
            this.priority = priority;
            this.description = description;
        }

        public PlanTask(String title, String category, String priority) {
            this(title, category, priority, null);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PlanModule(
            @JsonProperty("name") String name,
            @JsonProperty("tasks") List<PlanTask> tasks
    ) {}

    public record GenerateProjectPlanResponse(List<PlanModule> modules) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ConfirmProjectPlanRequest(
            @JsonProperty("projectId") UUID projectId,
            @JsonProperty("modules") List<PlanModule> modules
    ) {}

    public record ConfirmProjectPlanResponse(int createdCount, List<UUID> taskIds) {}

    // Feature 3: Next Task Recommendation
    public record NextTaskRecommendationResponse(String recommendation, UUID relatedTaskId) {}
}
