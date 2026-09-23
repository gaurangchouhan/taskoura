package com.taskoura.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class AttachmentDtos {

    public record AttachmentResponse(
            UUID id,
            UUID taskId,
            UUID uploadedBy,
            String uploadedByName,
            String fileUrl,
            String fileType,
            String fileName,
            LocalDateTime uploadedAt
    ) {}
}
