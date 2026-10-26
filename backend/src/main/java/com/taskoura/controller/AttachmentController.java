package com.taskoura.controller;

import com.taskoura.dto.AttachmentDtos.AttachmentResponse;
import com.taskoura.service.AttachmentService;
import com.taskoura.service.ProjectAccessService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
public class AttachmentController {

    private final AttachmentService attachmentService;
    private final ProjectAccessService projectAccessService;

    public AttachmentController(AttachmentService attachmentService, ProjectAccessService projectAccessService) {
        this.attachmentService = attachmentService;
        this.projectAccessService = projectAccessService;
    }

    @PostMapping(value = "/api/tasks/{taskId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AttachmentResponse> uploadAttachment(
            @PathVariable UUID taskId,
            @RequestParam("file") MultipartFile file,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireTaskAccess(taskId, email);
        AttachmentResponse response = attachmentService.addAttachment(taskId, file, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/api/tasks/{taskId}/attachments")
    public ResponseEntity<List<AttachmentResponse>> getAttachments(
            @PathVariable UUID taskId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        projectAccessService.requireTaskAccess(taskId, email);
        return ResponseEntity.ok(attachmentService.getAttachments(taskId));
    }

    @GetMapping("/api/attachments/{attachmentId}/download")
    public ResponseEntity<byte[]> downloadAttachment(@PathVariable UUID attachmentId) {
        var attachment = attachmentService.getAttachmentEntity(attachmentId);
        byte[] data = attachmentService.getAttachmentBytes(attachmentId);

        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(attachment.getFileType());
        } catch (Exception e) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + attachment.getFileName() + "\"")
                .body(data);
    }

    @DeleteMapping("/api/attachments/{attachmentId}")
    public ResponseEntity<Void> deleteAttachment(
            @PathVariable UUID attachmentId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        attachmentService.deleteAttachment(attachmentId, email);
        return ResponseEntity.noContent().build();
    }
}
