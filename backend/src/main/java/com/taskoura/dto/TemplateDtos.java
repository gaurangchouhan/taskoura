package com.taskoura.dto;

import java.util.List;
import java.util.UUID;

public class TemplateDtos {

    public record TemplateSummary(
            String key,
            String name,
            String description,
            int moduleCount,
            int taskCount
    ) {}

    public record TemplateListResponse(
            List<TemplateSummary> templates
    ) {}

    public record ApplyTemplateResponse(
            int createdCount,
            List<UUID> taskIds
    ) {}
}
