package com.taskoura.service;

import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.dto.ProjectMemberDtos.InviteMemberRequest;
import com.taskoura.dto.ProjectMemberDtos.ProjectMemberResponse;
import com.taskoura.dto.ProjectMemberDtos.UpdateRoleRequest;
import com.taskoura.entity.User;
import com.taskoura.exception.ConflictException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.ProjectMemberRepository;
import com.taskoura.repository.ProjectRepository;
import com.taskoura.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ProjectMembershipIntegrationTest {

    @Autowired
    private ProjectService projectService;

    @Autowired
    private ProjectMemberService projectMemberService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ProjectMemberRepository projectMemberRepository;

    private User ownerUser;
    private User invitedUser;

    @BeforeEach
    void setUp() {
        ownerUser = userRepository.save(User.builder()
                .name("Alice Owner")
                .email("alice-owner-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());

        invitedUser = userRepository.save(User.builder()
                .name("Bob Member")
                .email("bob-member-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());
    }

    @Test
    @DisplayName("End-to-End: project creation auto-assigns Owner, invite, role change, and removal work")
    void fullProjectMembershipLifecycle() {
        // 1. Create a new project -> owner is automatically added as "Owner"
        CreateProjectRequest createRequest = new CreateProjectRequest(
                "Membership Test App",
                "Full integration test",
                "React",
                "Spring Boot",
                "PostgreSQL",
                "JUnit 5",
                LocalDate.now().plusMonths(3)
        );

        ProjectResponse project = projectService.createProject(ownerUser.getEmail(), createRequest);
        assertThat(project).isNotNull();
        assertThat(project.ownerId()).isEqualTo(ownerUser.getId());

        // Immediately GET members -> confirm owner is listed with role "Owner"
        List<ProjectMemberResponse> initialMembers = projectMemberService.getMembers(project.id());
        assertThat(initialMembers).hasSize(1);
        assertThat(initialMembers.get(0).userEmail()).isEqualTo(ownerUser.getEmail());
        assertThat(initialMembers.get(0).userName()).isEqualTo("Alice Owner");
        assertThat(initialMembers.get(0).role()).isEqualTo("Owner");

        // 2. Invite a real, existing user -> succeeds with 201 response
        InviteMemberRequest inviteRequest = new InviteMemberRequest(invitedUser.getEmail(), "Member");
        ProjectMemberResponse invitedMember = projectMemberService.inviteMember(project.id(), inviteRequest);
        assertThat(invitedMember).isNotNull();
        assertThat(invitedMember.userEmail()).isEqualTo(invitedUser.getEmail());
        assertThat(invitedMember.role()).isEqualTo("Member");

        List<ProjectMemberResponse> membersAfterInvite = projectMemberService.getMembers(project.id());
        assertThat(membersAfterInvite).hasSize(2);

        // 3. Invite an email that isn't registered -> throws NotFoundException
        InviteMemberRequest unknownInvite = new InviteMemberRequest("ghost@example.com", "Member");
        assertThatThrownBy(() -> projectMemberService.inviteMember(project.id(), unknownInvite))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("User with this email not found");

        // 4. Invite the same user twice -> throws ConflictException
        assertThatThrownBy(() -> projectMemberService.inviteMember(project.id(), inviteRequest))
                .isInstanceOf(ConflictException.class)
                .hasMessage("User is already a member of this project");

        // Confirm still only 2 members
        assertThat(projectMemberService.getMembers(project.id())).hasSize(2);

        // 5. Change role to "Owner", then list members, confirm change persisted
        UpdateRoleRequest updateRole = new UpdateRoleRequest("Owner");
        projectMemberService.updateRole(project.id(), invitedUser.getId(), updateRole);

        List<ProjectMemberResponse> membersAfterRoleChange = projectMemberService.getMembers(project.id());
        ProjectMemberResponse updatedBob = membersAfterRoleChange.stream()
                .filter(m -> m.userId().equals(invitedUser.getId()))
                .findFirst()
                .orElseThrow();
        assertThat(updatedBob.role()).isEqualTo("Owner");

        // 6. Remove a member, then list members, confirm they are gone
        projectMemberService.removeMember(project.id(), invitedUser.getId());
        List<ProjectMemberResponse> membersAfterRemoval = projectMemberService.getMembers(project.id());
        assertThat(membersAfterRemoval).hasSize(1);
        assertThat(membersAfterRemoval.get(0).userEmail()).isEqualTo(ownerUser.getEmail());
    }
}
