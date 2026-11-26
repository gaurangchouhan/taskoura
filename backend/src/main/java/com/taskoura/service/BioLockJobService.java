package com.taskoura.service;

import com.taskoura.config.BiolockProperties;
import com.taskoura.dto.BioLockDtos.BioLockJobResultRequest;
import com.taskoura.dto.BioLockDtos.BioLockJobResultResponse;
import com.taskoura.dto.BioLockDtos.DeviceJobResponse;
import com.taskoura.entity.*;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.ConflictException;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.exception.RateLimitedException;
import com.taskoura.repository.BiolockDeviceRepository;
import com.taskoura.repository.BiolockJobRepository;
import com.taskoura.repository.BiometricCredentialRepository;
import com.taskoura.security.biolock.DeviceKeyService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class BioLockJobService {

    private final BiolockJobRepository biolockJobRepository;
    private final BiolockDeviceRepository biolockDeviceRepository;
    private final BiometricCredentialRepository biometricCredentialRepository;
    private final com.taskoura.repository.DocumentAccessRequestRepository documentAccessRequestRepository;
    private final DeviceKeyService deviceKeyService;
    private final BioLockAuditService auditService;
    private final BiolockProperties biolockProperties;
    private final Clock clock;

    private final Map<UUID, Instant> lastPollTimes = new ConcurrentHashMap<>();

    public BioLockJobService(
            BiolockJobRepository biolockJobRepository,
            BiolockDeviceRepository biolockDeviceRepository,
            BiometricCredentialRepository biometricCredentialRepository,
            com.taskoura.repository.DocumentAccessRequestRepository documentAccessRequestRepository,
            DeviceKeyService deviceKeyService,
            BioLockAuditService auditService,
            BiolockProperties biolockProperties,
            Clock clock
    ) {
        this.biolockJobRepository = biolockJobRepository;
        this.biolockDeviceRepository = biolockDeviceRepository;
        this.biometricCredentialRepository = biometricCredentialRepository;
        this.documentAccessRequestRepository = documentAccessRequestRepository;
        this.deviceKeyService = deviceKeyService;
        this.auditService = auditService;
        this.biolockProperties = biolockProperties;
        this.clock = clock;
    }

    @Transactional
    public DeviceJobResponse claimNextJob(BiolockDevice device) {
        Instant now = clock.instant();

        // 1. Min poll interval 2 s (429 with Retry-After)
        Instant lastPoll = lastPollTimes.get(device.getId());
        if (lastPoll != null && now.isBefore(lastPoll.plusMillis(2000))) {
            throw new RateLimitedException("BIOLOCK_RATE_LIMITED", "Polling too fast. Minimum interval is 2 seconds.", 2);
        }
        lastPollTimes.put(device.getId(), now);

        // 2. Update device lastSeenAt
        device.setLastSeenAt(now);
        biolockDeviceRepository.save(device);

        // 3. Re-queue expired leases and expire overdue jobs
        List<BiolockJob> expiredJobs = biolockJobRepository.findExpiredJobs(now);
        for (BiolockJob expiredJob : expiredJobs) {
            expiredJob.setStatus(JobStatus.EXPIRED);
            biolockJobRepository.save(expiredJob);
        }

        // 4. Claim oldest QUEUED / expired-lease job for THIS device
        List<BiolockJob> claimable = biolockJobRepository.findNextClaimableJobsWithLock(device.getId(), now);
        if (claimable.isEmpty()) {
            return null;
        }

        BiolockJob job = claimable.get(0);
        job.setStatus(JobStatus.CLAIMED);
        job.setClaimedAt(now);
        job.setLeaseUntil(now.plusSeconds(biolockProperties.getJobLeaseSeconds()));
        biolockJobRepository.save(job);

        auditService.logEvent(
                "JOB_CLAIMED",
                null,
                device.getId(),
                null,
                job.getAccessRequestId(),
                job.getId(),
                "Job claimed: " + job.getType()
        );

        return new DeviceJobResponse(
                job.getId(),
                job.getType().name(),
                job.getSlot(),
                job.getSlot(),
                job.getChallenge(),
                job.getExpiresAt().toString()
        );
    }

    @Transactional
    public BioLockJobResultResponse submitJobResult(BiolockDevice device, UUID jobId, BioLockJobResultRequest request) {
        Instant now = clock.instant();

        BiolockJob job = biolockJobRepository.findById(jobId)
                .orElseThrow(() -> new NotFoundException("Job not found: " + jobId));

        // Validate device ownership
        if (!job.getDeviceId().equals(device.getId())) {
            throw new ForbiddenException("Device does not own this job");
        }

        // Idempotency: the same result sent twice returns the stored answer and changes nothing
        if (job.getStatus() == JobStatus.COMPLETED || job.getStatus() == JobStatus.FAILED) {
            if (request.outcome() != null && request.outcome().equalsIgnoreCase(job.getOutcome())) {
                return new BioLockJobResultResponse("OK");
            }
            throw new ConflictException("JOB_ALREADY_CLOSED", "Job already completed with a different outcome");
        }

        if (job.getStatus() == JobStatus.EXPIRED || job.getStatus() == JobStatus.CANCELLED) {
            throw new ConflictException("JOB_EXPIRED", "Job is closed: " + job.getStatus());
        }

        String outcome = request.outcome() != null ? request.outcome().trim() : "";
        String deviceKeyHex = deviceKeyService.deriveDeviceKeyHex(device.getId(), device.getKeyVersion());

        // Validate proof for ENROLLED, MATCH, DELETED, ALREADY_EMPTY
        boolean proofRequired = outcome.equalsIgnoreCase("ENROLLED")
                || outcome.equalsIgnoreCase("MATCH")
                || outcome.equalsIgnoreCase("DELETED")
                || outcome.equalsIgnoreCase("ALREADY_EMPTY");

        if (proofRequired) {
            Integer slotForProof = (outcome.equalsIgnoreCase("MATCH") && request.matchedSlot() != null)
                    ? request.matchedSlot()
                    : request.slot();
            if (slotForProof == null && (outcome.equalsIgnoreCase("DELETED") || outcome.equalsIgnoreCase("ALREADY_EMPTY"))) {
                slotForProof = job.getSlot();
            }

            boolean validProof = deviceKeyService.verifyProof(
                    deviceKeyHex,
                    job.getId(),
                    job.getChallenge(),
                    outcome,
                    slotForProof,
                    request.proof()
            );

            if (!validProof) {
                throw new BadRequestException("Invalid proof for outcome " + outcome);
            }
        }

        switch (job.getType()) {
            case ENROLL -> {
                if (outcome.equalsIgnoreCase("ENROLLED")) {
                    if (request.slot() == null) {
                        throw new BadRequestException("Slot is required for ENROLLED outcome");
                    }
                    BiometricCredential credential = BiometricCredential.builder()
                            .userId(device.getOwnerUserId())
                            .deviceId(device.getId())
                            .sensorSlotId(request.slot())
                            .status(CredentialStatus.ACTIVE)
                            .enrolledAt(now)
                            .createdAt(now)
                            .updatedAt(now)
                            .build();
                    credential = biometricCredentialRepository.save(credential);

                    job.setCredentialId(credential.getId());
                    job.setSlot(request.slot());
                    job.setStatus(JobStatus.COMPLETED);
                    job.setOutcome("ENROLLED");
                    job.setCompletedAt(now);

                    auditService.logEvent(
                            "CREDENTIAL_ENROLLED",
                            device.getOwnerUserId(),
                            device.getId(),
                            null,
                            null,
                            job.getId(),
                            "Slot " + request.slot()
                    );
                } else if (outcome.equalsIgnoreCase("DUPLICATE") || outcome.startsWith("DUPLICATE")) {
                    Integer slot = request.slot();
                    Optional<BiometricCredential> existingOpt = slot != null
                            ? biometricCredentialRepository.findByDeviceIdAndSensorSlotIdAndStatusNot(device.getId(), slot, CredentialStatus.DELETED)
                            : Optional.empty();

                    if (existingOpt.isPresent() && existingOpt.get().getUserId().equals(device.getOwnerUserId())) {
                        job.setCredentialId(existingOpt.get().getId());
                        job.setSlot(slot);
                        job.setStatus(JobStatus.COMPLETED);
                        job.setOutcome("DUPLICATE");
                        job.setCompletedAt(now);
                    } else {
                        job.setStatus(JobStatus.FAILED);
                        job.setOutcome("FAILED");
                        job.setReason("BIOLOCK_NO_CREDENTIAL: Slot belongs to another user or unrecorded credential");
                        job.setCompletedAt(now);
                    }
                } else {
                    job.setStatus(JobStatus.FAILED);
                    job.setOutcome(outcome);
                    job.setReason(request.reason() != null ? request.reason() : "Enrollment failed on device");
                    job.setCompletedAt(now);
                }
            }
            case DELETE_TEMPLATE -> {
                if (outcome.equalsIgnoreCase("DELETED") || outcome.equalsIgnoreCase("ALREADY_EMPTY")) {
                    if (job.getCredentialId() != null) {
                        biometricCredentialRepository.findById(job.getCredentialId()).ifPresent(cred -> {
                            cred.setStatus(CredentialStatus.DELETED);
                            cred.setUpdatedAt(now);
                            biometricCredentialRepository.save(cred);
                            auditService.logEvent(
                                    "CREDENTIAL_DELETED",
                                    null,
                                    device.getId(),
                                    null,
                                    null,
                                    job.getId(),
                                    "Outcome: " + outcome
                            );
                        });
                    }
                    job.setStatus(JobStatus.COMPLETED);
                    job.setOutcome(outcome);
                    job.setCompletedAt(now);
                } else {
                    job.setStatus(JobStatus.FAILED);
                    job.setOutcome(outcome);
                    job.setReason(request.reason());
                    job.setCompletedAt(now);
                }
            }
            case VERIFY_ACCESS -> {
                job.setOutcome(outcome);
                job.setCompletedAt(now);

                Optional<DocumentAccessRequest> reqOpt = job.getAccessRequestId() != null
                        ? documentAccessRequestRepository.findById(job.getAccessRequestId())
                        : Optional.empty();

                if (outcome.equalsIgnoreCase("MATCH")) {
                    Integer expectedSlot = job.getSlot();
                    Integer matchedSlot = request.matchedSlot() != null ? request.matchedSlot() : request.slot();
                    job.setSlot(matchedSlot);

                    // Verify expected slot matches
                    boolean slotMatches = expectedSlot != null && expectedSlot.equals(matchedSlot);
                    if (slotMatches) {
                        job.setStatus(JobStatus.COMPLETED);
                        if (reqOpt.isPresent()) {
                            DocumentAccessRequest req = reqOpt.get();
                            req.setStatus(AccessRequestStatus.APPROVED);
                            req.setDecidedAt(now);
                            req.setAccessExpiresAt(now.plusSeconds(biolockProperties.getAccessTtlMinutes() * 60L));
                            req.setDecidedByDeviceId(device.getId());
                            documentAccessRequestRepository.save(req);

                            auditService.logEvent(
                                    "ACCESS_GRANTED",
                                    req.getRequesterId(),
                                    device.getId(),
                                    req.getProjectId(),
                                    req.getId(),
                                    job.getId(),
                                    "Document access approved via BioLock match in slot " + matchedSlot
                            );
                        }
                    } else {
                        job.setStatus(JobStatus.FAILED);
                        job.setReason("BIOLOCK_SLOT_MISMATCH");
                        if (reqOpt.isPresent()) {
                            DocumentAccessRequest req = reqOpt.get();
                            req.setStatus(AccessRequestStatus.DENIED);
                            req.setDecidedAt(now);
                            req.setFailureReason("BIOLOCK_SLOT_MISMATCH");
                            req.setDecidedByDeviceId(device.getId());
                            documentAccessRequestRepository.save(req);

                            auditService.logEvent(
                                    "ACCESS_DENIED",
                                    req.getRequesterId(),
                                    device.getId(),
                                    req.getProjectId(),
                                    req.getId(),
                                    job.getId(),
                                    "Access denied: slot mismatch (expected=" + job.getSlot() + ", matched=" + matchedSlot + ")"
                            );
                        }
                    }
                } else {
                    job.setStatus(JobStatus.FAILED);
                    String reason = request.reason() != null && !request.reason().isBlank() ? request.reason() : outcome;
                    job.setReason(reason);

                    if (reqOpt.isPresent()) {
                        DocumentAccessRequest req = reqOpt.get();
                        AccessRequestStatus newStatus = outcome.equalsIgnoreCase("TIMEOUT")
                                ? AccessRequestStatus.EXPIRED
                                : AccessRequestStatus.DENIED;
                        req.setStatus(newStatus);
                        req.setDecidedAt(now);
                        req.setFailureReason(reason);
                        req.setDecidedByDeviceId(device.getId());
                        documentAccessRequestRepository.save(req);

                        auditService.logEvent(
                                "ACCESS_DENIED",
                                req.getRequesterId(),
                                device.getId(),
                                req.getProjectId(),
                                req.getId(),
                                job.getId(),
                                "Access denied: " + reason
                        );
                    }
                }
            }
        }

        biolockJobRepository.save(job);
        auditService.logEvent(
                job.getStatus() == JobStatus.COMPLETED ? "JOB_COMPLETED" : "JOB_FAILED",
                null,
                device.getId(),
                null,
                job.getAccessRequestId(),
                job.getId(),
                "Outcome: " + job.getOutcome()
        );

        return new BioLockJobResultResponse("OK");
    }
}
