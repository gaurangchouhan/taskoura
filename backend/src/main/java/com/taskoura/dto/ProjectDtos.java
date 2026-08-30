package com.taskoura.dto;

import java.time.LocalDate;
import java.util.UUID;

public class ProjectDtos {

    public record CreateProjectRequest(
            String name,
            String description,
            String frontendStack,
            String backendStack,
            String databaseStack,
            String testingStack,
            LocalDate deadline
    ) {}

    public record ProjectResponse(
            UUID id,
            String name,
            String description,
            UUID ownerId,
            LocalDate deadline
    ) {}
}
