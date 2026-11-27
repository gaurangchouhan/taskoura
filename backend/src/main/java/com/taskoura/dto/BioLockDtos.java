package com.taskoura.dto;

import java.time.Instant;
import java.util.UUID;

public class BioLockDtos {

    public record DeviceRegistrationRequest(String name) {}

    public record DeviceRegistrationResponse(UUID deviceId, String deviceKey) {}

    public record DeviceRotateKeyResponse(UUID deviceId, String deviceKey, int keyVersion) {}

    public record BiolockDeviceStatusDto(UUID id, String name, boolean online, Instant lastSeenAt) {
        public BiolockDeviceStatusDto(UUID id, String name, boolean online) {
            this(id, name, online, null);
        }
    }

    public record BiometricCredentialStatusDto(UUID id, String status, Integer slot) {}

    public record BiolockStatusResponse(
            boolean enabled,
            BiolockDeviceStatusDto device,
            BiometricCredentialStatusDto credential
    ) {}

    public record EnrollmentResponse(UUID jobId, String status) {}

    public record EnrollmentStatusResponse(UUID jobId, String status, String outcome, String reason) {}

    public record ProjectBiometricSettingRequest(boolean enabled) {}

    public record ProjectBiometricSettingResponse(boolean enabled, UUID credentialId, Long protectedDocumentsCount) {
        public ProjectBiometricSettingResponse(boolean enabled, UUID credentialId) {
            this(enabled, credentialId, 0L);
        }
    }

    public record DeviceJobResponse(
            UUID jobId,
            String type,
            Integer expectedSlot,
            Integer slot,
            String challenge,
            String expiresAt
    ) {}

    public record BioLockJobResultRequest(
            String outcome,
            Integer slot,
            Integer matchedSlot,
            Integer score,
            String reason,
            String proof
    ) {
        public BioLockJobResultRequest(String outcome, Integer slot, Integer matchedSlot, String proof, String reason) {
            this(outcome, slot, matchedSlot, null, reason, proof);
        }
    }

    public record BioLockJobResultResponse(String status) {}
}
