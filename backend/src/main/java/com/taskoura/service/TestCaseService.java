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
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class TestCaseService {

    private final TestCaseRepository testCaseRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    public TestCaseService(TestCaseRepository testCaseRepository, TaskRepository taskRepository, UserRepository userRepository) {
        this.testCaseRepository = testCaseRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
    }

    public TestCaseResponse createTestCase(UUID taskId, CreateTestCaseRequest request, String userEmail) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found"));

        User executedBy = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new NotFoundException("User not found"));

        TestCase testCase = TestCase.builder()
                .task(task)
                .description(request.description())
                .expectedResult(request.expectedResult())
                .passed(request.passed())
                .executedBy(executedBy)
                .build();

        TestCase saved = testCaseRepository.save(testCase);
        return toResponse(saved);
    }

    public List<TestCaseResponse> getTestCasesForTask(UUID taskId) {
        if (!taskRepository.existsById(taskId)) {
            throw new NotFoundException("Task not found");
        }

        return testCaseRepository.findByTaskIdOrderByExecutedAtAsc(taskId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private TestCaseResponse toResponse(TestCase testCase) {
        return new TestCaseResponse(
                testCase.getId(),
                testCase.getDescription(),
                testCase.getExpectedResult(),
                testCase.isPassed(),
                testCase.getExecutedBy().getId(),
                testCase.getExecutedAt()
        );
    }
}
