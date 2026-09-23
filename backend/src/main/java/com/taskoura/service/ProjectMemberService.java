package com.taskoura.service;

import com.taskoura.dto.ProjectMemberDtos.*;
import com.taskoura.entity.Project;
import com.taskoura.entity.ProjectMember;
import com.taskoura.entity.User;
import com.taskoura.exception.ConflictException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.ProjectMemberRepository;
import com.taskoura.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class ProjectMemberService {

    private final ProjectMemberRepository projectMemberRepository;
    private final UserRepository userRepository;
    private final ProjectService projectService;
    private final NotificationService notificationService;

    public ProjectMemberService(ProjectMemberRepository projectMemberRepository,
                                UserRepository userRepository,
                                ProjectService projectService,
                                NotificationService notificationService) {
        this.projectMemberRepository = projectMemberRepository;
        this.userRepository = userRepository;
        this.projectService = projectService;
        this.notificationService = notificationService;
    }

    public ProjectMemberResponse inviteMember(UUID projectId, InviteMemberRequest request) {
        Project project = projectService.getProjectEntityOrThrow(projectId);

        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new NotFoundException("User with this email not found"));

        if (projectMemberRepository.existsByProjectIdAndUserId(projectId, user.getId())) {
            throw new ConflictException("User is already a member of this project");
        }

        ProjectMember member = ProjectMember.builder()
                .project(project)
                .user(user)
                .role(request.role() != null ? request.role() : "Member")
                .build();

        ProjectMember saved = projectMemberRepository.save(member);

        // Log MEMBER_INVITED activity
        notificationService.logActivity(project, user,
                "MEMBER_INVITED",
                user.getName() + " was invited to project \"" + project.getName() + "\" as " + saved.getRole());

        return toResponse(saved);
    }

    public List<ProjectMemberResponse> getMembers(UUID projectId) {
        // Ensure project exists or throws NotFoundException
        projectService.getProjectEntityOrThrow(projectId);

        return projectMemberRepository.findByProjectId(projectId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public ProjectMemberResponse updateRole(UUID projectId, UUID userId, UpdateRoleRequest request) {
        ProjectMember member = projectMemberRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new NotFoundException("Membership not found"));

        member.setRole(request.role());
        ProjectMember saved = projectMemberRepository.save(member);
        return toResponse(saved);
    }

    public void removeMember(UUID projectId, UUID userId) {
        ProjectMember member = projectMemberRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new NotFoundException("Membership not found"));
        projectMemberRepository.delete(member);
    }

    private ProjectMemberResponse toResponse(ProjectMember member) {
        return new ProjectMemberResponse(
                member.getId(),
                member.getUser().getId(),
                member.getUser().getName(),
                member.getUser().getEmail(),
                member.getRole()
        );
    }
}