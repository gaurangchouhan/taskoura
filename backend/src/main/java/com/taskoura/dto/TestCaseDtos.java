package com.taskoura.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class TestCaseDtos {

    public record CreateTestCaseRequest(
            String description,
            String expectedResult,
            boolean passed
    ) {}

    public record TestCaseResponse(
            UUID id,
            String description,
            String expectedResult,
            boolean passed,
            UUID executedBy,
            LocalDateTime executedAt
    ) {}
}
