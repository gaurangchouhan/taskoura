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
import com.taskoura.entity.ProjectMember;
import com.taskoura.repository.ProjectMemberRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class CommentService {

    private static final Logger log = LoggerFactory.getLogger(CommentService.class);

    private final CommentRepository commentRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final ProjectMemberRepository projectMemberRepository;

    public CommentService(CommentRepository commentRepository,
                          TaskRepository taskRepository,
                          UserRepository userRepository,
                          NotificationService notificationService,
                          ProjectMemberRepository projectMemberRepository) {
        this.commentRepository = commentRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.projectMemberRepository = projectMemberRepository;
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

        // Process @mentions for targeted notifications (never fail comment creation)
        List<UUID> mentionedUserIds = processMentions(task, user, saved.getContent());

        return toResponse(saved, mentionedUserIds);
    }

    public List<CommentResponse> getComments(UUID taskId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found"));

        return commentRepository.findByTaskIdOrderByCreatedAtAsc(taskId)
                .stream()
                .map(c -> toResponse(c, extractMentionedUserIds(task, c.getContent())))
                .toList();
    }

    private List<UUID> processMentions(Task task, User commenter, String content) {
        List<UUID> mentionedUserIds = new ArrayList<>();
        if (content == null || !content.contains("@")) {
            return mentionedUserIds;
        }

        try {
            List<ProjectMember> members = projectMemberRepository.findByProjectId(task.getProject().getId());
            for (ProjectMember member : members) {
                User memberUser = member.getUser();
                if (memberUser == null || memberUser.getId().equals(commenter.getId())) {
                    continue; // Skip self or null
                }

                if (isUserMentioned(content, memberUser)) {
                    if (!mentionedUserIds.contains(memberUser.getId())) {
                        mentionedUserIds.add(memberUser.getId());
                        notificationService.createNotification(memberUser,
                                commenter.getName() + " mentioned you in a comment on '" + task.getTitle() + "'");
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to process mentions in comment: {}", e.getMessage(), e);
        }
        return mentionedUserIds;
    }

    private List<UUID> extractMentionedUserIds(Task task, String content) {
        List<UUID> mentionedUserIds = new ArrayList<>();
        if (content == null || !content.contains("@")) {
            return mentionedUserIds;
        }

        try {
            List<ProjectMember> members = projectMemberRepository.findByProjectId(task.getProject().getId());
            for (ProjectMember member : members) {
                User memberUser = member.getUser();
                if (memberUser != null && isUserMentioned(content, memberUser)) {
                    if (!mentionedUserIds.contains(memberUser.getId())) {
                        mentionedUserIds.add(memberUser.getId());
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Failed to extract mention IDs: {}", e.getMessage());
        }
        return mentionedUserIds;
    }

    private boolean isUserMentioned(String content, User user) {
        if (user.getEmail() != null) {
            Pattern emailPattern = Pattern.compile("(?i)@" + Pattern.quote(user.getEmail()) + "\\b");
            if (emailPattern.matcher(content).find()) {
                return true;
            }
        }

        if (user.getName() != null && !user.getName().isBlank()) {
            Pattern namePattern = Pattern.compile("(?i)@" + Pattern.quote(user.getName()) + "\\b");
            if (namePattern.matcher(content).find()) {
                return true;
            }

            String firstName = user.getName().split("\\s+")[0];
            if (firstName.length() >= 2) {
                Pattern firstNamePattern = Pattern.compile("(?i)@" + Pattern.quote(firstName) + "\\b");
                if (firstNamePattern.matcher(content).find()) {
                    return true;
                }
            }
        }

        return false;
    }

    private CommentResponse toResponse(Comment comment, List<UUID> mentionedUserIds) {
        return new CommentResponse(
                comment.getId(),
                comment.getTask().getId(),
                comment.getUser().getId(),
                comment.getUser().getName(),
                comment.getContent(),
                comment.getCreatedAt(),
                mentionedUserIds
        );
    }
}