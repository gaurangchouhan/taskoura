package com.taskoura.service;

import com.taskoura.dto.AiDtos.*;
import com.taskoura.entity.Project;
import com.taskoura.entity.Task;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.ProjectRepository;
import com.taskoura.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AiTaskService {

    private final GrokClient grokClient;
    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;

    // In-memory 5-minute TTL cache
    private final Map<String, CacheEntry<Object>> cache = new ConcurrentHashMap<>();
    private static final long TTL_MILLIS = 5 * 60 * 1000;

    private record CacheEntry<T>(T data, Instant expiresAt) {
        boolean isExpired() {
            return Instant.now().isAfter(expiresAt);
        }
    }

    public AiTaskService(GrokClient grokClient, TaskRepository taskRepository, ProjectRepository projectRepository) {
        this.grokClient = grokClient;
        this.taskRepository = taskRepository;
        this.projectRepository = projectRepository;
    }

    public GenerateTestCasesResponse generateTestCases(UUID taskId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found"));

        String cacheKey = "test-cases:" + task.getTitle() + ":" + task.getDescription();
        GenerateTestCasesResponse cached = getFromCache(cacheKey, GenerateTestCasesResponse.class);
        if (cached != null) {
            return cached;
        }

        String systemPrompt = "You are a QA automation engineer. Given a task title and description, generate a JSON object with schema: " +
                "{\"testCases\": [{\"title\": \"...\", \"expectedResult\": \"...\"}]}. Respond with ONLY raw JSON without markdown.";
        String userPrompt = "Task title: " + task.getTitle() + "\nTask description: " + (task.getDescription() != null ? task.getDescription() : "");

        GenerateTestCasesResponse response = grokClient.callGrokJson(systemPrompt, userPrompt, GenerateTestCasesResponse.class);
        putInCache(cacheKey, response);
        return response;
    }

    public GenerateProjectPlanResponse generateProjectPlan(UUID projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new NotFoundException("Project not found"));

        String cacheKey = "plan:" + project.getName() + ":" + project.getFrontendStack() + ":" + project.getBackendStack() + ":" + project.getDatabaseStack();
        GenerateProjectPlanResponse cached = getFromCache(cacheKey, GenerateProjectPlanResponse.class);
        if (cached != null) {
            return cached;
        }

        String systemPrompt = "You are a software architect. Given project details and tech stack, breakdown into modules and tasks with JSON schema: " +
                "{\"modules\": [{\"name\": \"...\", \"tasks\": [{\"title\": \"...\", \"category\": \"Frontend|Backend|Database|Testing|Documentation\", \"priority\": \"High|Medium|Low\"}]}]}. Respond with ONLY raw JSON.";
        String userPrompt = "Project: " + project.getName() + "\nDescription: " + (project.getDescription() != null ? project.getDescription() : "") +
                "\nFrontend: " + project.getFrontendStack() + "\nBackend: " + project.getBackendStack() +
                "\nDatabase: " + project.getDatabaseStack() + "\nTesting: " + project.getTestingStack();

        GenerateProjectPlanResponse response = grokClient.callGrokJson(systemPrompt, userPrompt, GenerateProjectPlanResponse.class);
        putInCache(cacheKey, response);
        return response;
    }

    @Transactional
    public ConfirmProjectPlanResponse confirmProjectPlan(ConfirmProjectPlanRequest request) {
        Project project = projectRepository.findById(request.projectId())
                .orElseThrow(() -> new NotFoundException("Project not found"));

        List<UUID> createdTaskIds = new ArrayList<>();
        if (request.modules() != null) {
            for (PlanModule module : request.modules()) {
                if (module.tasks() != null) {
                    for (PlanTask planTask : module.tasks()) {
                        Task task = Task.builder()
                                .project(project)
                                .title(planTask.title())
                                .category(planTask.category() != null ? planTask.category() : "General")
                                .priority(planTask.priority() != null ? planTask.priority() : "Medium")
                                .status("Backlog")
                                .build();
                        Task saved = taskRepository.save(task);
                        createdTaskIds.add(saved.getId());
                    }
                }
            }
        }

        return new ConfirmProjectPlanResponse(createdTaskIds.size(), createdTaskIds);
    }

    public NextTaskRecommendationResponse recommendNextTask(UUID projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new NotFoundException("Project not found"));

        List<Task> tasks = taskRepository.findByProjectId(projectId);
        if (tasks.isEmpty()) {
            return new NextTaskRecommendationResponse("No tasks available in this project. Add tasks to receive recommendations.", null);
        }

        StringBuilder taskSummary = new StringBuilder();
        for (Task t : tasks) {
            taskSummary.append(String.format("ID: %s, Title: %s, Status: %s, Priority: %s, Deadline: %s\n",
                    t.getId(), t.getTitle(), t.getStatus(), t.getPriority(), t.getDeadline()));
        }

        String cacheKey = "next-task:" + projectId + ":" + taskSummary.toString().hashCode();
        NextTaskRecommendationResponse cached = getFromCache(cacheKey, NextTaskRecommendationResponse.class);
        if (cached != null) {
            return cached;
        }

        String systemPrompt = "You are an Agile Scrum master. Given the project tasks and statuses, recommend in one concise sentence what to work on next. " +
                "Respond with JSON schema: {\"recommendation\": \"one sentence\", \"relatedTaskId\": \"UUID string of recommended task or null\"}. Respond with ONLY raw JSON.";
        String userPrompt = "Project: " + project.getName() + "\nTasks:\n" + taskSummary;

        NextTaskRecommendationResponse response = grokClient.callGrokJson(systemPrompt, userPrompt, NextTaskRecommendationResponse.class);
        putInCache(cacheKey, response);
        return response;
    }

    @SuppressWarnings("unchecked")
    private <T> T getFromCache(String key, Class<T> clazz) {
        CacheEntry<Object> entry = cache.get(key);
        if (entry != null && !entry.isExpired()) {
            return (T) entry.data();
        }
        cache.remove(key);
        return null;
    }

    private void putInCache(String key, Object data) {
        cache.put(key, new CacheEntry<>(data, Instant.now().plusMillis(TTL_MILLIS)));
    }
}
