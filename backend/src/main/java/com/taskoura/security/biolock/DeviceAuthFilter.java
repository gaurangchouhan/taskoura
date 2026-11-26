package com.taskoura.security.biolock;

import com.taskoura.entity.BiolockDevice;
import com.taskoura.entity.DeviceNonce;
import com.taskoura.entity.DeviceStatus;
import com.taskoura.repository.BiolockDeviceRepository;
import com.taskoura.repository.DeviceNonceRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
public class DeviceAuthFilter extends OncePerRequestFilter {

    public static final String DEVICE_ATTR = "authenticatedDevice";
    private static final Pattern NONCE_PATTERN = Pattern.compile("^[0-9a-fA-F]{32}$");
    private static final Pattern SIGNATURE_PATTERN = Pattern.compile("^[0-9a-fA-F]{64}$");

    private final DeviceKeyService deviceKeyService;
    private final BiolockDeviceRepository biolockDeviceRepository;
    private final DeviceNonceRepository deviceNonceRepository;
    private final Clock clock;

    public DeviceAuthFilter(
            @org.springframework.beans.factory.annotation.Autowired(required = false) DeviceKeyService deviceKeyService,
            @org.springframework.beans.factory.annotation.Autowired(required = false) BiolockDeviceRepository biolockDeviceRepository,
            @org.springframework.beans.factory.annotation.Autowired(required = false) DeviceNonceRepository deviceNonceRepository,
            @org.springframework.beans.factory.annotation.Autowired(required = false) Clock clock
    ) {
        this.deviceKeyService = deviceKeyService;
        this.biolockDeviceRepository = biolockDeviceRepository;
        this.deviceNonceRepository = deviceNonceRepository;
        this.clock = clock != null ? clock : Clock.systemUTC();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.startsWith("/api/device/biolock/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String deviceIdHeader = request.getHeader("X-Device-Id");
        String timestampHeader = request.getHeader("X-Timestamp");
        String nonceHeader = request.getHeader("X-Nonce");
        String signatureHeader = request.getHeader("X-Signature");

        if (deviceKeyService == null || biolockDeviceRepository == null || deviceNonceRepository == null) {
            reject(response);
            return;
        }

        if (deviceIdHeader == null || timestampHeader == null || nonceHeader == null || signatureHeader == null) {
            reject(response);
            return;
        }

        UUID deviceId;
        try {
            deviceId = UUID.fromString(deviceIdHeader.trim());
        } catch (IllegalArgumentException e) {
            reject(response);
            return;
        }

        long timestampSeconds;
        try {
            timestampSeconds = Long.parseLong(timestampHeader.trim());
        } catch (NumberFormatException e) {
            reject(response);
            return;
        }

        String nonce = nonceHeader.trim();
        if (!NONCE_PATTERN.matcher(nonce).matches()) {
            reject(response);
            return;
        }

        String signature = signatureHeader.trim();
        if (!SIGNATURE_PATTERN.matcher(signature).matches()) {
            reject(response);
            return;
        }

        Instant now = clock.instant();
        if (Math.abs(now.getEpochSecond() - timestampSeconds) > 120) {
            reject(response);
            return;
        }

        Optional<BiolockDevice> deviceOpt = biolockDeviceRepository.findByIdAndStatus(deviceId, DeviceStatus.ACTIVE);
        if (deviceOpt.isEmpty()) {
            reject(response);
            return;
        }
        BiolockDevice device = deviceOpt.get();

        if (deviceNonceRepository.existsByDeviceIdAndNonce(deviceId, nonce)) {
            reject(response);
            return;
        }

        try {
            DeviceNonce deviceNonce = new DeviceNonce(deviceId, nonce, now.plusSeconds(600));
            deviceNonceRepository.save(deviceNonce);
        } catch (DataIntegrityViolationException e) {
            reject(response);
            return;
        }

        CachedBodyHttpServletRequest cachedRequest = (request instanceof CachedBodyHttpServletRequest cReq)
                ? cReq
                : new CachedBodyHttpServletRequest(request);

        String deviceKeyHex = deviceKeyService.deriveDeviceKeyHex(deviceId, device.getKeyVersion());
        String method = request.getMethod();
        String path = request.getRequestURI();

        boolean validSignature = deviceKeyService.verifyRequestSignature(
                deviceKeyHex,
                method,
                path,
                timestampHeader.trim(),
                nonce,
                cachedRequest.getCachedBody(),
                signature
        );

        if (!validSignature) {
            reject(response);
            return;
        }

        cachedRequest.setAttribute(DEVICE_ATTR, device);
        SecurityContextHolder.getContext().setAuthentication(new DeviceAuthenticationToken(device));

        filterChain.doFilter(cachedRequest, response);
    }

    private void reject(HttpServletResponse response) throws IOException {
        SecurityContextHolder.clearContext();
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentLength(0);
    }
}
