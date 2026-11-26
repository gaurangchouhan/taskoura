package com.taskoura.controller;

import com.taskoura.dto.BioLockDtos.BioLockJobResultRequest;
import com.taskoura.dto.BioLockDtos.BioLockJobResultResponse;
import com.taskoura.dto.BioLockDtos.DeviceJobResponse;
import com.taskoura.entity.BiolockDevice;
import com.taskoura.exception.UnauthorizedException;
import com.taskoura.security.biolock.DeviceAuthFilter;
import com.taskoura.service.BioLockJobService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/device/biolock")
public class DeviceBioLockController {

    private final BioLockJobService bioLockJobService;

    public DeviceBioLockController(BioLockJobService bioLockJobService) {
        this.bioLockJobService = bioLockJobService;
    }

    private BiolockDevice getAuthenticatedDevice(HttpServletRequest request) {
        BiolockDevice device = (BiolockDevice) request.getAttribute(DeviceAuthFilter.DEVICE_ATTR);
        if (device == null) {
            throw new UnauthorizedException("Device not authenticated");
        }
        return device;
    }

    @GetMapping("/jobs/next")
    public ResponseEntity<DeviceJobResponse> getNextJob(HttpServletRequest request) {
        BiolockDevice device = getAuthenticatedDevice(request);
        DeviceJobResponse job = bioLockJobService.claimNextJob(device);
        if (job == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(job);
    }

    @PostMapping("/jobs/{jobId}/result")
    public ResponseEntity<BioLockJobResultResponse> submitResult(
            @PathVariable UUID jobId,
            @RequestBody BioLockJobResultRequest resultRequest,
            HttpServletRequest request
    ) {
        BiolockDevice device = getAuthenticatedDevice(request);
        BioLockJobResultResponse response = bioLockJobService.submitJobResult(device, jobId, resultRequest);
        return ResponseEntity.ok(response);
    }
}
