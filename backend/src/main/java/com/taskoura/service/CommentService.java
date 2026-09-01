package com.taskoura.service;

import com.taskoura.dto.CommentDtos.*;
import com.taskoura.entity.Comment;
import com.taskoura.entity.Task;
import com.taskoura.entity.User;
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

    public CommentService(CommentRepository commentRepository, TaskRepository taskRepository, UserRepository userRepository) {
        this.commentRepository = commentRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
    }

    public CommentResponse addComment(UUID taskId, CreateCommentRequest request, String userEmail) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalStateException("Task not found"));

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new IllegalStateException("User not found"));

        Comment comment = Comment.builder()
                .task(task)
                .user(user)
                .content(request.content())
                .build();

        Comment saved = commentRepository.save(comment);
        return toResponse(saved);
    }

    public List<CommentResponse> getComments(UUID taskId) {
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