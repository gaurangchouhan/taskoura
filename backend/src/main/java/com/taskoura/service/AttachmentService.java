package com.taskoura.service;

import com.taskoura.dto.AttachmentDtos.AttachmentResponse;
import com.taskoura.entity.Attachment;
import com.taskoura.entity.Project;
import com.taskoura.entity.Task;
import com.taskoura.entity.User;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.AttachmentRepository;
import com.taskoura.repository.ProjectMemberRepository;
import com.taskoura.repository.TaskRepository;
import com.taskoura.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class AttachmentService {

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    private static final Set<String> DISALLOWED_EXTENSIONS = Set.of(
            "exe", "bat", "cmd", "sh", "bin", "msi", "com", "vbs", "ps1", "app", "jar", "war", "dll", "so", "dmg"
    );

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            // Images
            "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico",
            // Documents
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf", "odt", "ods", "odp",
            // Data / Code / Archives
            "json", "xml", "yaml", "yml", "md", "zip", "tar", "gz", "7z"
    );

    private final AttachmentRepository attachmentRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final AttachmentStorageService attachmentStorageService;

    public AttachmentService(AttachmentRepository attachmentRepository,
                             TaskRepository taskRepository,
                             UserRepository userRepository,
                             ProjectMemberRepository projectMemberRepository,
                             AttachmentStorageService attachmentStorageService) {
        this.attachmentRepository = attachmentRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.attachmentStorageService = attachmentStorageService;
    }

    public AttachmentResponse addAttachment(UUID taskId, MultipartFile file, String uploaderEmail) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File must not be empty");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("File size exceeds 10MB limit");
        }

        String originalFilename = file.getOriginalFilename();
        validateFileType(originalFilename, file.getContentType());

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found"));

        User uploader = userRepository.findByEmail(uploaderEmail)
                .orElseThrow(() -> new NotFoundException("User not found"));

        String fileUrl = attachmentStorageService.uploadFile(file);

        String contentType = file.getContentType();
        if (contentType == null || contentType.isBlank()) {
            contentType = "application/octet-stream";
        }

        Attachment attachment = Attachment.builder()
                .task(task)
                .uploadedBy(uploader)
                .fileUrl(fileUrl)
                .fileType(contentType)
                .fileName(originalFilename != null ? originalFilename : "attachment")
                .build();

        Attachment saved = attachmentRepository.save(attachment);
        return toResponse(saved);
    }

    public List<AttachmentResponse> getAttachments(UUID taskId) {
        if (!taskRepository.existsById(taskId)) {
            throw new NotFoundException("Task not found");
        }

        return attachmentRepository.findByTaskIdOrderByUploadedAtAsc(taskId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public void deleteAttachment(UUID attachmentId, String callerEmail) {
        Attachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new NotFoundException("Attachment not found"));

        User caller = userRepository.findByEmail(callerEmail)
                .orElseThrow(() -> new NotFoundException("User not found"));

        Project project = attachment.getTask().getProject();

        boolean isUploader = attachment.getUploadedBy().getId().equals(caller.getId());
        boolean isProjectOwner = (project.getOwner() != null && project.getOwner().getId().equals(caller.getId())) ||
                projectMemberRepository.findByProjectIdAndUserId(project.getId(), caller.getId())
                        .map(pm -> "Owner".equalsIgnoreCase(pm.getRole()))
                        .orElse(false);

        if (!isUploader && !isProjectOwner) {
            throw new ForbiddenException("Only the uploader or project owner can delete this attachment");
        }

        attachmentRepository.delete(attachment);
    }

    private void validateFileType(String filename, String contentType) {
        if (filename == null || !filename.contains(".")) {
            throw new BadRequestException("File name must include a valid extension");
        }

        String ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);

        if (DISALLOWED_EXTENSIONS.contains(ext)) {
            throw new BadRequestException("Disallowed executable/script file type: ." + ext);
        }

        if (contentType != null) {
            String lowerContent = contentType.toLowerCase(Locale.ROOT);
            if (lowerContent.contains("x-msdownload") || lowerContent.contains("x-sh") || lowerContent.contains("x-bat")
                    || lowerContent.contains("x-executable")) {
                throw new BadRequestException("Disallowed executable content type: " + contentType);
            }
        }

        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw new BadRequestException("Disallowed file type: ." + ext + ". Allowed formats include images, PDFs, office docs, and archives.");
        }
    }

    private AttachmentResponse toResponse(Attachment attachment) {
        return new AttachmentResponse(
                attachment.getId(),
                attachment.getTask().getId(),
                attachment.getUploadedBy().getId(),
                attachment.getUploadedBy().getName(),
                attachment.getFileUrl(),
                attachment.getFileType(),
                attachment.getFileName(),
                attachment.getUploadedAt()
        );
    }
}
