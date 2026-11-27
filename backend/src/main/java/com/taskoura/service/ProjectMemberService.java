package com.taskoura.service;

import com.taskoura.dto.ProjectMemberDtos.*;
import com.taskoura.entity.Project;
import com.taskoura.entity.ProjectMember;
import com.taskoura.entity.User;
import com.taskoura.exception.ConflictException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.ProjectMemberRepository;
import com.taskoura.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class ProjectMemberService {

    private final ProjectMemberRepository projectMemberRepository;
    private final UserRepository userRepository;
    private final ProjectService projectService;
    private final NotificationService notificationService;
    private final com.taskoura.repository.UserProfileRepository userProfileRepository;
    private final EmailService emailService;
    private final com.taskoura.repository.DocumentAccessRequestRepository documentAccessRequestRepository;

    public ProjectMemberService(ProjectMemberRepository projectMemberRepository,
                                UserRepository userRepository,
                                ProjectService projectService,
                                NotificationService notificationService,
                                @Autowired(required = false) com.taskoura.repository.UserProfileRepository userProfileRepository,
                                @Autowired(required = false) EmailService emailService,
                                @Autowired(required = false) com.taskoura.repository.DocumentAccessRequestRepository documentAccessRequestRepository) {
        this.projectMemberRepository = projectMemberRepository;
        this.userRepository = userRepository;
        this.projectService = projectService;
        this.notificationService = notificationService;
        this.userProfileRepository = userProfileRepository;
        this.emailService = emailService;
        this.documentAccessRequestRepository = documentAccessRequestRepository;
    }

    public ProjectMemberResponse inviteMember(UUID projectId, InviteMemberRequest request) {
        Project project = projectService.getProjectEntityOrThrow(projectId);

        String email = request.email() != null ? request.email().trim() : "";
        User user = userRepository.findByEmailIgnoreCase(email)
                .or(() -> userRepository.findByEmail(email))
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

        // Safe activity log & notification (non-blocking)
        try {
            String userName = user.getName() != null && !user.getName().isBlank() ? user.getName().trim() : user.getEmail();
            String projName = project.getName() != null ? project.getName() : "Project";
            String desc = userName + " was invited to project \"" + projName + "\" as " + saved.getRole();
            if (desc.length() > 250) {
                desc = desc.substring(0, 247) + "...";
            }
            notificationService.logActivity(project, user, "MEMBER_INVITED", desc);

            String notifMsg = "You have been invited to project \"" + projName + "\" as " + saved.getRole();
            if (notifMsg.length() > 250) {
                notifMsg = notifMsg.substring(0, 247) + "...";
            }
            notificationService.createNotification(user, notifMsg);
        } catch (Exception e) {
            // Log but don't fail member addition
        }

        if (emailService != null) {
            try {
                String inviterName = "Team Lead";
                if (project.getOwner() != null && project.getOwner().getName() != null && !project.getOwner().getName().isBlank()) {
                    inviterName = project.getOwner().getName().trim();
                }
                emailService.sendProjectInviteEmail(user, inviterName, project.getName(), project.getId(), saved.getRole());
            } catch (Exception ignored) {
            }
        }

        return toResponse(saved);
    }

    public List<ProjectMemberResponse> getMembers(UUID projectId) {
        // Ensure project exists or throws NotFoundException
        Project project = projectService.getProjectEntityOrThrow(projectId);

        List<ProjectMember> members = projectMemberRepository.findByProjectId(projectId);

        // Auto-heal: Ensure project owner is recorded as a ProjectMember with role Owner
        if (project.getOwner() != null) {
            boolean ownerPresent = members.stream()
                    .anyMatch(m -> m.getUser() != null && m.getUser().getId().equals(project.getOwner().getId()));
            if (!ownerPresent) {
                ProjectMember ownerMember = ProjectMember.builder()
                        .project(project)
                        .user(project.getOwner())
                        .role("Owner")
                        .build();
                try {
                    ownerMember = projectMemberRepository.save(ownerMember);
                } catch (Exception ignored) {
                }
                members = new java.util.ArrayList<>(members);
                members.add(0, ownerMember);
            }
        }

        return members.stream()
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
        projectMemberRepository.flush();

        if (documentAccessRequestRepository != null) {
            documentAccessRequestRepository.revokeOpenRequestsForProjectAndUser(projectId, userId);
        }
    }

    private ProjectMemberResponse toResponse(ProjectMember member) {
        String avatarUrl = null;
        if (userProfileRepository != null && member.getUser() != null && member.getUser().getId() != null) {
            avatarUrl = userProfileRepository.findById(member.getUser().getId())
                    .map(com.taskoura.entity.UserProfile::getAvatarUrl)
                    .orElse(null);
        }
        return new ProjectMemberResponse(
                member.getId(),
                member.getUser().getId(),
                member.getUser().getName(),
                member.getUser().getEmail(),
                member.getRole(),
                avatarUrl
        );
    }
}
