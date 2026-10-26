package com.taskoura.service;

import com.taskoura.entity.Project;
import com.taskoura.entity.ProjectMember;
import com.taskoura.entity.Task;
import com.taskoura.entity.User;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.ProjectMemberRepository;
import com.taskoura.repository.ProjectRepository;
import com.taskoura.repository.TaskRepository;
import com.taskoura.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectAccessServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @InjectMocks
    private ProjectAccessService projectAccessService;

    private User ownerUser;
    private User memberUser;
    private User outsiderUser;
    private Project project;
    private UUID projectId;

    @BeforeEach
    void setUp() {
        projectId = UUID.randomUUID();

        ownerUser = User.builder()
                .id(UUID.randomUUID())
                .name("Alice Owner")
                .email("alice@taskoura.com")
                .build();

        memberUser = User.builder()
                .id(UUID.randomUUID())
                .name("Bob Member")
                .email("bob@taskoura.com")
                .build();

        outsiderUser = User.builder()
                .id(UUID.randomUUID())
                .name("Charlie Outsider")
                .email("charlie@taskoura.com")
                .build();

        project = Project.builder()
                .id(projectId)
                .name("Alpha Project")
                .owner(ownerUser)
                .build();
    }

    @Test
    @DisplayName("requireMember succeeds for project owner")
    void requireMember_owner_succeeds() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findByEmail("alice@taskoura.com")).thenReturn(Optional.of(ownerUser));

        Project result = projectAccessService.requireMember(projectId, "alice@taskoura.com");

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(projectId);
    }

    @Test
    @DisplayName("requireMember succeeds for project member")
    void requireMember_member_succeeds() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findByEmail("bob@taskoura.com")).thenReturn(Optional.of(memberUser));
        ProjectMember pm = ProjectMember.builder()
                .project(project)
                .user(memberUser)
                .role("Member")
                .build();
        when(projectMemberRepository.findByProjectIdAndUserId(projectId, memberUser.getId()))
                .thenReturn(Optional.of(pm));

        Project result = projectAccessService.requireMember(projectId, "bob@taskoura.com");

        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("requireMember succeeds for old project owner with NO ProjectMember row")
    void requireMember_oldProjectOwnerWithoutMemberRow_succeeds() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findByEmail("alice@taskoura.com")).thenReturn(Optional.of(ownerUser));

        Project result = projectAccessService.requireMember(projectId, "alice@taskoura.com");

        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("requireMember throws 403 Forbidden for outsider")
    void requireMember_outsider_throws403() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findByEmail("charlie@taskoura.com")).thenReturn(Optional.of(outsiderUser));
        when(projectMemberRepository.findByProjectIdAndUserId(projectId, outsiderUser.getId()))
                .thenReturn(Optional.empty());

        assertThrows(ForbiddenException.class, () ->
                projectAccessService.requireMember(projectId, "charlie@taskoura.com"));
    }

    @Test
    @DisplayName("requireMember throws 404 Not Found for unknown project")
    void requireMember_unknownProject_throws404() {
        UUID unknownId = UUID.randomUUID();
        when(projectRepository.findById(unknownId)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () ->
                projectAccessService.requireMember(unknownId, "alice@taskoura.com"));
    }

    @Test
    @DisplayName("requireOwner succeeds for direct project owner")
    void requireOwner_directOwner_succeeds() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findByEmail("alice@taskoura.com")).thenReturn(Optional.of(ownerUser));

        Project result = projectAccessService.requireOwner(projectId, "alice@taskoura.com");

        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("requireOwner succeeds for old project owner without ProjectMember row")
    void requireOwner_oldProjectOwnerWithoutMemberRow_succeeds() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findByEmail("alice@taskoura.com")).thenReturn(Optional.of(ownerUser));

        Project result = projectAccessService.requireOwner(projectId, "alice@taskoura.com");

        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("requireOwner throws 403 Forbidden for regular member")
    void requireOwner_regularMember_throws403() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findByEmail("bob@taskoura.com")).thenReturn(Optional.of(memberUser));
        ProjectMember pm = ProjectMember.builder()
                .project(project)
                .user(memberUser)
                .role("Member")
                .build();
        when(projectMemberRepository.findByProjectIdAndUserId(projectId, memberUser.getId()))
                .thenReturn(Optional.of(pm));

        assertThrows(ForbiddenException.class, () ->
                projectAccessService.requireOwner(projectId, "bob@taskoura.com"));
    }

    @Test
    @DisplayName("requireOwner throws 403 Forbidden for outsider")
    void requireOwner_outsider_throws403() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findByEmail("charlie@taskoura.com")).thenReturn(Optional.of(outsiderUser));
        when(projectMemberRepository.findByProjectIdAndUserId(projectId, outsiderUser.getId()))
                .thenReturn(Optional.empty());

        assertThrows(ForbiddenException.class, () ->
                projectAccessService.requireOwner(projectId, "charlie@taskoura.com"));
    }

    @Test
    @DisplayName("requireTaskAccess resolves task's project and verifies membership")
    void requireTaskAccess_member_succeeds() {
        UUID taskId = UUID.randomUUID();
        Task task = Task.builder()
                .id(taskId)
                .project(project)
                .title("Database setup")
                .build();

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findByEmail("bob@taskoura.com")).thenReturn(Optional.of(memberUser));
        ProjectMember pm = ProjectMember.builder()
                .project(project)
                .user(memberUser)
                .role("Member")
                .build();
        when(projectMemberRepository.findByProjectIdAndUserId(projectId, memberUser.getId()))
                .thenReturn(Optional.of(pm));

        Task result = projectAccessService.requireTaskAccess(taskId, "bob@taskoura.com");

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(taskId);
    }

    @Test
    @DisplayName("requireTaskAccess throws 404 for unknown task")
    void requireTaskAccess_unknownTask_throws404() {
        UUID unknownTaskId = UUID.randomUUID();
        when(taskRepository.findById(unknownTaskId)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () ->
                projectAccessService.requireTaskAccess(unknownTaskId, "alice@taskoura.com"));
    }

    @Test
    @DisplayName("requireTaskAccess throws 403 for outsider")
    void requireTaskAccess_outsider_throws403() {
        UUID taskId = UUID.randomUUID();
        Task task = Task.builder()
                .id(taskId)
                .project(project)
                .title("Database setup")
                .build();

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findByEmail("charlie@taskoura.com")).thenReturn(Optional.of(outsiderUser));
        when(projectMemberRepository.findByProjectIdAndUserId(projectId, outsiderUser.getId()))
                .thenReturn(Optional.empty());

        assertThrows(ForbiddenException.class, () ->
                projectAccessService.requireTaskAccess(taskId, "charlie@taskoura.com"));
    }

    @Test
    @DisplayName("Role lookup returns Owner for owner (including old project) and Member for member, null for outsider")
    void roleLookup_returnsCorrectRoles() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findByEmail("alice@taskoura.com")).thenReturn(Optional.of(ownerUser));
        when(userRepository.findByEmail("bob@taskoura.com")).thenReturn(Optional.of(memberUser));
        when(userRepository.findByEmail("charlie@taskoura.com")).thenReturn(Optional.of(outsiderUser));

        ProjectMember pm = ProjectMember.builder().project(project).user(memberUser).role("Member").build();
        when(projectMemberRepository.findByProjectIdAndUserId(projectId, memberUser.getId())).thenReturn(Optional.of(pm));
        when(projectMemberRepository.findByProjectIdAndUserId(projectId, outsiderUser.getId())).thenReturn(Optional.empty());

        assertThat(projectAccessService.getRole(projectId, "alice@taskoura.com")).isEqualTo("Owner");
        assertThat(projectAccessService.findRole(projectId, "alice@taskoura.com")).contains("Owner");

        assertThat(projectAccessService.getRole(projectId, "bob@taskoura.com")).isEqualTo("Member");
        assertThat(projectAccessService.findRole(projectId, "bob@taskoura.com")).contains("Member");

        assertThat(projectAccessService.getRole(projectId, "charlie@taskoura.com")).isNull();
        assertThat(projectAccessService.findRole(projectId, "charlie@taskoura.com")).isEmpty();
    }
}
