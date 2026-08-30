package com.taskoura.service;

import com.taskoura.dto.ProjectDtos.*;
import com.taskoura.entity.Project;
import com.taskoura.entity.User;
import com.taskoura.repository.ProjectRepository;
import com.taskoura.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;

    public ProjectService(ProjectRepository projectRepository, UserRepository userRepository) {
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
    }

    public ProjectResponse createProject(String ownerEmail, CreateProjectRequest request) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new IllegalStateException("User not found"));

        Project project = Project.builder()
                .name(request.name())
                .description(request.description())
                .frontendStack(request.frontendStack())
                .backendStack(request.backendStack())
                .databaseStack(request.databaseStack())
                .testingStack(request.testingStack())
                .owner(owner)
                .deadline(request.deadline())
                .build();

        Project saved = projectRepository.save(project);
        return toResponse(saved);
    }

    public List<ProjectResponse> getProjectsForUser(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new IllegalStateException("User not found"));

        return projectRepository.findByOwnerId(user.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public Project getProjectEntityOrThrow(UUID projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalStateException("Project not found"));
    }

    private ProjectResponse toResponse(Project project) {
        return new ProjectResponse(
                project.getId(),
                project.getName(),
                project.getDescription(),
                project.getOwner().getId(),
                project.getDeadline()
        );
    }
}
