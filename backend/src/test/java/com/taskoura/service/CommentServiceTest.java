package com.taskoura.service;

import com.taskoura.dto.CommentDtos.CreateCommentRequest;
import com.taskoura.dto.CommentDtos.CommentResponse;
import com.taskoura.entity.Comment;
import com.taskoura.entity.Project;
import com.taskoura.entity.ProjectMember;
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

    @Mock
    private com.taskoura.repository.ProjectMemberRepository projectMemberRepository;

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

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(commentRepository.findByTaskIdOrderByCreatedAtAsc(taskId)).thenReturn(List.of(comment));

        List<CommentResponse> comments = commentService.getComments(taskId);

        assertThat(comments).hasSize(1);
        assertThat(comments.get(0).content()).isEqualTo("Nice work!");
        assertThat(comments.get(0).userName()).isEqualTo("Sarah Writer");
    }

    @Test
    @DisplayName("getComments: throws NotFoundException when task does not exist")
    void getComments_taskNotFound_throwsNotFound() {
        when(taskRepository.findById(taskId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> commentService.getComments(taskId))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Task not found");
    }

    @Test
    @DisplayName("addComment: mentioning project member triggers targeted notification")
    void addComment_withMemberMention_triggersNotification() {
        User bob = User.builder().id(UUID.randomUUID()).name("Bob Dev").email("bob@example.com").build();
        ProjectMember bobMember = ProjectMember.builder().project(task.getProject()).user(bob).role("Member").build();

        CreateCommentRequest req = new CreateCommentRequest("Hey @Bob Dev please check this");
        Comment savedComment = Comment.builder().id(UUID.randomUUID()).task(task).user(author).content(req.content()).build();

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(userRepository.findByEmail(author.getEmail())).thenReturn(Optional.of(author));
        when(commentRepository.save(any(Comment.class))).thenReturn(savedComment);
        when(projectMemberRepository.findByProjectId(task.getProject().getId())).thenReturn(List.of(bobMember));

        CommentResponse res = commentService.addComment(taskId, req, author.getEmail());

        assertThat(res).isNotNull();
        assertThat(res.mentionedUserIds()).contains(bob.getId());
        verify(notificationService).createNotification(eq(bob), contains("Sarah Writer mentioned you in a comment"));
    }

    @Test
    @DisplayName("addComment: mentioning non-member does not create notification and comment saves fine")
    void addComment_withNonMemberMention_noNotification() {
        User bob = User.builder().id(UUID.randomUUID()).name("Bob Dev").email("bob@example.com").build();
        ProjectMember bobMember = ProjectMember.builder().project(task.getProject()).user(bob).role("Member").build();

        CreateCommentRequest req = new CreateCommentRequest("Hey @Stranger what do you think?");
        Comment savedComment = Comment.builder().id(UUID.randomUUID()).task(task).user(author).content(req.content()).build();

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(userRepository.findByEmail(author.getEmail())).thenReturn(Optional.of(author));
        when(commentRepository.save(any(Comment.class))).thenReturn(savedComment);
        when(projectMemberRepository.findByProjectId(task.getProject().getId())).thenReturn(List.of(bobMember));

        CommentResponse res = commentService.addComment(taskId, req, author.getEmail());

        assertThat(res).isNotNull();
        assertThat(res.mentionedUserIds()).isEmpty();
        verify(notificationService, never()).createNotification(any(), contains("mentioned you"));
    }
}
