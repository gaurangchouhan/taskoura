package com.taskoura.service;

import com.taskoura.config.BiolockProperties;
import com.taskoura.dto.AttachmentDtos.DocumentAccessRequestResponse;
import com.taskoura.dto.AttachmentDtos.DocumentAccessStateResponse;
import com.taskoura.entity.*;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.ConflictException;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.exception.RateLimitedException;
import com.taskoura.repository.*;
import com.taskoura.security.biolock.DeviceKeyService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class BioLockAccessService {

    private static final Logger log = LoggerFactory.getLogger(BioLockAccessService.class);

    private final AttachmentRepository attachmentRepository;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectBiometricSettingRepository projectBiometricSettingRepository;
    private final BiolockDeviceRepository biolockDeviceRepository;
    private final BiometricCredentialRepository biometricCredentialRepository;
    private final DocumentAccessRequestRepository documentAccessRequestRepository;
    private final BiolockJobRepository biolockJobRepository;
    private final DeviceKeyService deviceKeyService;
    private final EmailService emailService;
    private final NotificationService notificationService;
    private final BioLockAuditService auditService;
    private final BiolockProperties biolockProperties;
    private final Clock clock;

    public BioLockAccessService(
            AttachmentRepository attachmentRepository,
            UserRepository userRepository,
            ProjectMemberRepository projectMemberRepository,
            ProjectBiometricSettingRepository projectBiometricSettingRepository,
            BiolockDeviceRepository biolockDeviceRepository,
            BiometricCredentialRepository biometricCredentialRepository,
            DocumentAccessRequestRepository documentAccessRequestRepository,
            BiolockJobRepository biolockJobRepository,
            DeviceKeyService deviceKeyService,
            EmailService emailService,
            NotificationService notificationService,
            BioLockAuditService auditService,
            BiolockProperties biolockProperties,
            Clock clock
    ) {
        this.attachmentRepository = attachmentRepository;
        this.userRepository = userRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.projectBiometricSettingRepository = projectBiometricSettingRepository;
        this.biolockDeviceRepository = biolockDeviceRepository;
        this.biometricCredentialRepository = biometricCredentialRepository;
        this.documentAccessRequestRepository = documentAccessRequestRepository;
        this.biolockJobRepository = biolockJobRepository;
        this.deviceKeyService = deviceKeyService;
        this.emailService = emailService;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.biolockProperties = biolockProperties;
        this.clock = clock;
    }

    @Transactional
    public DocumentAccessRequestResponse requestAccess(String callerEmail, UUID attachmentId) {
        if (!biolockProperties.isEnabled()) {
            throw new BadRequestException("BIOLOCK_DISABLED", "Taskoura BioLock is disabled");
        }

        User requester = userRepository.findByEmail(callerEmail)
                .orElseThrow(() -> new NotFoundException("User not found"));

        Attachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new NotFoundException("Document not found"));

        if (!attachment.isRestricted()) {
            throw new BadRequestException("VALIDATION_FAILED", "Document is not restricted");
        }

        Task task = attachment.getTask();
        Project project = task != null ? task.getProject() : null;
        if (project == null) {
            throw new NotFoundException("Project not found");
        }

        boolean isOwner = project.getOwner() != null && project.getOwner().getId().equals(requester.getId());
        if (isOwner) {
            throw new BadRequestException("VALIDATION_FAILED", "Project owner has unconditional access");
        }

        boolean isMember = projectMemberRepository.findByProjectIdAndUserId(project.getId(), requester.getId()).isPresent();
        if (!isMember) {
            throw new ForbiddenException("FORBIDDEN", "Must be a project member to request access");
        }

        var settingOpt = projectBiometricSettingRepository.findByProjectId(project.getId());
        if (settingOpt.isEmpty() || !settingOpt.get().isEnabled()) {
            throw new BadRequestException("BIOLOCK_NOT_ENABLED", "BioLock is not enabled for this project");
        }

        User leader = project.getOwner();
        if (leader == null) {
            throw new BadRequestException("BIOLOCK_NO_DEVICE", "Project has no owner");
        }

        var deviceOpt = biolockDeviceRepository.findByOwnerUserIdAndStatus(leader.getId(), DeviceStatus.ACTIVE);
        if (deviceOpt.isEmpty()) {
            throw new BadRequestException("BIOLOCK_NO_DEVICE", "Leader has no active BioLock device");
        }
        BiolockDevice device = deviceOpt.get();

        var credOpt = biometricCredentialRepository.findByUserIdAndStatus(leader.getId(), CredentialStatus.ACTIVE);
        if (credOpt.isEmpty()) {
            throw new BadRequestException("BIOLOCK_NO_CREDENTIAL", "Leader has no active biometric credential");
        }
        BiometricCredential credential = credOpt.get();

        Instant now = clock.instant();
        boolean deviceOnline = device.getLastSeenAt() != null
                && device.getLastSeenAt().isAfter(now.minusSeconds(biolockProperties.getDeviceOnlineSeconds()));

        if (!deviceOnline) {
            throw new ConflictException("BIOLOCK_DEVICE_OFFLINE", "The leader's BioLock device is currently offline");
        }

        // Check if requester already has an active grant
        var activeGrant = documentAccessRequestRepository.findActiveGrant(attachmentId, requester.getId(), now);
        if (activeGrant.isPresent()) {
            long remaining = Duration.between(now, activeGrant.get().getAccessExpiresAt()).toSeconds();
            return new DocumentAccessRequestResponse(
                    activeGrant.get().getId(),
                    "APPROVED",
                    activeGrant.get().getAccessExpiresAt().toString(),
                    Math.max(0, remaining),
                    device.getName(),
                    false,
                    true
            );
        }

        // Check if an open request already exists
        var openReq = documentAccessRequestRepository.findOpenRequest(attachmentId, requester.getId(), now);
        if (openReq.isPresent()) {
            long remaining = Duration.between(now, openReq.get().getExpiresAt()).toSeconds();
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("requestId", openReq.get().getId());
            details.put("expiresAt", openReq.get().getExpiresAt().toString());
            details.put("secondsRemaining", Math.max(0, remaining));
            throw new ConflictException("BIOLOCK_REQUEST_ACTIVE", "An open access request already exists for this document", details);
        }

        // Rate limit: max requests per doc per hour
        long requestsSince = documentAccessRequestRepository.countRequestsSince(attachmentId, requester.getId(), now.minus(1, ChronoUnit.HOURS));
        if (requestsSince >= biolockProperties.getMaxRequestsPerDocPerHour()) {
            throw new RateLimitedException("BIOLOCK_RATE_LIMITED", "Hourly access request limit exceeded for this document", 3600);
        }

        Instant expiresAt = now.plusSeconds(biolockProperties.getRequestTtlSeconds());

        DocumentAccessRequest accessRequest = DocumentAccessRequest.builder()
                .projectId(project.getId())
                .attachmentId(attachment.getId())
                .taskId(task.getId())
                .requesterId(requester.getId())
                .leaderId(leader.getId())
                .credentialId(credential.getId())
                .status(AccessRequestStatus.PENDING)
                .requestedAt(now)
                .expiresAt(expiresAt)
                .leaderEmailStatus(LeaderEmailStatus.NOT_SENT)
                .leaderEmailAttempts(0)
                .build();
        accessRequest = documentAccessRequestRepository.save(accessRequest);

        String challenge = deviceKeyService.generateChallenge();
        BiolockJob job = BiolockJob.builder()
                .type(JobType.VERIFY_ACCESS)
                .status(JobStatus.QUEUED)
                .deviceId(device.getId())
                .credentialId(credential.getId())
                .accessRequestId(accessRequest.getId())
                .slot(credential.getSensorSlotId())
                .challenge(challenge)
                .createdAt(now)
                .expiresAt(expiresAt)
                .build();
        biolockJobRepository.save(job);

        // Leader email dispatch with preference and throttle checks
        boolean emailPref = emailService.isBioLockAccessEmailEnabled(leader.getId());
        long sentRecently = documentAccessRequestRepository.countSentEmailsSince(
                attachmentId, requester.getId(), now.minusSeconds(biolockProperties.getEmailThrottleMinutes() * 60L));
        boolean throttled = sentRecently > 0;

        if (!biolockProperties.isEmailOnRequest() || !emailPref || throttled) {
            accessRequest.setLeaderEmailStatus(LeaderEmailStatus.SKIPPED);
        } else {
            try {
                emailService.sendBioLockAccessRequestEmail(
                        leader,
                        requester.getName(),
                        requester.getEmail(),
                        project.getName(),
                        task.getTitle(),
                        attachment.getFileName(),
                        now.toString(),
                        expiresAt.toString(),
                        device.getName(),
                        true
                );
                accessRequest.setLeaderEmailStatus(LeaderEmailStatus.SENT);
                accessRequest.setLeaderEmailSentAt(clock.instant());
            } catch (Exception e) {
                log.error("Failed to send leader access request email: {}", e.getMessage());
                accessRequest.setLeaderEmailStatus(LeaderEmailStatus.FAILED);
                accessRequest.setLeaderEmailAttempts(1);
                auditService.logEvent(
                        "LEADER_EMAIL_FAILED",
                        leader.getId(),
                        device.getId(),
                        project.getId(),
                        accessRequest.getId(),
                        job.getId(),
                        "Leader email failed: " + e.getMessage()
                );
            }
        }
        accessRequest = documentAccessRequestRepository.save(accessRequest);

        // In-app notification and activity log
        notificationService.createNotification(
                leader,
                requester.getName() + " requested access to restricted document \"" + attachment.getFileName() + "\" in project \"" + project.getName() + "\""
        );
        notificationService.logActivity(
                project,
                requester,
                "DOCUMENT_ACCESS_REQUESTED",
                requester.getName() + " requested access to \"" + attachment.getFileName() + "\""
        );
        auditService.logEvent(
                "ACCESS_REQUESTED",
                requester.getId(),
                device.getId(),
                project.getId(),
                accessRequest.getId(),
                job.getId(),
                "Access requested for document " + attachment.getId()
        );

        long secondsRemaining = Duration.between(now, expiresAt).toSeconds();
        return new DocumentAccessRequestResponse(
                accessRequest.getId(),
                "PENDING",
                expiresAt.toString(),
                Math.max(0, secondsRemaining),
                device.getName(),
                accessRequest.getLeaderEmailStatus() == LeaderEmailStatus.SENT,
                true
        );
    }

    @Transactional(readOnly = true)
    public DocumentAccessStateResponse getAccessState(String callerEmail, UUID attachmentId) {
        User caller = userRepository.findByEmail(callerEmail)
                .orElseThrow(() -> new NotFoundException("User not found"));

        Attachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new NotFoundException("Document not found"));

        if (!attachment.isRestricted()) {
            return new DocumentAccessStateResponse("UNRESTRICTED", null, null, null, null, null, true);
        }

        Task task = attachment.getTask();
        Project project = task != null ? task.getProject() : null;
        if (project == null) {
            throw new NotFoundException("Project not found");
        }

        boolean isOwner = project.getOwner() != null && project.getOwner().getId().equals(caller.getId());
        if (isOwner) {
            return new DocumentAccessStateResponse("LEADER", null, null, null, null, null, true);
        }

        Instant now = clock.instant();

        // Check leader device online state
        boolean deviceOnline = false;
        if (project.getOwner() != null) {
            var devOpt = biolockDeviceRepository.findByOwnerUserIdAndStatus(project.getOwner().getId(), DeviceStatus.ACTIVE);
            if (devOpt.isPresent()) {
                BiolockDevice dev = devOpt.get();
                deviceOnline = dev.getLastSeenAt() != null
                        && dev.getLastSeenAt().isAfter(now.minusSeconds(biolockProperties.getDeviceOnlineSeconds()));
            }
        }

        // Active grant check
        var activeGrant = documentAccessRequestRepository.findActiveGrant(attachmentId, caller.getId(), now);
        if (activeGrant.isPresent()) {
            DocumentAccessRequest grant = activeGrant.get();
            long remaining = Duration.between(now, grant.getAccessExpiresAt()).toSeconds();
            return new DocumentAccessStateResponse(
                    "APPROVED",
                    grant.getId(),
                    null,
                    Math.max(0, remaining),
                    grant.getAccessExpiresAt().toString(),
                    null,
                    deviceOnline
            );
        }

        // Open request check
        var openReq = documentAccessRequestRepository.findOpenRequest(attachmentId, caller.getId(), now);
        if (openReq.isPresent()) {
            DocumentAccessRequest req = openReq.get();
            long remaining = Duration.between(now, req.getExpiresAt()).toSeconds();
            return new DocumentAccessStateResponse(
                    "PENDING",
                    req.getId(),
                    req.getExpiresAt().toString(),
                    Math.max(0, remaining),
                    null,
                    null,
                    deviceOnline
            );
        }

        // Recent decided request check (DENIED, EXPIRED, CANCELLED)
        var recent = documentAccessRequestRepository.findTopByAttachmentIdAndRequesterIdOrderByRequestedAtDesc(attachmentId, caller.getId());
        if (recent.isPresent()) {
            DocumentAccessRequest r = recent.get();
            if (r.getStatus() == AccessRequestStatus.DENIED) {
                return new DocumentAccessStateResponse("DENIED", r.getId(), null, null, null, r.getFailureReason(), deviceOnline);
            }
            if (r.getStatus() == AccessRequestStatus.EXPIRED) {
                return new DocumentAccessStateResponse("EXPIRED", r.getId(), null, null, null, r.getFailureReason(), deviceOnline);
            }
            if (r.getStatus() == AccessRequestStatus.CANCELLED) {
                return new DocumentAccessStateResponse("CANCELLED", r.getId(), null, null, null, null, deviceOnline);
            }
        }

        return new DocumentAccessStateResponse("LOCKED", null, null, null, null, null, deviceOnline);
    }

    @Transactional
    public void cancelAccessRequest(String callerEmail, UUID requestId) {
        User caller = userRepository.findByEmail(callerEmail)
                .orElseThrow(() -> new NotFoundException("User not found"));

        DocumentAccessRequest req = documentAccessRequestRepository.findById(requestId)
                .orElseThrow(() -> new NotFoundException("Access request not found"));

        if (!req.getRequesterId().equals(caller.getId())) {
            throw new ForbiddenException("FORBIDDEN", "Only the requester can cancel their request");
        }

        if (req.getStatus() != AccessRequestStatus.PENDING) {
            throw new ConflictException("REQUEST_NOT_PENDING", "Request is no longer pending: " + req.getStatus());
        }

        Instant now = clock.instant();
        req.setStatus(AccessRequestStatus.CANCELLED);
        req.setDecidedAt(now);
        documentAccessRequestRepository.save(req);

        biolockJobRepository.findByAccessRequestId(req.getId()).ifPresent(job -> {
            job.setStatus(JobStatus.CANCELLED);
            job.setOutcome("CANCELLED");
            job.setCompletedAt(now);
            biolockJobRepository.save(job);
        });

        auditService.logEvent(
                "REQUEST_CANCELLED",
                caller.getId(),
                null,
                req.getProjectId(),
                req.getId(),
                null,
                "Requester cancelled access request"
        );
    }

    public boolean hasAccess(UUID attachmentId, User user) {
        if (user == null) return false;

        Attachment attachment = attachmentRepository.findById(attachmentId)
                .orElse(null);
        if (attachment == null) return false;

        if (!attachment.isRestricted()) {
            return true;
        }

        Task task = attachment.getTask();
        Project project = task != null ? task.getProject() : null;
        if (project == null) return false;

        // Project owner has unconditional access
        if (project.getOwner() != null && project.getOwner().getId().equals(user.getId())) {
            return true;
        }

        Instant now = clock.instant();
        return documentAccessRequestRepository.findActiveGrant(attachmentId, user.getId(), now).isPresent();
    }

    @Scheduled(fixedDelay = 15000)
    @Transactional
    public void expirePendingRequests() {
        Instant now = clock.instant();
        List<DocumentAccessRequest> expired = documentAccessRequestRepository.findExpiredRequests(now);
        for (DocumentAccessRequest req : expired) {
            req.setStatus(AccessRequestStatus.EXPIRED);
            req.setDecidedAt(now);
            req.setFailureReason("BIOLOCK_REQUEST_TIMEOUT");
            documentAccessRequestRepository.save(req);

            biolockJobRepository.findByAccessRequestId(req.getId()).ifPresent(job -> {
                if (job.getStatus() == JobStatus.QUEUED || job.getStatus() == JobStatus.CLAIMED) {
                    job.setStatus(JobStatus.EXPIRED);
                    job.setOutcome("EXPIRED");
                    job.setCompletedAt(now);
                    biolockJobRepository.save(job);
                }
            });

            auditService.logEvent(
                    "ACCESS_EXPIRED",
                    req.getRequesterId(),
                    null,
                    req.getProjectId(),
                    req.getId(),
                    null,
                    "Access request expired after TTL"
            );
        }
    }

    @Scheduled(fixedDelay = 30000)
    @Transactional
    public void retryFailedEmails() {
        List<DocumentAccessRequest> failedRequests = documentAccessRequestRepository
                .findByLeaderEmailStatusAndLeaderEmailAttemptsLessThan(LeaderEmailStatus.FAILED, 3);

        for (DocumentAccessRequest req : failedRequests) {
            User leader = userRepository.findById(req.getLeaderId()).orElse(null);
            User requester = userRepository.findById(req.getRequesterId()).orElse(null);
            Attachment attachment = attachmentRepository.findById(req.getAttachmentId()).orElse(null);

            if (leader == null || requester == null || attachment == null) {
                req.setLeaderEmailAttempts(req.getLeaderEmailAttempts() + 1);
                documentAccessRequestRepository.save(req);
                continue;
            }

            Task task = attachment.getTask();
            Project project = task != null ? task.getProject() : null;
            String projectName = project != null ? project.getName() : "Taskoura Project";
            String taskTitle = task != null ? task.getTitle() : null;

            try {
                emailService.sendBioLockAccessRequestEmail(
                        leader,
                        requester.getName(),
                        requester.getEmail(),
                        projectName,
                        taskTitle,
                        attachment.getFileName(),
                        req.getRequestedAt().toString(),
                        req.getExpiresAt().toString(),
                        "BioLock Device",
                        true
                );
                req.setLeaderEmailStatus(LeaderEmailStatus.SENT);
                req.setLeaderEmailSentAt(clock.instant());
            } catch (Exception e) {
                req.setLeaderEmailAttempts(req.getLeaderEmailAttempts() + 1);
                log.warn("Retry failed for leader email on request {}: {}", req.getId(), e.getMessage());
            }
            documentAccessRequestRepository.save(req);
        }
    }
}
