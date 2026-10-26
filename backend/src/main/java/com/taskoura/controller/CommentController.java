package com.taskoura.controller;

import com.taskoura.dto.CommentDtos.*;
import com.taskoura.service.CommentService;
import com.taskoura.service.ProjectAccessService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
public class CommentController {

    private final CommentService commentService;
    private final ProjectAccessService projectAccessService;

    public CommentController(CommentService commentService, ProjectAccessService projectAccessService) {
        this.commentService = commentService;
        this.projectAccessService = projectAccessService;
    }

    @PostMapping("/api/tasks/{taskId}/comments")
    public ResponseEntity<CommentResponse> addComment(
            @PathVariable UUID taskId,
            @RequestBody CreateCommentRequest request,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireTaskAccess(taskId, email);
        return ResponseEntity.status(201).body(commentService.addComment(taskId, request, email));
    }

    @GetMapping("/api/tasks/{taskId}/comments")
    public ResponseEntity<List<CommentResponse>> getComments(
            @PathVariable UUID taskId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireTaskAccess(taskId, email);
        return ResponseEntity.ok(commentService.getComments(taskId));
    }
}