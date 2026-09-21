package com.taskoura.service;

import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.entity.Project;
import com.taskoura.entity.User;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.ProjectMemberRepository;
import com.taskoura.repository.ProjectRepository;
import com.taskoura.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @InjectMocks
    private ProjectService projectService;

    private User owner;
    private UUID ownerId;

    @BeforeEach
    void setUp() {
        ownerId = UUID.randomUUID();
        owner = User.builder()
                .id(ownerId)
                .name("Alex Doe")
                .email("alex@example.com")
                .verified(true)
                .build();
    }

    @Test
    @DisplayName("createProject: creates and returns ProjectResponse with matching ownerId")
    void createProject_success() {
        LocalDate deadline = LocalDate.now().plusMonths(1);
        CreateProjectRequest request = new CreateProjectRequest(
                "Taskoura App",
                "Agile PM tool",
                "React",
                "Spring Boot",
                "PostgreSQL",
                "JUnit 5",
                deadline
        );

        UUID projectId = UUID.randomUUID();
        Project savedProject = Project.builder()
                .id(projectId)
                .name(request.name())
                .description(request.description())
                .frontendStack(request.frontendStack())
                .backendStack(request.backendStack())
                .databaseStack(request.databaseStack())
                .testingStack(request.testingStack())
                .owner(owner)
                .deadline(deadline)
                .createdAt(LocalDateTime.now())
                .build();

        when(userRepository.findByEmail("alex@example.com")).thenReturn(Optional.of(owner));
        when(projectRepository.save(any(Project.class))).thenReturn(savedProject);

        ProjectResponse response = projectService.createProject("alex@example.com", request);

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo(projectId);
        assertThat(response.name()).isEqualTo("Taskoura App");
        assertThat(response.description()).isEqualTo("Agile PM tool");
        assertThat(response.ownerId()).isEqualTo(ownerId);
        assertThat(response.deadline()).isEqualTo(deadline);

        verify(userRepository).findByEmail("alex@example.com");
        verify(projectRepository).save(any(Project.class));
        verify(projectMemberRepository).save(argThat(m -> m.getRole().equals("Owner") && m.getUser().equals(owner)));
    }

    @Test
    @DisplayName("createProject: throws NotFoundException when user does not exist")
    void createProject_userNotFound_throwsNotFound() {
        CreateProjectRequest request = new CreateProjectRequest(
                "Taskoura App", "Desc", "React", "Spring", "PG", "JUnit", LocalDate.now()
        );

        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> projectService.createProject("unknown@example.com", request))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("User not found");

        verify(projectRepository, never()).save(any());
    }

    @Test
    @DisplayName("getProjectsForUser: returns only projects owned by user")
    void getProjectsForUser_success() {
        Project proj1 = Project.builder()
                .id(UUID.randomUUID())
                .name("Project 1")
                .description("Desc 1")
                .owner(owner)
                .deadline(LocalDate.now().plusDays(10))
                .build();
        Project proj2 = Project.builder()
                .id(UUID.randomUUID())
                .name("Project 2")
                .description("Desc 2")
                .owner(owner)
                .deadline(LocalDate.now().plusDays(20))
                .build();

        when(userRepository.findByEmail("alex@example.com")).thenReturn(Optional.of(owner));
        when(projectRepository.findByOwnerId(ownerId)).thenReturn(List.of(proj1, proj2));

        List<ProjectResponse> responses = projectService.getProjectsForUser("alex@example.com");

        assertThat(responses).hasSize(2);
        assertThat(responses.get(0).name()).isEqualTo("Project 1");
        assertThat(responses.get(0).ownerId()).isEqualTo(ownerId);
        assertThat(responses.get(1).name()).isEqualTo("Project 2");
        assertThat(responses.get(1).ownerId()).isEqualTo(ownerId);
    }

    @Test
    @DisplayName("getProjectsForUser: throws NotFoundException when user does not exist")
    void getProjectsForUser_userNotFound_throwsNotFound() {
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> projectService.getProjectsForUser("unknown@example.com"))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("User not found");
    }

    @Test
    @DisplayName("getProjectEntityOrThrow: returns project when found")
    void getProjectEntityOrThrow_success() {
        UUID projectId = UUID.randomUUID();
        Project project = Project.builder().id(projectId).name("Test").owner(owner).build();
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));

        Project result = projectService.getProjectEntityOrThrow(projectId);

        assertThat(result).isSameAs(project);
    }

    @Test
    @DisplayName("getProjectEntityOrThrow: throws NotFoundException when not found")
    void getProjectEntityOrThrow_notFound() {
        UUID projectId = UUID.randomUUID();
        when(projectRepository.findById(projectId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> projectService.getProjectEntityOrThrow(projectId))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Project not found");
    }
}
