package com.taskoura.service;

import com.taskoura.dto.CommentDtos.*;
import com.taskoura.entity.Comment;
import com.taskoura.entity.Task;
import com.taskoura.entity.User;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.CommentRepository;
import com.taskoura.repository.TaskRepository;
import com.taskoura.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class CommentService {

    private final CommentRepository commentRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public CommentService(CommentRepository commentRepository, TaskRepository taskRepository,
                          UserRepository userRepository, NotificationService notificationService) {
        this.commentRepository = commentRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    public CommentResponse addComment(UUID taskId, CreateCommentRequest request, String userEmail) {
        if (request == null || request.content() == null || request.content().trim().isEmpty()) {
            throw new BadRequestException("Comment content cannot be empty");
        }

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found"));

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new NotFoundException("User not found"));

        Comment comment = Comment.builder()
                .task(task)
                .user(user)
                .content(request.content().trim())
                .build();

        Comment saved = commentRepository.save(comment);

        // Log COMMENT_ADDED activity
        notificationService.logActivity(task.getProject(), user,
                "COMMENT_ADDED",
                user.getName() + " commented on task \"" + task.getTitle() + "\"");

        return toResponse(saved);
    }

    public List<CommentResponse> getComments(UUID taskId) {
        if (!taskRepository.existsById(taskId)) {
            throw new NotFoundException("Task not found");
        }

        return commentRepository.findByTaskIdOrderByCreatedAtAsc(taskId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private CommentResponse toResponse(Comment comment) {
        return new CommentResponse(
                comment.getId(),
                comment.getTask().getId(),
                comment.getUser().getId(),
                comment.getUser().getName(),
                comment.getContent(),
                comment.getCreatedAt()
        );
    }
}