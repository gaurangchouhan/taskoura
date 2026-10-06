package com.taskoura.service;

import com.taskoura.dto.ProjectDtos.*;
import com.taskoura.entity.Project;
import com.taskoura.entity.ProjectMember;
import com.taskoura.entity.User;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.ProjectMemberRepository;
import com.taskoura.repository.ProjectRepository;
import com.taskoura.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;

    public ProjectService(ProjectRepository projectRepository,
                          UserRepository userRepository,
                          ProjectMemberRepository projectMemberRepository) {
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.projectMemberRepository = projectMemberRepository;
    }

    public ProjectResponse createProject(String ownerEmail, CreateProjectRequest request) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new NotFoundException("User not found"));

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

        ProjectMember ownerMember = ProjectMember.builder()
                .project(saved)
                .user(owner)
                .role("Owner")
                .build();
        projectMemberRepository.save(ownerMember);

        return toResponse(saved);
    }

    public List<ProjectResponse> getProjectsForUser(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new NotFoundException("User not found"));

        Set<UUID> seenIds = new HashSet<>();
        List<ProjectResponse> result = new ArrayList<>();

        for (Project p : projectRepository.findByOwnerId(user.getId())) {
            if (seenIds.add(p.getId())) {
                result.add(toResponse(p));
            }
        }

        for (ProjectMember pm : projectMemberRepository.findByUserId(user.getId())) {
            Project p = pm.getProject();
            if (p != null && seenIds.add(p.getId())) {
                result.add(toResponse(p));
            }
        }

        return result;
    }

    public ProjectResponse getProjectById(UUID projectId, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new NotFoundException("User not found"));

        Project project = getProjectEntityOrThrow(projectId);

        boolean isOwner = project.getOwner().getId().equals(user.getId());
        boolean isMember = projectMemberRepository.existsByProjectIdAndUserId(projectId, user.getId());

        if (!isOwner && !isMember) {
            throw new ForbiddenException("You do not have access to this project");
        }

        return toResponse(project);
    }

    public Project getProjectEntityOrThrow(UUID projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new NotFoundException("Project not found"));
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