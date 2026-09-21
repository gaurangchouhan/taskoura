package com.taskoura.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class TestCaseEntityTest {

    @Test
    @DisplayName("TestCase builder sets defaults and fields")
    void testCaseBuilder() {
        Task task = Task.builder().id(UUID.randomUUID()).build();
        User tester = User.builder().id(UUID.randomUUID()).name("Tester").build();
        UUID id = UUID.randomUUID();

        TestCase testCase = TestCase.builder()
                .id(id)
                .task(task)
                .description("Login with valid credentials")
                .expectedResult("JWT returned")
                .passed(true)
                .executedBy(tester)
                .build();

        assertThat(testCase.getId()).isEqualTo(id);
        assertThat(testCase.getTask()).isEqualTo(task);
        assertThat(testCase.getDescription()).isEqualTo("Login with valid credentials");
        assertThat(testCase.getExpectedResult()).isEqualTo("JWT returned");
        assertThat(testCase.isPassed()).isTrue();
        assertThat(testCase.getExecutedBy()).isEqualTo(tester);
        assertThat(testCase.getExecutedAt()).isNotNull();
    }

    @Test
    @DisplayName("TestCase setters work")
    void testCaseSetters() {
        TestCase testCase = new TestCase();
        UUID id = UUID.randomUUID();
        LocalDateTime now = LocalDateTime.now();

        testCase.setId(id);
        testCase.setPassed(false);
        testCase.setExecutedAt(now);

        assertThat(testCase.getId()).isEqualTo(id);
        assertThat(testCase.isPassed()).isFalse();
        assertThat(testCase.getExecutedAt()).isEqualTo(now);
    }
}
