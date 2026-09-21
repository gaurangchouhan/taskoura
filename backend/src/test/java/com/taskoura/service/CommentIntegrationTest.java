package com.taskoura.service;

import com.taskoura.dto.CommentDtos.CreateCommentRequest;
import com.taskoura.dto.CommentDtos.CommentResponse;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.dto.TaskDtos.CreateTaskRequest;
import com.taskoura.dto.TaskDtos.TaskResponse;
import com.taskoura.entity.User;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class CommentIntegrationTest {

    @Autowired
    private CommentService commentService;

    @Autowired
    private TaskService taskService;

    @Autowired
    private ProjectService projectService;

    @Autowired
    private UserRepository userRepository;

    private User authorUser;
    private TaskResponse testTask;

    @BeforeEach
    void setUp() {
        authorUser = userRepository.save(User.builder()
                .name("Alice Developer")
                .email("alice-dev-" + UUID.randomUUID() + "@example.com")
                .passwordHash("pass")
                .verified(true)
                .build());

        ProjectResponse project = projectService.createProject(
                authorUser.getEmail(),
                new CreateProjectRequest("Comment Proj", "Desc", "React", "Spring", "PG", "JUnit", LocalDate.now().plusMonths(1))
        );

        testTask = taskService.createTask(
                project.id(),
                new CreateTaskRequest("Comment Task", "Task description", "Backend", "High", authorUser.getId(), LocalDate.now().plusDays(5))
        );
    }

    @Test
    @DisplayName("End-to-End: posting and listing comments includes userName, non-existent task throws 404, empty comment throws 400")
    void fullCommentLifecycle() {
        // 1. Post a valid comment -> GET comments -> verify userName is returned correctly
        CreateCommentRequest request = new CreateCommentRequest("Backend implementation completed and ready for testing.");
        CommentResponse response = commentService.addComment(testTask.id(), request, authorUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.content()).isEqualTo("Backend implementation completed and ready for testing.");
        assertThat(response.userName()).isEqualTo("Alice Developer");
        assertThat(response.userId()).isEqualTo(authorUser.getId());
        assertThat(response.taskId()).isEqualTo(testTask.id());

        List<CommentResponse> comments = commentService.getComments(testTask.id());
        assertThat(comments).hasSize(1);
        assertThat(comments.get(0).userName()).isEqualTo("Alice Developer");
        assertThat(comments.get(0).content()).isEqualTo("Backend implementation completed and ready for testing.");

        // 2. Post on non-existent task id -> throws NotFoundException
        UUID nonExistentTaskId = UUID.randomUUID();
        assertThatThrownBy(() -> commentService.addComment(nonExistentTaskId, request, authorUser.getEmail()))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Task not found");

        // 3. Post empty-string comment -> throws BadRequestException (enforced 400 validation rule)
        CreateCommentRequest emptyComment = new CreateCommentRequest("   ");
        assertThatThrownBy(() -> commentService.addComment(testTask.id(), emptyComment, authorUser.getEmail()))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Comment content cannot be empty");
    }
}
