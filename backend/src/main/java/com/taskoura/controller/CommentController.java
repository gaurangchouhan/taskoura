package com.taskoura.controller;

import com.taskoura.dto.CommentDtos.*;
import com.taskoura.service.CommentService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    @PostMapping("/api/tasks/{taskId}/comments")
    public ResponseEntity<CommentResponse> addComment(
            @PathVariable UUID taskId,
            @RequestBody CreateCommentRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.status(201).body(commentService.addComment(taskId, request, authentication.getName()));
    }

    @GetMapping("/api/tasks/{taskId}/comments")
    public ResponseEntity<List<CommentResponse>> getComments(@PathVariable UUID taskId) {
        return ResponseEntity.ok(commentService.getComments(taskId));
    }
}