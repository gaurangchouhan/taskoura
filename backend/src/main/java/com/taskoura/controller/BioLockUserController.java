package com.taskoura.controller;

import com.taskoura.dto.BioLockDtos.*;
import com.taskoura.entity.User;
import com.taskoura.exception.UnauthorizedException;
import com.taskoura.repository.UserRepository;
import com.taskoura.service.BioLockDeviceService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
public class BioLockUserController {

    private final BioLockDeviceService bioLockDeviceService;
    private final UserRepository userRepository;

    public BioLockUserController(BioLockDeviceService bioLockDeviceService, UserRepository userRepository) {
        this.bioLockDeviceService = bioLockDeviceService;
        this.userRepository = userRepository;
    }

    private User getAuthenticatedUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new UnauthorizedException("Full authentication is required to access this resource");
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new UnauthorizedException("User not found"));
    }

    @GetMapping("/api/biolock/status")
    public ResponseEntity<BiolockStatusResponse> getStatus(Authentication authentication) {
        User user = getAuthenticatedUser(authentication);
        return ResponseEntity.ok(bioLockDeviceService.getStatus(user));
    }

    @PostMapping("/api/biolock/devices")
    public ResponseEntity<DeviceRegistrationResponse> registerDevice(
            Authentication authentication,
            @RequestBody(required = false) DeviceRegistrationRequest request
    ) {
        User user = getAuthenticatedUser(authentication);
        DeviceRegistrationResponse response = bioLockDeviceService.registerDevice(user, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/api/biolock/devices/{id}/rotate-key")
    public ResponseEntity<DeviceRotateKeyResponse> rotateKey(
            Authentication authentication,
            @PathVariable UUID id
    ) {
        User user = getAuthenticatedUser(authentication);
        return ResponseEntity.ok(bioLockDeviceService.rotateKey(user, id));
    }

    @DeleteMapping("/api/biolock/devices/{id}")
    public ResponseEntity<Void> revokeDevice(
            Authentication authentication,
            @PathVariable UUID id
    ) {
        User user = getAuthenticatedUser(authentication);
        bioLockDeviceService.revokeDevice(user, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/biolock/enrollment")
    public ResponseEntity<EnrollmentResponse> startEnrollment(Authentication authentication) {
        User user = getAuthenticatedUser(authentication);
        EnrollmentResponse response = bioLockDeviceService.startEnrollment(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/api/biolock/enrollment/{jobId}")
    public ResponseEntity<EnrollmentStatusResponse> getEnrollmentStatus(
            Authentication authentication,
            @PathVariable UUID jobId
    ) {
        User user = getAuthenticatedUser(authentication);
        return ResponseEntity.ok(bioLockDeviceService.getEnrollmentStatus(user, jobId));
    }

    @DeleteMapping("/api/biolock/credential")
    public ResponseEntity<Void> deleteCredential(Authentication authentication) {
        User user = getAuthenticatedUser(authentication);
        bioLockDeviceService.deleteCredential(user);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/projects/{projectId}/biolock")
    public ResponseEntity<ProjectBiometricSettingResponse> getProjectBiometricSetting(
            Authentication authentication,
            @PathVariable UUID projectId
    ) {
        User user = getAuthenticatedUser(authentication);
        return ResponseEntity.ok(bioLockDeviceService.getProjectBiometricSetting(user, projectId));
    }

    @PutMapping("/api/projects/{projectId}/biolock")
    public ResponseEntity<ProjectBiometricSettingResponse> updateProjectBiometricSetting(
            Authentication authentication,
            @PathVariable UUID projectId,
            @RequestBody ProjectBiometricSettingRequest request
    ) {
        User user = getAuthenticatedUser(authentication);
        return ResponseEntity.ok(bioLockDeviceService.updateProjectBiometricSetting(user, projectId, request));
    }
}
