package com.taskoura.service;

import com.taskoura.dto.AttachmentDtos.AttachmentResponse;
import com.taskoura.entity.Attachment;
import com.taskoura.entity.Project;
import com.taskoura.entity.ProjectMember;
import com.taskoura.entity.Task;
import com.taskoura.entity.User;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.AttachmentRepository;
import com.taskoura.repository.ProjectMemberRepository;
import com.taskoura.repository.TaskRepository;
import com.taskoura.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AttachmentServiceTest {

    @Mock private AttachmentRepository attachmentRepository;
    @Mock private TaskRepository taskRepository;
    @Mock private UserRepository userRepository;
    @Mock private ProjectMemberRepository projectMemberRepository;
    @Mock private AttachmentStorageService attachmentStorageService;

    @InjectMocks private AttachmentService attachmentService;

    private UUID taskId;
    private User owner;
    private User uploader;
    private User otherMember;
    private Project project;
    private Task task;

    @BeforeEach
    void setUp() {
        taskId = UUID.randomUUID();
        owner = User.builder().id(UUID.randomUUID()).name("Project Owner").email("owner@test.com").build();
        uploader = User.builder().id(UUID.randomUUID()).name("File Uploader").email("uploader@test.com").build();
        otherMember = User.builder().id(UUID.randomUUID()).name("Other Member").email("other@test.com").build();

        project = Project.builder().id(UUID.randomUUID()).name("Test Project").owner(owner).build();
        task = Task.builder().id(taskId).title("Test Task").project(project).build();
    }

    @Test
    @DisplayName("addAttachment: successfully uploads valid image and saves entity")
    void addAttachment_validImage_success() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "architecture.png", "image/png", "fake image content".getBytes()
        );

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(userRepository.findByEmail(uploader.getEmail())).thenReturn(Optional.of(uploader));
        when(attachmentStorageService.uploadFile(file)).thenReturn("https://res.cloudinary.com/demo/image/upload/sample.png");
        when(attachmentRepository.save(any(Attachment.class))).thenAnswer(inv -> {
            Attachment a = inv.getArgument(0);
            a.setId(UUID.randomUUID());
            return a;
        });

        AttachmentResponse response = attachmentService.addAttachment(taskId, file, uploader.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.fileName()).isEqualTo("architecture.png");
        assertThat(response.fileType()).isEqualTo("image/png");
        assertThat(response.fileUrl()).isEqualTo("https://res.cloudinary.com/demo/image/upload/sample.png");
        assertThat(response.uploadedBy()).isEqualTo(uploader.getId());
        verify(attachmentStorageService).uploadFile(file);
        verify(attachmentRepository).save(any(Attachment.class));
    }

    @Test
    @DisplayName("addAttachment: rejects file exceeding 10MB limit with BadRequestException")
    void addAttachment_exceedsSizeLimit_throwsBadRequest() {
        byte[] largeBytes = new byte[10 * 1024 * 1024 + 1]; // 10MB + 1 byte
        MockMultipartFile largeFile = new MockMultipartFile(
                "file", "huge_file.pdf", "application/pdf", largeBytes
        );

        assertThatThrownBy(() -> attachmentService.addAttachment(taskId, largeFile, uploader.getEmail()))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("File size exceeds 10MB limit");

        verifyNoInteractions(attachmentStorageService);
        verifyNoInteractions(attachmentRepository);
    }

    @Test
    @DisplayName("addAttachment: rejects executable file (.exe, .sh) with BadRequestException")
    void addAttachment_executableFile_throwsBadRequest() {
        MockMultipartFile exeFile = new MockMultipartFile(
                "file", "malicious_script.sh", "application/x-sh", "echo hello".getBytes()
        );

        assertThatThrownBy(() -> attachmentService.addAttachment(taskId, exeFile, uploader.getEmail()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Disallowed executable/script file type: .sh");

        verifyNoInteractions(attachmentStorageService);
        verifyNoInteractions(attachmentRepository);
    }

    @Test
    @DisplayName("deleteAttachment: uploader is allowed to delete")
    void deleteAttachment_byUploader_success() {
        UUID attachmentId = UUID.randomUUID();
        Attachment attachment = Attachment.builder()
                .id(attachmentId)
                .task(task)
                .uploadedBy(uploader)
                .fileUrl("http://storage.com/file.png")
                .build();

        when(attachmentRepository.findById(attachmentId)).thenReturn(Optional.of(attachment));
        when(userRepository.findByEmail(uploader.getEmail())).thenReturn(Optional.of(uploader));

        attachmentService.deleteAttachment(attachmentId, uploader.getEmail());

        verify(attachmentRepository).delete(attachment);
    }

    @Test
    @DisplayName("deleteAttachment: project owner is allowed to delete someone else's attachment")
    void deleteAttachment_byProjectOwner_success() {
        UUID attachmentId = UUID.randomUUID();
        Attachment attachment = Attachment.builder()
                .id(attachmentId)
                .task(task)
                .uploadedBy(uploader)
                .fileUrl("http://storage.com/file.png")
                .build();

        when(attachmentRepository.findById(attachmentId)).thenReturn(Optional.of(attachment));
        when(userRepository.findByEmail(owner.getEmail())).thenReturn(Optional.of(owner));

        attachmentService.deleteAttachment(attachmentId, owner.getEmail());

        verify(attachmentRepository).delete(attachment);
    }

    @Test
    @DisplayName("deleteAttachment: non-uploader and non-owner member gets 403 Forbidden")
    void deleteAttachment_byOtherMember_throwsForbidden() {
        UUID attachmentId = UUID.randomUUID();
        Attachment attachment = Attachment.builder()
                .id(attachmentId)
                .task(task)
                .uploadedBy(uploader)
                .fileUrl("http://storage.com/file.png")
                .build();

        when(attachmentRepository.findById(attachmentId)).thenReturn(Optional.of(attachment));
        when(userRepository.findByEmail(otherMember.getEmail())).thenReturn(Optional.of(otherMember));
        when(projectMemberRepository.findByProjectIdAndUserId(project.getId(), otherMember.getId()))
                .thenReturn(Optional.of(ProjectMember.builder().role("Member").build()));

        assertThatThrownBy(() -> attachmentService.deleteAttachment(attachmentId, otherMember.getEmail()))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Only the uploader or project owner can delete this attachment");

        verify(attachmentRepository, never()).delete(any());
    }
}
