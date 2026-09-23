package com.taskoura.service;

import com.taskoura.dto.CommentDtos.CreateCommentRequest;
import com.taskoura.dto.CommentDtos.CommentResponse;
import com.taskoura.entity.Comment;
import com.taskoura.entity.Project;
import com.taskoura.entity.Task;
import com.taskoura.entity.User;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.CommentRepository;
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
class CommentServiceTest {

    @Mock
    private CommentRepository commentRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private CommentService commentService;

    private UUID taskId;
    private Task task;
    private User author;

    @BeforeEach
    void setUp() {
        taskId = UUID.randomUUID();
        Project project = Project.builder().id(UUID.randomUUID()).name("Test Project").build();
        task = Task.builder().id(taskId).title("Task").project(project).build();
        author = User.builder().id(UUID.randomUUID()).name("Sarah Writer").email("sarah@example.com").build();
    }

    @Test
    @DisplayName("addComment: successfully creates comment with author's name")
    void addComment_success() {
        CreateCommentRequest request = new CreateCommentRequest("PR is ready for review.");
        Comment savedComment = Comment.builder()
                .id(UUID.randomUUID())
                .task(task)
                .user(author)
                .content("PR is ready for review.")
                .createdAt(LocalDateTime.now())
                .build();

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(userRepository.findByEmail("sarah@example.com")).thenReturn(Optional.of(author));
        when(commentRepository.save(any(Comment.class))).thenReturn(savedComment);

        CommentResponse response = commentService.addComment(taskId, request, "sarah@example.com");

        assertThat(response).isNotNull();
        assertThat(response.content()).isEqualTo("PR is ready for review.");
        assertThat(response.userName()).isEqualTo("Sarah Writer");
        assertThat(response.userId()).isEqualTo(author.getId());
        assertThat(response.taskId()).isEqualTo(taskId);
    }

    @Test
    @DisplayName("addComment: rejects empty string comment with BadRequestException")
    void addComment_emptyString_throwsBadRequest() {
        CreateCommentRequest emptyRequest = new CreateCommentRequest("   ");

        assertThatThrownBy(() -> commentService.addComment(taskId, emptyRequest, "sarah@example.com"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Comment content cannot be empty");

        verify(commentRepository, never()).save(any());
    }

    @Test
    @DisplayName("addComment: throws NotFoundException when task does not exist")
    void addComment_taskNotFound_throwsNotFound() {
        CreateCommentRequest request = new CreateCommentRequest("Some comment");
        when(taskRepository.findById(taskId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> commentService.addComment(taskId, request, "sarah@example.com"))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Task not found");
    }

    @Test
    @DisplayName("getComments: returns comments for task")
    void getComments_success() {
        Comment comment = Comment.builder()
                .id(UUID.randomUUID())
                .task(task)
                .user(author)
                .content("Nice work!")
                .createdAt(LocalDateTime.now())
                .build();

        when(taskRepository.existsById(taskId)).thenReturn(true);
        when(commentRepository.findByTaskIdOrderByCreatedAtAsc(taskId)).thenReturn(List.of(comment));

        List<CommentResponse> comments = commentService.getComments(taskId);

        assertThat(comments).hasSize(1);
        assertThat(comments.get(0).content()).isEqualTo("Nice work!");
        assertThat(comments.get(0).userName()).isEqualTo("Sarah Writer");
    }

    @Test
    @DisplayName("getComments: throws NotFoundException when task does not exist")
    void getComments_taskNotFound_throwsNotFound() {
        when(taskRepository.existsById(taskId)).thenReturn(false);

        assertThatThrownBy(() -> commentService.getComments(taskId))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Task not found");
    }
}
