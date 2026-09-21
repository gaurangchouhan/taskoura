package com.taskoura.service;

import com.taskoura.dto.BugDtos.CreateBugRequest;
import com.taskoura.dto.BugDtos.BugResponse;
import com.taskoura.entity.Bug;
import com.taskoura.entity.Task;
import com.taskoura.entity.User;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.BugRepository;
import com.taskoura.repository.TaskRepository;
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
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BugServiceTest {

    @Mock
    private BugRepository bugRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private BugService bugService;

    private UUID taskId;
    private Task task;
    private User reporter;

    @BeforeEach
    void setUp() {
        taskId = UUID.randomUUID();
        task = Task.builder().id(taskId).title("Task").build();
        reporter = User.builder().id(UUID.randomUUID()).name("Reporter").email("reporter@example.com").build();
    }

    @Test
    @DisplayName("createBug: creates bug with status Open")
    void createBug_success() {
        CreateBugRequest request = new CreateBugRequest("High", "Button not clickable", null);
        Bug savedBug = Bug.builder()
                .id(UUID.randomUUID())
                .task(task)
                .reportedBy(reporter)
                .description("Button not clickable")
                .severity("High")
                .status("Open")
                .createdAt(LocalDateTime.now())
                .build();

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(userRepository.findByEmail("reporter@example.com")).thenReturn(Optional.of(reporter));
        when(bugRepository.save(any(Bug.class))).thenReturn(savedBug);

        BugResponse response = bugService.createBug(taskId, request, "reporter@example.com");

        assertThat(response).isNotNull();
        assertThat(response.severity()).isEqualTo("High");
        assertThat(response.status()).isEqualTo("Open");
        assertThat(response.reportedBy()).isEqualTo(reporter.getId());
    }

    @Test
    @DisplayName("resolveBug: updates status to Resolved and sets resolvedAt")
    void resolveBug_success() {
        UUID bugId = UUID.randomUUID();
        Bug bug = Bug.builder()
                .id(bugId)
                .task(task)
                .reportedBy(reporter)
                .status("Open")
                .build();

        when(bugRepository.findById(bugId)).thenReturn(Optional.of(bug));
        when(bugRepository.save(any(Bug.class))).thenAnswer(inv -> inv.getArgument(0));

        BugResponse response = bugService.resolveBug(bugId);

        assertThat(response.status()).isEqualTo("Resolved");
        assertThat(response.resolvedAt()).isNotNull();
    }

    @Test
    @DisplayName("resolveBug: throws NotFoundException when bug does not exist")
    void resolveBug_notFound() {
        UUID bugId = UUID.randomUUID();
        when(bugRepository.findById(bugId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> bugService.resolveBug(bugId))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Bug not found");
    }

    @Test
    @DisplayName("getBugsForTask: returns list of bugs")
    void getBugsForTask_success() {
        Bug bug = Bug.builder()
                .id(UUID.randomUUID())
                .task(task)
                .reportedBy(reporter)
                .severity("Medium")
                .status("Open")
                .build();

        when(taskRepository.existsById(taskId)).thenReturn(true);
        when(bugRepository.findByTaskIdOrderByCreatedAtAsc(taskId)).thenReturn(List.of(bug));

        List<BugResponse> bugs = bugService.getBugsForTask(taskId);

        assertThat(bugs).hasSize(1);
        assertThat(bugs.get(0).severity()).isEqualTo("Medium");
    }
}
