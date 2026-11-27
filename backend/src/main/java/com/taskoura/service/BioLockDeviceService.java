package com.taskoura.service;

import com.taskoura.config.BiolockProperties;
import com.taskoura.dto.BioLockDtos.*;
import com.taskoura.entity.*;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.ConflictException;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.exception.RateLimitedException;
import com.taskoura.repository.*;
import com.taskoura.security.biolock.DeviceKeyService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class BioLockDeviceService {

    private final BiolockDeviceRepository biolockDeviceRepository;
    private final BiometricCredentialRepository biometricCredentialRepository;
    private final ProjectBiometricSettingRepository projectBiometricSettingRepository;
    private final BiolockJobRepository biolockJobRepository;
    private final DocumentAccessRequestRepository documentAccessRequestRepository;
    private final ProjectRepository projectRepository;
    private final AttachmentRepository attachmentRepository;
    private final DeviceKeyService deviceKeyService;
    private final BioLockAuditService auditService;
    private final BiolockProperties biolockProperties;
    private final Clock clock;

    private final Map<UUID, Instant> userLastEnrollmentTimes = new ConcurrentHashMap<>();
    private final SecureRandom secureRandom = new SecureRandom();

    public BioLockDeviceService(
            BiolockDeviceRepository biolockDeviceRepository,
            BiometricCredentialRepository biometricCredentialRepository,
            ProjectBiometricSettingRepository projectBiometricSettingRepository,
            BiolockJobRepository biolockJobRepository,
            DocumentAccessRequestRepository documentAccessRequestRepository,
            ProjectRepository projectRepository,
            AttachmentRepository attachmentRepository,
            DeviceKeyService deviceKeyService,
            BioLockAuditService auditService,
            BiolockProperties biolockProperties,
            Clock clock
    ) {
        this.biolockDeviceRepository = biolockDeviceRepository;
        this.biometricCredentialRepository = biometricCredentialRepository;
        this.projectBiometricSettingRepository = projectBiometricSettingRepository;
        this.biolockJobRepository = biolockJobRepository;
        this.documentAccessRequestRepository = documentAccessRequestRepository;
        this.projectRepository = projectRepository;
        this.attachmentRepository = attachmentRepository;
        this.deviceKeyService = deviceKeyService;
        this.auditService = auditService;
        this.biolockProperties = biolockProperties;
        this.clock = clock;
    }

    private void ensureBioLockEnabled() {
        if (!biolockProperties.isEnabled()) {
            throw new BadRequestException("BIOLOCK_DISABLED", "BioLock feature is disabled");
        }
    }

    private String generateRandomHex(int numBytes) {
        byte[] bytes = new byte[numBytes];
        secureRandom.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    @Transactional
    public DeviceRegistrationResponse registerDevice(User user, DeviceRegistrationRequest request) {
        ensureBioLockEnabled();

        // Leader rule: One ACTIVE device per leader
        if (biolockDeviceRepository.existsByOwnerUserIdAndStatus(user.getId(), DeviceStatus.ACTIVE)) {
            throw new ConflictException("ACTIVE_DEVICE_EXISTS", "Leader already has an active device. Revoke it before registering a new one.");
        }

        int keyVersion = 1;
        String name = (request != null && request.name() != null && !request.name().isBlank())
                ? request.name().trim()
                : "BioLock Scanner";

        Instant now = clock.instant();
        BiolockDevice device = BiolockDevice.builder()
                .ownerUserId(user.getId())
                .name(name)
                .status(DeviceStatus.ACTIVE)
                .keyVersion(keyVersion)
                .createdAt(now)
                .build();
        device = biolockDeviceRepository.save(device);
        UUID deviceId = device.getId();

        String deviceKeyHex = deviceKeyService.deriveDeviceKeyHex(deviceId, keyVersion);

        auditService.logEvent(
                "DEVICE_REGISTERED",
                user.getId(),
                deviceId,
                null,
                null,
                null,
                "Device registered: " + name
        );

        return new DeviceRegistrationResponse(deviceId, deviceKeyHex);
    }

    @Transactional
    public DeviceRotateKeyResponse rotateKey(User user, UUID deviceId) {
        ensureBioLockEnabled();

        BiolockDevice device = biolockDeviceRepository.findById(deviceId)
                .orElseThrow(() -> new NotFoundException("Device not found: " + deviceId));

        if (!device.getOwnerUserId().equals(user.getId())) {
            throw new ForbiddenException("You do not own this device");
        }

        if (device.getStatus() != DeviceStatus.ACTIVE) {
            throw new ConflictException("DEVICE_NOT_ACTIVE", "Device is not active");
        }

        int newKeyVersion = device.getKeyVersion() + 1;
        device.setKeyVersion(newKeyVersion);
        biolockDeviceRepository.save(device);

        String newDeviceKeyHex = deviceKeyService.deriveDeviceKeyHex(deviceId, newKeyVersion);

        auditService.logEvent(
                "DEVICE_KEY_ROTATED",
                user.getId(),
                deviceId,
                null,
                null,
                null,
                "Rotated to key version: " + newKeyVersion
        );

        return new DeviceRotateKeyResponse(deviceId, newDeviceKeyHex, newKeyVersion);
    }

    @Transactional
    public void revokeDevice(User user, UUID deviceId) {
        ensureBioLockEnabled();

        BiolockDevice device = biolockDeviceRepository.findById(deviceId)
                .orElseThrow(() -> new NotFoundException("Device not found: " + deviceId));

        if (!device.getOwnerUserId().equals(user.getId())) {
            throw new ForbiddenException("You do not own this device");
        }

        device.setStatus(DeviceStatus.REVOKED);
        biolockDeviceRepository.save(device);

        auditService.logEvent(
                "DEVICE_REVOKED",
                user.getId(),
                deviceId,
                null,
                null,
                null,
                "Device revoked by leader"
        );
    }

    @Transactional
    public EnrollmentResponse startEnrollment(User user) {
        ensureBioLockEnabled();

        Instant now = clock.instant();

        BiolockDevice device = biolockDeviceRepository.findByOwnerUserIdAndStatus(user.getId(), DeviceStatus.ACTIVE)
                .orElseThrow(() -> new ConflictException("BIOLOCK_NO_DEVICE", "No active BioLock device registered"));

        // Check if an enrollment job is already QUEUED or CLAIMED
        List<BiolockJob> queuedJobs = biolockJobRepository.findByDeviceIdAndStatus(device.getId(), JobStatus.QUEUED);
        List<BiolockJob> claimedJobs = biolockJobRepository.findByDeviceIdAndStatus(device.getId(), JobStatus.CLAIMED);
        boolean activeEnrollment = queuedJobs.stream().anyMatch(j -> j.getType() == JobType.ENROLL && j.getExpiresAt().isAfter(now))
                || claimedJobs.stream().anyMatch(j -> j.getType() == JobType.ENROLL && j.getExpiresAt().isAfter(now));

        if (activeEnrollment) {
            throw new ConflictException("BIOLOCK_REQUEST_ACTIVE", "An enrollment job is already in progress");
        }

        // Leader must not have an active credential
        Optional<BiometricCredential> activeCred = biometricCredentialRepository.findByUserIdAndStatus(user.getId(), CredentialStatus.ACTIVE);
        if (activeCred.isPresent()) {
            throw new ConflictException("BIOLOCK_CREDENTIAL_EXISTS", "Leader already has an active biometric credential");
        }

        boolean online = device.getLastSeenAt() != null
                && device.getLastSeenAt().isAfter(now.minusSeconds(biolockProperties.getDeviceOnlineSeconds()));
        if (!online) {
            throw new ConflictException("BIOLOCK_DEVICE_OFFLINE", "Device is offline");
        }

        // Rate limit user enrollment calls
        Instant lastEnrollment = userLastEnrollmentTimes.get(user.getId());
        if (lastEnrollment != null && now.isBefore(lastEnrollment.plusSeconds(2))) {
            throw new RateLimitedException("BIOLOCK_RATE_LIMITED", "Enrollment initiation rate limit exceeded.", 2);
        }
        userLastEnrollmentTimes.put(user.getId(), now);

        String challenge = generateRandomHex(32);
        BiolockJob job = new BiolockJob();
        job.setType(JobType.ENROLL);
        job.setStatus(JobStatus.QUEUED);
        job.setDeviceId(device.getId());
        job.setChallenge(challenge);
        job.setCreatedAt(now);
        job.setExpiresAt(now.plusSeconds(180)); // 3 minutes TTL
        job = biolockJobRepository.save(job);

        auditService.logEvent(
                "ENROLLMENT_STARTED",
                user.getId(),
                device.getId(),
                null,
                null,
                job.getId(),
                "Enrollment job initiated"
        );

        return new EnrollmentResponse(job.getId(), job.getStatus().name());
    }

    @Transactional(readOnly = true)
    public EnrollmentStatusResponse getEnrollmentStatus(User user, UUID jobId) {
        ensureBioLockEnabled();

        BiolockJob job = biolockJobRepository.findById(jobId)
                .orElseThrow(() -> new NotFoundException("Job not found: " + jobId));

        BiolockDevice device = biolockDeviceRepository.findById(job.getDeviceId())
                .orElseThrow(() -> new NotFoundException("Device not found"));

        if (!device.getOwnerUserId().equals(user.getId())) {
            throw new ForbiddenException("You do not have access to this enrollment job");
        }

        return new EnrollmentStatusResponse(job.getId(), job.getStatus().name(), job.getOutcome(), job.getReason());
    }

    @Transactional
    public void deleteCredential(User user) {
        ensureBioLockEnabled();
        Instant now = clock.instant();

        List<BiometricCredential> nonDeleted = biometricCredentialRepository.findByUserIdAndStatusNot(user.getId(), CredentialStatus.DELETED);
        if (nonDeleted.isEmpty()) {
            throw new NotFoundException("No biometric credential found");
        }

        BiometricCredential credential = nonDeleted.get(0);

        long inUseCount = projectBiometricSettingRepository.countActiveProjectsUsingCredential(credential.getId());
        if (inUseCount > 0) {
            throw new ConflictException("CREDENTIAL_IN_USE", "Cannot delete biometric credential while protected projects still use it");
        }

        credential.setStatus(CredentialStatus.PENDING_DELETE);
        credential.setUpdatedAt(now);
        biometricCredentialRepository.save(credential);

        enqueueDeleteTemplateJob(credential, now);

        auditService.logEvent(
                "CREDENTIAL_PENDING_DELETE",
                user.getId(),
                credential.getDeviceId(),
                null,
                null,
                null,
                "Explicit removal queued DELETE_TEMPLATE"
        );
    }

    @Transactional(readOnly = true)
    public BiolockStatusResponse getStatus(User user) {
        boolean enabled = biolockProperties.isEnabled();
        Instant now = clock.instant();

        BiolockDeviceStatusDto deviceDto = null;
        Optional<BiolockDevice> deviceOpt = biolockDeviceRepository.findByOwnerUserIdAndStatus(user.getId(), DeviceStatus.ACTIVE);
        if (deviceOpt.isPresent()) {
            BiolockDevice device = deviceOpt.get();
            boolean online = device.getLastSeenAt() != null
                    && device.getLastSeenAt().isAfter(now.minusSeconds(biolockProperties.getDeviceOnlineSeconds()));
            deviceDto = new BiolockDeviceStatusDto(device.getId(), device.getName(), online, device.getLastSeenAt());
        }

        BiometricCredentialStatusDto credDto = null;
        List<BiometricCredential> credentials = biometricCredentialRepository.findByUserIdAndStatusNot(user.getId(), CredentialStatus.DELETED);
        if (!credentials.isEmpty()) {
            BiometricCredential cred = credentials.get(0);
            credDto = new BiometricCredentialStatusDto(cred.getId(), cred.getStatus().name(), cred.getSensorSlotId());
        }

        return new BiolockStatusResponse(enabled, deviceDto, credDto);
    }

    @Transactional(readOnly = true)
    public ProjectBiometricSettingResponse getProjectBiometricSetting(User user, UUID projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new NotFoundException("Project not found: " + projectId));

        boolean isOwner = project.getOwner() != null && project.getOwner().getId().equals(user.getId());
        if (!isOwner) {
            throw new ForbiddenException("Only the project owner can view BioLock settings");
        }

        Optional<ProjectBiometricSetting> settingOpt = projectBiometricSettingRepository.findByProjectId(projectId);
        long protectedDocs = attachmentRepository.countByProjectIdAndRestrictedTrue(projectId);
        return new ProjectBiometricSettingResponse(
                settingOpt.map(ProjectBiometricSetting::isEnabled).orElse(false),
                settingOpt.map(ProjectBiometricSetting::getCredentialId).orElse(null),
                protectedDocs
        );
    }

    @Transactional
    public ProjectBiometricSettingResponse updateProjectBiometricSetting(
            User user,
            UUID projectId,
            ProjectBiometricSettingRequest request
    ) {
        ensureBioLockEnabled();
        Instant now = clock.instant();

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new NotFoundException("Project not found: " + projectId));

        boolean isOwner = project.getOwner() != null && project.getOwner().getId().equals(user.getId());
        if (!isOwner) {
            throw new ForbiddenException("Only the project owner can configure BioLock");
        }

        long protectedDocs = attachmentRepository.countByProjectIdAndRestrictedTrue(projectId);

        if (request.enabled()) {
            BiometricCredential credential = biometricCredentialRepository.findByUserIdAndStatus(user.getId(), CredentialStatus.ACTIVE)
                    .orElseThrow(() -> new ConflictException("BIOLOCK_NO_CREDENTIAL", "Leader biometric credential is required to enable BioLock"));

            ProjectBiometricSetting setting = projectBiometricSettingRepository.findByProjectId(projectId)
                    .orElseGet(() -> new ProjectBiometricSetting(projectId, credential.getId(), true, now));

            setting.setEnabled(true);
            setting.setCredentialId(credential.getId());
            projectBiometricSettingRepository.save(setting);

            auditService.logEvent(
                    "PROJECT_BIOLOCK_ENABLED",
                    user.getId(),
                    null,
                    projectId,
                    null,
                    null,
                    "BioLock enabled with credential " + credential.getId()
            );

            return new ProjectBiometricSettingResponse(true, credential.getId(), protectedDocs);
        } else {
            Optional<ProjectBiometricSetting> settingOpt = projectBiometricSettingRepository.findByProjectId(projectId);
            UUID credentialId = null;
            if (settingOpt.isPresent()) {
                ProjectBiometricSetting setting = settingOpt.get();
                credentialId = setting.getCredentialId();
                setting.setEnabled(false);
                projectBiometricSettingRepository.save(setting);

                documentAccessRequestRepository.revokeOpenRequestsForProject(projectId);
                checkAndMarkCredentialUnusedIfDangling(credentialId, now);

                auditService.logEvent(
                        "PROJECT_BIOLOCK_DISABLED",
                        user.getId(),
                        null,
                        projectId,
                        null,
                        null,
                        "BioLock disabled for project"
                );
            }
            return new ProjectBiometricSettingResponse(false, credentialId, protectedDocs);
        }
    }

    @Transactional
    public void handleProjectDeletion(UUID projectId) {
        Optional<ProjectBiometricSetting> settingOpt = projectBiometricSettingRepository.findByProjectId(projectId);
        if (settingOpt.isEmpty()) {
            return;
        }

        ProjectBiometricSetting setting = settingOpt.get();
        UUID credentialId = setting.getCredentialId();

        projectBiometricSettingRepository.delete(setting);
        projectBiometricSettingRepository.flush();

        documentAccessRequestRepository.revokeOpenRequestsForProject(projectId);

        checkAndMarkCredentialUnusedIfDangling(credentialId, clock.instant());
    }

    public void checkAndMarkCredentialUnusedIfDangling(UUID credentialId, Instant now) {
        if (credentialId == null) {
            return;
        }

        long activeCount = projectBiometricSettingRepository.countActiveProjectsUsingCredential(credentialId);
        if (activeCount == 0) {
            biometricCredentialRepository.findById(credentialId).ifPresent(cred -> {
                if (cred.getStatus() == CredentialStatus.ACTIVE) {
                    cred.setStatus(CredentialStatus.UNUSED);
                    cred.setUnusedSince(now);
                    biometricCredentialRepository.save(cred);

                    auditService.logEvent(
                            "CREDENTIAL_UNUSED",
                            null,
                            cred.getDeviceId(),
                            null,
                            null,
                            null,
                            "Credential marked UNUSED as no active projects reference it"
                    );

                    if (biolockProperties.getCleanupGraceMinutes() <= 0) {
                        cred.setStatus(CredentialStatus.PENDING_DELETE);
                        biometricCredentialRepository.save(cred);
                        enqueueDeleteTemplateJob(cred, now);

                        auditService.logEvent(
                                "CREDENTIAL_PENDING_DELETE",
                                null,
                                cred.getDeviceId(),
                                null,
                                null,
                                null,
                                "Immediate cleanup (0 grace min) queued DELETE_TEMPLATE"
                        );
                    }
                }
            });
        }
    }

    @Scheduled(fixedDelayString = "${biolock.cleanup-check-ms:60000}")
    @Transactional
    public void cleanupUnusedCredentials() {
        if (!biolockProperties.isEnabled()) {
            return;
        }
        Instant now = clock.instant();
        int graceMinutes = biolockProperties.getCleanupGraceMinutes();
        Instant cutoff = now.minusSeconds(graceMinutes * 60L);

        List<BiometricCredential> unusedCredentials = biometricCredentialRepository
                .findByStatusAndUnusedSinceLessThanEqual(CredentialStatus.UNUSED, cutoff);

        for (BiometricCredential cred : unusedCredentials) {
            long activeCount = projectBiometricSettingRepository.countActiveProjectsUsingCredential(cred.getId());
            if (activeCount == 0) {
                cred.setStatus(CredentialStatus.PENDING_DELETE);
                cred.setUpdatedAt(now);
                biometricCredentialRepository.save(cred);

                enqueueDeleteTemplateJob(cred, now);

                auditService.logEvent(
                        "CREDENTIAL_PENDING_DELETE",
                        null,
                        cred.getDeviceId(),
                        null,
                        null,
                        null,
                        "Scheduled cleanup after grace period queued DELETE_TEMPLATE"
                );
            }
        }
    }

    private void enqueueDeleteTemplateJob(BiometricCredential credential, Instant now) {
        String challenge = generateRandomHex(32);
        BiolockJob job = new BiolockJob();
        job.setType(JobType.DELETE_TEMPLATE);
        job.setStatus(JobStatus.QUEUED);
        job.setDeviceId(credential.getDeviceId());
        job.setCredentialId(credential.getId());
        job.setSlot(credential.getSensorSlotId());
        job.setChallenge(challenge);
        job.setCreatedAt(now);
        job.setExpiresAt(now.plusSeconds(604800)); // 7 days TTL for offline device retry
        biolockJobRepository.save(job);
    }
}
