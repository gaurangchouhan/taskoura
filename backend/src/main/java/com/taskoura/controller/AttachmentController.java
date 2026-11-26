package com.taskoura.controller;

import com.taskoura.dto.AttachmentDtos.*;
import com.taskoura.service.AttachmentService;
import com.taskoura.service.BioLockAccessService;
import com.taskoura.service.ProjectAccessService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.InputStream;
import java.util.List;
import java.util.UUID;

@RestController
public class AttachmentController {

    private final AttachmentService attachmentService;
    private final ProjectAccessService projectAccessService;
    private final BioLockAccessService bioLockAccessService;

    public AttachmentController(AttachmentService attachmentService,
                                ProjectAccessService projectAccessService,
                                BioLockAccessService bioLockAccessService) {
        this.attachmentService = attachmentService;
        this.projectAccessService = projectAccessService;
        this.bioLockAccessService = bioLockAccessService;
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
        return ResponseEntity.ok(attachmentService.getAttachments(taskId, email));
    }

    @PutMapping("/api/attachments/{attachmentId}/restricted")
    public ResponseEntity<AttachmentResponse> restrictAttachment(
            @PathVariable UUID attachmentId,
            @RequestBody RestrictDocumentRequest request,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        return ResponseEntity.ok(attachmentService.restrictAttachment(attachmentId, request.restricted(), email));
    }

    @GetMapping("/api/attachments/{attachmentId}/content")
    public ResponseEntity<StreamingResponseBody> streamAttachment(
            @PathVariable UUID attachmentId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        InputStream in = attachmentService.getAttachmentInputStream(attachmentId, email);
        var attachment = attachmentService.getAttachmentEntity(attachmentId);

        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(attachment.getFileType());
        } catch (Exception e) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }

        StreamingResponseBody responseBody = outputStream -> {
            try (in) {
                in.transferTo(outputStream);
            }
        };

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + attachment.getFileName() + "\"")
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(responseBody);
    }

    @GetMapping("/api/attachments/{attachmentId}/download")
    public ResponseEntity<byte[]> downloadAttachment(
            @PathVariable UUID attachmentId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        var attachment = attachmentService.getAttachmentEntity(attachmentId);
        byte[] data = attachmentService.getAttachmentBytes(attachmentId, email);

        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(attachment.getFileType());
        } catch (Exception e) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }

        var builder = ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + attachment.getFileName() + "\"");

        if (attachment.isRestricted()) {
            builder.header("X-Content-Type-Options", "nosniff")
                   .header(HttpHeaders.CACHE_CONTROL, "no-store");
        }

        return builder.body(data);
    }

    @PostMapping("/api/attachments/{attachmentId}/access-request")
    public ResponseEntity<DocumentAccessRequestResponse> requestAccess(
            @PathVariable UUID attachmentId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        DocumentAccessRequestResponse response = bioLockAccessService.requestAccess(email, attachmentId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/api/attachments/{attachmentId}/access")
    public ResponseEntity<DocumentAccessStateResponse> getAccessState(
            @PathVariable UUID attachmentId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        return ResponseEntity.ok(bioLockAccessService.getAccessState(email, attachmentId));
    }

    @PostMapping("/api/attachments/access-requests/{requestId}/cancel")
    public ResponseEntity<Void> cancelAccessRequest(
            @PathVariable UUID requestId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        bioLockAccessService.cancelAccessRequest(email, requestId);
        return ResponseEntity.ok().build();
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
