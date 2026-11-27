package com.taskoura.service;

import com.taskoura.dto.ProjectMemberDtos.*;
import com.taskoura.dto.UserAvatarProjection;
import com.taskoura.entity.Project;
import com.taskoura.entity.ProjectMember;
import com.taskoura.entity.User;
import com.taskoura.exception.ConflictException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.ProjectMemberRepository;
import com.taskoura.repository.UserProfileRepository;
import com.taskoura.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class ProjectMemberService {

    private static final Logger log = LoggerFactory.getLogger(ProjectMemberService.class);

    private final ProjectMemberRepository projectMemberRepository;
    private final UserRepository userRepository;
    private final ProjectService projectService;
    private final NotificationService notificationService;
    private final UserProfileRepository userProfileRepository;
    private final EmailService emailService;
    private final com.taskoura.repository.DocumentAccessRequestRepository documentAccessRequestRepository;

    public ProjectMemberService(ProjectMemberRepository projectMemberRepository,
                                UserRepository userRepository,
                                ProjectService projectService,
                                NotificationService notificationService,
                                @Autowired(required = false) UserProfileRepository userProfileRepository,
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
        projectMemberRepository.flush();

        String avatarUrl = getAvatarUrl(user.getId());
        ProjectMemberResponse response = new ProjectMemberResponse(
                saved.getId(),
                user.getId(),
                user.getName(),
                user.getEmail(),
                saved.getRole(),
                avatarUrl
        );

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
        } catch (Throwable e) {
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
            } catch (Throwable e) {
                log.error("Failed to deliver project invite email: {}", e.getMessage());
            }
        }
    }

    @Transactional(readOnly = true)
    public List<ProjectMemberResponse> getMembers(UUID projectId) {
        Project project = projectService.getProjectEntityOrThrow(projectId);

        List<ProjectMember> members = projectMemberRepository.findByProjectId(projectId);

        // Gather all user IDs to batch-fetch avatars in a single targeted projection query
        Set<UUID> userIds = new HashSet<>();
        if (members != null) {
            for (ProjectMember pm : members) {
                if (pm != null && pm.getUser() != null && pm.getUser().getId() != null) {
                    userIds.add(pm.getUser().getId());
                }
            }
        }
        if (project.getOwner() != null && project.getOwner().getId() != null) {
            userIds.add(project.getOwner().getId());
        }

        Map<UUID, String> avatarMap = Collections.emptyMap();
        if (!userIds.isEmpty() && userProfileRepository != null) {
            List<UserAvatarProjection> avatars = userProfileRepository.findAvatarsByUserIds(userIds);
            if (avatars != null) {
                avatarMap = avatars.stream()
                        .filter(p -> p != null && p.getUserId() != null)
                        .collect(Collectors.toMap(
                                UserAvatarProjection::getUserId,
                                p -> p.getAvatarUrl() != null ? p.getAvatarUrl() : "",
                                (existing, replacement) -> existing
                        ));
            }
        }

        List<ProjectMemberResponse> responses = new ArrayList<>();
        boolean ownerPresent = false;
        UUID ownerId = project.getOwner() != null ? project.getOwner().getId() : null;

        if (members != null) {
            for (ProjectMember pm : members) {
                if (pm == null || pm.getUser() == null || pm.getUser().getId() == null) continue;
                UUID uid = pm.getUser().getId();
                if (ownerId != null && ownerId.equals(uid)) {
                    ownerPresent = true;
                }
                String avatarUrl = avatarMap.get(uid);
                if (avatarUrl != null && avatarUrl.isBlank()) avatarUrl = null;

                responses.add(new ProjectMemberResponse(
                        pm.getId(),
                        uid,
                        pm.getUser().getName(),
                        pm.getUser().getEmail(),
                        pm.getRole(),
                        avatarUrl
                ));
            }
        }

        // If the project owner is missing from project_members (legacy projects), synthesize in memory:
        // ZERO database writes during GET, exactly once, correct role, and no double-counting.
        if (!ownerPresent && project.getOwner() != null) {
            User owner = project.getOwner();
            String avatarUrl = avatarMap.get(owner.getId());
            if (avatarUrl != null && avatarUrl.isBlank()) avatarUrl = null;

            responses.add(0, new ProjectMemberResponse(
                    null,
                    owner.getId(),
                    owner.getName(),
                    owner.getEmail(),
                    "Owner",
                    avatarUrl
            ));
        }

        return responses;
    }

    public ProjectMemberResponse updateRole(UUID projectId, UUID userId, UpdateRoleRequest request) {
        ProjectMember member = projectMemberRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new NotFoundException("Membership not found"));

        member.setRole(request.role());
        ProjectMember saved = projectMemberRepository.save(member);
        projectMemberRepository.flush();

        String avatarUrl = getAvatarUrl(userId);
        return new ProjectMemberResponse(
                saved.getId(),
                member.getUser().getId(),
                member.getUser().getName(),
                member.getUser().getEmail(),
                saved.getRole(),
                avatarUrl
        );
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

    private String getAvatarUrl(UUID userId) {
        if (userProfileRepository != null && userId != null) {
            return userProfileRepository.findAvatarUrlByUserId(userId).orElse(null);
        }
        return null;
    }
}
