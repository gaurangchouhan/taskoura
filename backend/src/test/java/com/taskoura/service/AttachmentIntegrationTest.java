package com.taskoura.service;

import com.taskoura.dto.AttachmentDtos.AttachmentResponse;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.dto.ProjectMemberDtos.InviteMemberRequest;
import com.taskoura.dto.TaskDtos.CreateTaskRequest;
import com.taskoura.dto.TaskDtos.TaskResponse;
import com.taskoura.entity.User;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AttachmentIntegrationTest {

    @Autowired private AttachmentService attachmentService;
    @Autowired private ProjectService projectService;
    @Autowired private ProjectMemberService projectMemberService;
    @Autowired private TaskService taskService;
    @Autowired private UserRepository userRepository;

    @MockitoBean private AttachmentStorageService attachmentStorageService;

    private User owner;
    private User dev1;
    private User dev2;
    private ProjectResponse project;
    private TaskResponse task;

    @BeforeEach
    void setUp() {
        owner = userRepository.save(User.builder()
                .name("Project Owner")
                .email("owner-att-" + UUID.randomUUID() + "@test.com")
                .passwordHash("pass")
                .verified(true)
                .build());

        dev1 = userRepository.save(User.builder()
                .name("Dev One")
                .email("dev1-att-" + UUID.randomUUID() + "@test.com")
                .passwordHash("pass")
                .verified(true)
                .build());

        dev2 = userRepository.save(User.builder()
                .name("Dev Two")
                .email("dev2-att-" + UUID.randomUUID() + "@test.com")
                .passwordHash("pass")
                .verified(true)
                .build());

        project = projectService.createProject(owner.getEmail(),
                new CreateProjectRequest("Attachment Project", "Testing attachments",
                        "React", "Spring Boot", "PostgreSQL", "JUnit 5", LocalDate.now().plusMonths(1)));

        projectMemberService.inviteMember(project.id(), new InviteMemberRequest(dev1.getEmail(), "Member"));
        projectMemberService.inviteMember(project.id(), new InviteMemberRequest(dev2.getEmail(), "Member"));

        task = taskService.createTask(project.id(),
                new CreateTaskRequest("Attach UI Mockups", "Upload diagrams", "Frontend", "Medium", dev1.getId(), LocalDate.now().plusDays(5)));
    }

    @Test
    @DisplayName("Upload a real small image file -> returns working fileUrl and GET lists it back")
    void uploadSmallImage_returnsFileUrlAndGetListsItBack() {
        when(attachmentStorageService.uploadFile(any()))
                .thenReturn("https://res.cloudinary.com/test_cloud/image/upload/mockup_v1.png");

        MockMultipartFile file = new MockMultipartFile(
                "file", "mockup.png", "image/png", "png dummy binary payload".getBytes()
        );

        AttachmentResponse response = attachmentService.addAttachment(task.id(), file, dev1.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.fileName()).isEqualTo("mockup.png");
        assertThat(response.fileType()).isEqualTo("image/png");
        assertThat(response.fileUrl()).isEqualTo("https://res.cloudinary.com/test_cloud/image/upload/mockup_v1.png");
        assertThat(response.uploadedBy()).isEqualTo(dev1.getId());

        List<AttachmentResponse> list = attachmentService.getAttachments(task.id());
        assertThat(list).hasSize(1);
        assertThat(list.get(0).id()).isEqualTo(response.id());
        assertThat(list.get(0).fileUrl()).isEqualTo("https://res.cloudinary.com/test_cloud/image/upload/mockup_v1.png");
    }

    @Test
    @DisplayName("Attempt to upload a file over 10MB limit -> clean 400 BadRequestException")
    void uploadFileOver10MB_throwsCleanBadRequest() {
        byte[] largeBytes = new byte[10 * 1024 * 1024 + 10]; // Over 10MB
        MockMultipartFile largeFile = new MockMultipartFile(
                "file", "large_video.mp4", "video/mp4", largeBytes
        );

        assertThatThrownBy(() -> attachmentService.addAttachment(task.id(), largeFile, dev1.getEmail()))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("File size exceeds 10MB limit");
    }

    @Test
    @DisplayName("Attempt to upload an executable / disallowed file type -> clean 400 BadRequestException with clear message")
    void uploadExecutableFile_throwsCleanBadRequest() {
        MockMultipartFile exeFile = new MockMultipartFile(
                "file", "virus_payload.exe", "application/x-msdownload", "binary bytes".getBytes()
        );

        assertThatThrownBy(() -> attachmentService.addAttachment(task.id(), exeFile, dev1.getEmail()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Disallowed executable/script file type: .exe");
    }

    @Test
    @DisplayName("Non-owner, non-uploader tries to delete someone else's attachment -> 403 Forbidden")
    void deleteByNonOwnerNonUploader_throwsForbidden() {
        when(attachmentStorageService.uploadFile(any()))
                .thenReturn("https://res.cloudinary.com/test_cloud/image/upload/doc.pdf");

        MockMultipartFile file = new MockMultipartFile(
                "file", "specs.pdf", "application/pdf", "pdf content".getBytes()
        );

        AttachmentResponse uploaded = attachmentService.addAttachment(task.id(), file, dev1.getEmail());

        // dev2 is a Member, neither the uploader (dev1) nor the project owner (owner)
        assertThatThrownBy(() -> attachmentService.deleteAttachment(uploaded.id(), dev2.getEmail()))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Only the uploader or project owner can delete this attachment");

        // Now verify project owner CAN delete it
        attachmentService.deleteAttachment(uploaded.id(), owner.getEmail());

        List<AttachmentResponse> afterDelete = attachmentService.getAttachments(task.id());
        assertThat(afterDelete).isEmpty();
    }
}
