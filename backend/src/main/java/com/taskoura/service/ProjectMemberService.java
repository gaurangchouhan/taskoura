package com.taskoura.service;

import com.taskoura.dto.ProjectMemberDtos.*;
import com.taskoura.entity.Project;
import com.taskoura.entity.ProjectMember;
import com.taskoura.entity.User;
import com.taskoura.exception.ConflictException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.ProjectMemberRepository;
import com.taskoura.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@Transactional
public class ProjectMemberService {

    private static final Logger log = LoggerFactory.getLogger(ProjectMemberService.class);

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
                .orElseThrow(() -> new NotFoundException("No user found with this email"));

        if (projectMemberRepository.existsByProjectIdAndUserId(projectId, user.getId())) {
            throw new ConflictException("User is already a member of this project");
        }

        ProjectMember member = ProjectMember.builder()
                .project(project)
                .user(user)
                .role(request.role() != null ? request.role() : "Member")
                .build();

        ProjectMember saved = projectMemberRepository.save(member);
        ProjectMemberResponse response = toResponse(saved);

        // Schedule notification and email AFTER transaction commits (best-effort)
        Runnable postCommitAction = () -> dispatchPostInviteActions(project, user, saved.getRole());
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    postCommitAction.run();
                }
            });
        } else {
            postCommitAction.run();
        }

        return response;
    }

    private void dispatchPostInviteActions(Project project, User user, String role) {
        // Notification & activity log: best effort
        try {
            String userName = user.getName() != null && !user.getName().isBlank() ? user.getName().trim() : user.getEmail();
            String projName = project.getName() != null ? project.getName() : "Project";
            String desc = userName + " was invited to project \"" + projName + "\" as " + role;
            if (desc.length() > 250) {
                desc = desc.substring(0, 247) + "...";
            }
            notificationService.logActivity(project, user, "MEMBER_INVITED", desc);

            String notifMsg = "You have been invited to project \"" + projName + "\" as " + role;
            if (notifMsg.length() > 250) {
                notifMsg = notifMsg.substring(0, 247) + "...";
            }
            notificationService.createNotification(user, notifMsg);
        } catch (Exception e) {
            log.error("Failed to record invite notification/activity log: {}", e.getMessage());
        }

        // Email notification: best effort, logged without secrets
        if (emailService != null) {
            try {
                String inviterName = "Team Lead";
                if (project.getOwner() != null && project.getOwner().getName() != null && !project.getOwner().getName().isBlank()) {
                    inviterName = project.getOwner().getName().trim();
                }
                emailService.sendProjectInviteEmail(user, inviterName, project.getName(), project.getId(), role);
            } catch (Exception e) {
                log.error("Failed to deliver project invite email: {}", e.getMessage());
            }
        }
    }

    public List<ProjectMemberResponse> getMembers(UUID projectId) {
        Project project = projectService.getProjectEntityOrThrow(projectId);

        List<ProjectMember> members = projectMemberRepository.findByProjectId(projectId);

        boolean ownerFound = false;
        if (project.getOwner() != null) {
            ownerFound = members.stream()
                    .anyMatch(m -> m.getUser() != null && m.getUser().getId().equals(project.getOwner().getId()));

            if (!ownerFound) {
                // Auto-heal in database if missing
                ProjectMember ownerMember = ProjectMember.builder()
                        .project(project)
                        .user(project.getOwner())
                        .role("Owner")
                        .build();
                try {
                    ProjectMember saved = projectMemberRepository.save(ownerMember);
                    if (saved != null) {
                        ownerMember = saved;
                    }
                } catch (Exception e) {
                    log.warn("Failed to persist auto-healed owner membership: {}", e.getMessage());
                }
                members = new ArrayList<>(members);
                members.add(0, ownerMember);
                ownerFound = true;
            }
        }

        List<ProjectMemberResponse> responses = new ArrayList<>(members.stream()
                .filter(Objects::nonNull)
                .map(this::toResponse)
                .filter(Objects::nonNull)
                .toList());

        // Fail-safe: If the project has an owner and for any reason responses does not contain Owner,
        // ALWAYS prepend an Owner response so the members list ALWAYS includes the project owner!
        if (project.getOwner() != null && responses.stream().noneMatch(r -> r.userId().equals(project.getOwner().getId()))) {
            responses.add(0, new ProjectMemberResponse(
                    UUID.randomUUID(),
                    project.getOwner().getId(),
                    project.getOwner().getName(),
                    project.getOwner().getEmail(),
                    "Owner",
                    null
            ));
        }

        return responses;
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
