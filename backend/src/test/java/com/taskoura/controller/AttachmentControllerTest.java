package com.taskoura.controller;

import com.taskoura.config.SecurityConfig;
import com.taskoura.dto.AttachmentDtos.AttachmentResponse;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.exception.GlobalExceptionHandler;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.JwtUtil;
import com.taskoura.service.AttachmentService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AttachmentController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
    "jwt.secret=taskoura-super-secret-test-jwt-key-256-bits-length!!",
    "jwt.expiration-ms=86400000"
})
class AttachmentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private AttachmentService attachmentService;

    @Test
    @DisplayName("POST /api/tasks/{taskId}/attachments: 201 Created on successful upload")
    void uploadAttachment_success() throws Exception {
        UUID taskId = UUID.randomUUID();
        String token = jwtUtil.generateToken("user@test.com");
        MockMultipartFile file = new MockMultipartFile(
                "file", "diagram.png", "image/png", "png data".getBytes()
        );

        AttachmentResponse response = new AttachmentResponse(
                UUID.randomUUID(), taskId, UUID.randomUUID(), "Alice",
                "https://storage.cloud/diagram.png", "image/png", "diagram.png", LocalDateTime.now()
        );

        when(attachmentService.addAttachment(eq(taskId), any(), eq("user@test.com"))).thenReturn(response);

        mockMvc.perform(multipart("/api/tasks/{taskId}/attachments", taskId)
                        .file(file)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fileName").value("diagram.png"))
                .andExpect(jsonPath("$.fileUrl").value("https://storage.cloud/diagram.png"));
    }

    @Test
    @DisplayName("GET /api/tasks/{taskId}/attachments: 200 OK with list of attachments")
    void getAttachments_success() throws Exception {
        UUID taskId = UUID.randomUUID();
        String token = jwtUtil.generateToken("user@test.com");

        AttachmentResponse item = new AttachmentResponse(
                UUID.randomUUID(), taskId, UUID.randomUUID(), "Alice",
                "https://storage.cloud/doc.pdf", "application/pdf", "doc.pdf", LocalDateTime.now()
        );

        when(attachmentService.getAttachments(taskId)).thenReturn(List.of(item));

        mockMvc.perform(get("/api/tasks/{taskId}/attachments", taskId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].fileName").value("doc.pdf"))
                .andExpect(jsonPath("$[0].fileType").value("application/pdf"));
    }

    @Test
    @DisplayName("DELETE /api/attachments/{attachmentId}: 204 No Content on successful deletion")
    void deleteAttachment_success() throws Exception {
        UUID attachmentId = UUID.randomUUID();
        String token = jwtUtil.generateToken("user@test.com");

        mockMvc.perform(delete("/api/attachments/{attachmentId}", attachmentId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("DELETE /api/attachments/{attachmentId}: 403 Forbidden when unauthorized user tries to delete")
    void deleteAttachment_unauthorized_returns403() throws Exception {
        UUID attachmentId = UUID.randomUUID();
        String token = jwtUtil.generateToken("hacker@test.com");

        doThrow(new ForbiddenException("Only the uploader or project owner can delete this attachment"))
                .when(attachmentService).deleteAttachment(eq(attachmentId), eq("hacker@test.com"));

        mockMvc.perform(delete("/api/attachments/{attachmentId}", attachmentId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.message").value("Only the uploader or project owner can delete this attachment"));
    }
}
