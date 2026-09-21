package com.taskoura.service;

import com.taskoura.dto.TestCaseDtos.CreateTestCaseRequest;
import com.taskoura.dto.TestCaseDtos.TestCaseResponse;
import com.taskoura.entity.Task;
import com.taskoura.entity.TestCase;
import com.taskoura.entity.User;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.TaskRepository;
import com.taskoura.repository.TestCaseRepository;
import com.taskoura.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestCaseServiceTest {

    @Mock
    private TestCaseRepository testCaseRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private TestCaseService testCaseService;

    private UUID taskId;
    private Task task;
    private User tester;

    @BeforeEach
    void setUp() {
        taskId = UUID.randomUUID();
        task = Task.builder().id(taskId).title("Task").build();
        tester = User.builder().id(UUID.randomUUID()).name("Tester").email("tester@example.com").build();
    }

    @Test
    @DisplayName("createTestCase: saves test case with pass/fail boolean")
    void createTestCase_success() {
        CreateTestCaseRequest request = new CreateTestCaseRequest("Verify response", "200 OK", true);
        TestCase savedTestCase = TestCase.builder()
                .id(UUID.randomUUID())
                .task(task)
                .description("Verify response")
                .expectedResult("200 OK")
                .passed(true)
                .executedBy(tester)
                .executedAt(LocalDateTime.now())
                .build();

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(userRepository.findByEmail("tester@example.com")).thenReturn(Optional.of(tester));
        when(testCaseRepository.save(any(TestCase.class))).thenReturn(savedTestCase);

        TestCaseResponse response = testCaseService.createTestCase(taskId, request, "tester@example.com");

        assertThat(response).isNotNull();
        assertThat(response.description()).isEqualTo("Verify response");
        assertThat(response.passed()).isTrue();
        assertThat(response.executedBy()).isEqualTo(tester.getId());
    }

    @Test
    @DisplayName("createTestCase: throws NotFoundException when task does not exist")
    void createTestCase_taskNotFound() {
        CreateTestCaseRequest request = new CreateTestCaseRequest("Desc", "Exp", false);
        when(taskRepository.findById(taskId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> testCaseService.createTestCase(taskId, request, "tester@example.com"))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Task not found");
    }

    @Test
    @DisplayName("getTestCasesForTask: returns list of test cases")
    void getTestCasesForTask_success() {
        TestCase tc = TestCase.builder()
                .id(UUID.randomUUID())
                .task(task)
                .description("Desc")
                .expectedResult("Exp")
                .passed(false)
                .executedBy(tester)
                .build();

        when(taskRepository.existsById(taskId)).thenReturn(true);
        when(testCaseRepository.findByTaskIdOrderByExecutedAtAsc(taskId)).thenReturn(List.of(tc));

        List<TestCaseResponse> responses = testCaseService.getTestCasesForTask(taskId);

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).passed()).isFalse();
    }
}
