package com.taskoura.validation;

import com.taskoura.dto.AiDtos.ConfirmProjectPlanRequest;
import com.taskoura.dto.AiDtos.PlanModule;
import com.taskoura.dto.AiDtos.PlanTask;
import com.taskoura.dto.TaskDtos.UpdateTaskRequest;
import com.taskoura.exception.ValidationException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class TaskValidation {

    public static final Set<String> ALLOWED_CATEGORIES = Set.of(
            "Frontend",
            "Backend",
            "Database",
            "Testing",
            "Documentation"
    );

    public static final Set<String> ALLOWED_PRIORITIES = Set.of(
            "High",
            "Medium",
            "Low"
    );

    public static boolean isValidCategory(String category) {
        return category != null && ALLOWED_CATEGORIES.contains(category);
    }

    public static boolean isValidPriority(String priority) {
        return priority != null && ALLOWED_PRIORITIES.contains(priority);
    }

    public static String normalizeCategory(String category) {
        if (category == null) {
            return null;
        }
        String trimmed = category.trim();
        for (String allowed : ALLOWED_CATEGORIES) {
            if (allowed.equalsIgnoreCase(trimmed)) {
                return allowed;
            }
        }
        return null;
    }

    public static String normalizePriority(String priority) {
        if (priority == null) {
            return null;
        }
        String trimmed = priority.trim();
        for (String allowed : ALLOWED_PRIORITIES) {
            if (allowed.equalsIgnoreCase(trimmed)) {
                return allowed;
            }
        }
        return null;
    }

    public static boolean isValidTitle(String title) {
        if (title == null) {
            return false;
        }
        String trimmed = title.trim();
        return !trimmed.isEmpty() && trimmed.length() <= 200;
    }

    public static boolean isValidDescription(String description) {
        return description == null || description.length() <= 255;
    }

    public static void validateUpdate(UpdateTaskRequest request, boolean isAssigneeMember) {
        Map<String, String> errors = new LinkedHashMap<>();

        if (request == null) {
            errors.put("request", "Request body is required");
            throw new ValidationException(errors);
        }

        if (request.title() == null || request.title().trim().isEmpty()) {
            errors.put("title", "Title is required");
        } else if (request.title().trim().length() > 200) {
            errors.put("title", "Title must be between 1 and 200 characters");
        }

        if (request.description() != null && request.description().length() > 255) {
            errors.put("description", "Description cannot exceed 255 characters");
        }

        if (request.category() == null || !isValidCategory(request.category())) {
            errors.put("category", "Category must be one of: Frontend, Backend, Database, Testing, Documentation");
        }

        if (request.priority() == null || !isValidPriority(request.priority())) {
            errors.put("priority", "Priority must be one of: High, Medium, Low");
        }

        if (request.assignedTo() != null && !isAssigneeMember) {
            errors.put("assignedTo", "Assignee must be a member of the project");
        }

        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
    }

    public static void validatePlan(ConfirmProjectPlanRequest request) {
        Map<String, String> errors = new LinkedHashMap<>();

        if (request == null) {
            errors.put("request", "Request body is required");
            throw new ValidationException(errors);
        }

        if (request.projectId() == null) {
            errors.put("projectId", "Project ID is required");
        }

        List<PlanModule> modules = request.modules();
        int totalTasks = 0;
        if (modules != null) {
            for (PlanModule module : modules) {
                if (module != null && module.tasks() != null) {
                    totalTasks += module.tasks().size();
                }
            }
        }

        if (totalTasks == 0) {
            errors.put("tasks", "Plan must contain between 1 and 100 tasks");
            errors.put("modules", "Plan must contain between 1 and 100 tasks");
        } else if (totalTasks > 100) {
            errors.put("tasks", "Total tasks cannot exceed 100");
            errors.put("modules", "Total tasks cannot exceed 100");
        }

        if (modules != null) {
            for (int i = 0; i < modules.size(); i++) {
                PlanModule module = modules.get(i);
                if (module == null) {
                    continue;
                }

                // module name 1-100 characters (blank means "General")
                if (module.name() != null && !module.name().trim().isEmpty() && module.name().trim().length() > 100) {
                    errors.put("modules[" + i + "].name", "Module name cannot exceed 100 characters");
                }

                List<PlanTask> tasks = module.tasks();
                if (tasks != null) {
                    for (int j = 0; j < tasks.size(); j++) {
                        PlanTask task = tasks.get(j);
                        String taskPrefix = "modules[" + i + "].tasks[" + j + "]";
                        if (task == null) {
                            errors.put(taskPrefix, "Task cannot be null");
                            continue;
                        }

                        // title 1-200
                        if (task.title() == null || task.title().trim().isEmpty()) {
                            errors.put(taskPrefix + ".title", "Title is required");
                        } else if (task.title().trim().length() > 200) {
                            errors.put(taskPrefix + ".title", "Title must be between 1 and 200 characters");
                        }

                        // description 0-255 (optional)
                        if (task.description() != null && task.description().length() > 255) {
                            errors.put(taskPrefix + ".description", "Description cannot exceed 255 characters");
                        }

                        // category matched case-insensitively against allowed sets
                        String normalizedCategory = normalizeCategory(task.category());
                        if (normalizedCategory == null) {
                            errors.put(taskPrefix + ".category", "Category must be one of: Frontend, Backend, Database, Testing, Documentation");
                        }

                        // priority matched case-insensitively against allowed sets
                        String normalizedPriority = normalizePriority(task.priority());
                        if (normalizedPriority == null) {
                            errors.put(taskPrefix + ".priority", "Priority must be one of: High, Medium, Low");
                        }
                    }
                }
            }
        }

        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
    }
}
