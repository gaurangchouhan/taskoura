package com.taskoura.service;

import com.taskoura.dto.ProjectMemberDtos.InviteMemberRequest;
import com.taskoura.dto.ProjectMemberDtos.ProjectMemberResponse;
import com.taskoura.dto.ProjectMemberDtos.UpdateRoleRequest;
import com.taskoura.entity.Project;
import com.taskoura.entity.ProjectMember;
import com.taskoura.entity.User;
import com.taskoura.exception.ConflictException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.ProjectMemberRepository;
import com.taskoura.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProjectMemberServiceTest {

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectService projectService;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private ProjectMemberService projectMemberService;

    private UUID projectId;
    private Project sampleProject;
    private User sampleUser;

    @BeforeEach
    void setUp() {
        projectId = UUID.randomUUID();
        sampleProject = Project.builder().id(projectId).name("Sample Project").build();
        sampleUser = User.builder().id(UUID.randomUUID()).name("Jane Doe").email("jane@example.com").build();
    }

    @Test
    @DisplayName("inviteMember: successfully invites registered user with specified role")
    void inviteMember_success() {
        InviteMemberRequest request = new InviteMemberRequest("jane@example.com", "Member");
        ProjectMember savedMember = ProjectMember.builder()
                .id(UUID.randomUUID())
                .project(sampleProject)
                .user(sampleUser)
                .role("Member")
                .build();

        when(projectService.getProjectEntityOrThrow(projectId)).thenReturn(sampleProject);
        when(userRepository.findByEmail("jane@example.com")).thenReturn(Optional.of(sampleUser));
        when(projectMemberRepository.existsByProjectIdAndUserId(projectId, sampleUser.getId())).thenReturn(false);
        when(projectMemberRepository.save(any(ProjectMember.class))).thenReturn(savedMember);

        ProjectMemberResponse response = projectMemberService.inviteMember(projectId, request);

        assertThat(response).isNotNull();
        assertThat(response.userEmail()).isEqualTo("jane@example.com");
        assertThat(response.userName()).isEqualTo("Jane Doe");
        assertThat(response.role()).isEqualTo("Member");
        verify(projectMemberRepository).save(any(ProjectMember.class));
    }

    @Test
    @DisplayName("inviteMember: throws NotFoundException when email is not registered")
    void inviteMember_userNotFound_throwsNotFound() {
        InviteMemberRequest request = new InviteMemberRequest("nonexistent@example.com", "Member");

        when(projectService.getProjectEntityOrThrow(projectId)).thenReturn(sampleProject);
        when(userRepository.findByEmail("nonexistent@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> projectMemberService.inviteMember(projectId, request))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("User with this email not found");

        verify(projectMemberRepository, never()).save(any());
    }

    @Test
    @DisplayName("inviteMember: throws ConflictException when user is already a member")
    void inviteMember_alreadyMember_throwsConflict() {
        InviteMemberRequest request = new InviteMemberRequest("jane@example.com", "Member");

        when(projectService.getProjectEntityOrThrow(projectId)).thenReturn(sampleProject);
        when(userRepository.findByEmail("jane@example.com")).thenReturn(Optional.of(sampleUser));
        when(projectMemberRepository.existsByProjectIdAndUserId(projectId, sampleUser.getId())).thenReturn(true);

        assertThatThrownBy(() -> projectMemberService.inviteMember(projectId, request))
                .isInstanceOf(ConflictException.class)
                .hasMessage("User is already a member of this project");

        verify(projectMemberRepository, never()).save(any());
    }

    @Test
    @DisplayName("getMembers: returns list of ProjectMemberResponse")
    void getMembers_success() {
        ProjectMember member = ProjectMember.builder()
                .id(UUID.randomUUID())
                .project(sampleProject)
                .user(sampleUser)
                .role("Owner")
                .build();

        when(projectService.getProjectEntityOrThrow(projectId)).thenReturn(sampleProject);
        when(projectMemberRepository.findByProjectId(projectId)).thenReturn(List.of(member));

        List<ProjectMemberResponse> responses = projectMemberService.getMembers(projectId);

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).role()).isEqualTo("Owner");
        assertThat(responses.get(0).userEmail()).isEqualTo("jane@example.com");
    }

    @Test
    @DisplayName("updateRole: updates role and returns updated response")
    void updateRole_success() {
        UUID userId = sampleUser.getId();
        UpdateRoleRequest request = new UpdateRoleRequest("Owner");
        ProjectMember member = ProjectMember.builder()
                .id(UUID.randomUUID())
                .project(sampleProject)
                .user(sampleUser)
                .role("Member")
                .build();

        when(projectMemberRepository.findByProjectIdAndUserId(projectId, userId)).thenReturn(Optional.of(member));
        when(projectMemberRepository.save(any(ProjectMember.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ProjectMemberResponse response = projectMemberService.updateRole(projectId, userId, request);

        assertThat(response.role()).isEqualTo("Owner");
        verify(projectMemberRepository).save(member);
    }

    @Test
    @DisplayName("updateRole: throws NotFoundException when membership does not exist")
    void updateRole_notFound() {
        UUID userId = UUID.randomUUID();
        UpdateRoleRequest request = new UpdateRoleRequest("Owner");

        when(projectMemberRepository.findByProjectIdAndUserId(projectId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> projectMemberService.updateRole(projectId, userId, request))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Membership not found");
    }

    @Test
    @DisplayName("removeMember: deletes member from repository")
    void removeMember_success() {
        UUID userId = sampleUser.getId();
        ProjectMember member = ProjectMember.builder()
                .id(UUID.randomUUID())
                .project(sampleProject)
                .user(sampleUser)
                .role("Member")
                .build();

        when(projectMemberRepository.findByProjectIdAndUserId(projectId, userId)).thenReturn(Optional.of(member));

        projectMemberService.removeMember(projectId, userId);

        verify(projectMemberRepository).delete(member);
    }

    @Test
    @DisplayName("removeMember: throws NotFoundException when membership does not exist")
    void removeMember_notFound() {
        UUID userId = UUID.randomUUID();

        when(projectMemberRepository.findByProjectIdAndUserId(projectId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> projectMemberService.removeMember(projectId, userId))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Membership not found");
    }
}
