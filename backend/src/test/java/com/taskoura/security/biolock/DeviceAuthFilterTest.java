package com.taskoura.security.biolock;

import com.taskoura.config.BiolockProperties;
import com.taskoura.entity.BiolockDevice;
import com.taskoura.entity.DeviceNonce;
import com.taskoura.entity.DeviceStatus;
import com.taskoura.repository.BiolockDeviceRepository;
import com.taskoura.repository.DeviceNonceRepository;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DeviceAuthFilterTest {

    @Mock
    private BiolockDeviceRepository biolockDeviceRepository;

    @Mock
    private DeviceNonceRepository deviceNonceRepository;

    @Mock
    private FilterChain filterChain;

    private BiolockProperties biolockProperties;
    private DeviceKeyService deviceKeyService;
    private Clock fixedClock;
    private DeviceAuthFilter deviceAuthFilter;

    private final Instant now = Instant.parse("2026-11-26T12:00:00Z");
    private final String masterKeyBase64 = Base64.getEncoder().encodeToString(new byte[32]);
    private final UUID deviceId = UUID.randomUUID();
    private final UUID ownerId = UUID.randomUUID();
    private BiolockDevice activeDevice;
    private String deviceKeyHex;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        fixedClock = Clock.fixed(now, ZoneOffset.UTC);

        biolockProperties = new BiolockProperties();
        biolockProperties.setEnabled(true);
        biolockProperties.setDeviceMasterKey(masterKeyBase64);

        deviceKeyService = new DeviceKeyService(biolockProperties);
        deviceAuthFilter = new DeviceAuthFilter(
                deviceKeyService,
                biolockDeviceRepository,
                deviceNonceRepository,
                fixedClock
        );

        activeDevice = new BiolockDevice(deviceId, ownerId, "ESP32-S2", DeviceStatus.ACTIVE, 1, now, now);
        deviceKeyHex = deviceKeyService.deriveDeviceKeyHex(deviceId, 1);
    }

    private String randomNonce() {
        byte[] bytes = new byte[16];
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    @Test
    @DisplayName("Good signature is accepted, stores nonce, populates context, and proceeds")
    void testGoodSignatureAccepted() throws Exception {
        when(biolockDeviceRepository.findByIdAndStatus(deviceId, DeviceStatus.ACTIVE))
                .thenReturn(Optional.of(activeDevice));
        when(deviceNonceRepository.existsByDeviceIdAndNonce(eq(deviceId), any())).thenReturn(false);

        String nonce = randomNonce();
        String timestamp = String.valueOf(now.getEpochSecond());
        String path = "/api/device/biolock/jobs/next";
        String method = "GET";
        byte[] body = new byte[0];

        String signature = deviceKeyService.calculateRequestSignature(
                deviceKeyHex, method, path, timestamp, nonce, body
        );

        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.addHeader("X-Device-Id", deviceId.toString());
        request.addHeader("X-Timestamp", timestamp);
        request.addHeader("X-Nonce", nonce);
        request.addHeader("X-Signature", signature);

        MockHttpServletResponse response = new MockHttpServletResponse();

        deviceAuthFilter.doFilter(request, response, filterChain);

        assertThat(response.getStatus()).isEqualTo(200);
        verify(filterChain).doFilter(any(), any());
        verify(deviceNonceRepository).save(any(DeviceNonce.class));

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal()).isEqualTo(activeDevice);
    }

    @Test
    @DisplayName("Bad signature is rejected with 401 and empty body")
    void testBadSignatureRejected() throws Exception {
        when(biolockDeviceRepository.findByIdAndStatus(deviceId, DeviceStatus.ACTIVE))
                .thenReturn(Optional.of(activeDevice));
        when(deviceNonceRepository.existsByDeviceIdAndNonce(eq(deviceId), any())).thenReturn(false);

        String nonce = randomNonce();
        String timestamp = String.valueOf(now.getEpochSecond());
        String path = "/api/device/biolock/jobs/next";

        String badSignature = "0".repeat(64);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.addHeader("X-Device-Id", deviceId.toString());
        request.addHeader("X-Timestamp", timestamp);
        request.addHeader("X-Nonce", nonce);
        request.addHeader("X-Signature", badSignature);

        MockHttpServletResponse response = new MockHttpServletResponse();

        deviceAuthFilter.doFilter(request, response, filterChain);

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).isEmpty();
        verify(filterChain, never()).doFilter(any(), any());
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    @DisplayName("Timestamp drift > 120s is rejected with 401")
    void testTimestampDriftRejected() throws Exception {
        String nonce = randomNonce();
        String oldTimestamp = String.valueOf(now.minusSeconds(125).getEpochSecond());
        String path = "/api/device/biolock/jobs/next";

        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.addHeader("X-Device-Id", deviceId.toString());
        request.addHeader("X-Timestamp", oldTimestamp);
        request.addHeader("X-Nonce", nonce);
        request.addHeader("X-Signature", "a".repeat(64));

        MockHttpServletResponse response = new MockHttpServletResponse();

        deviceAuthFilter.doFilter(request, response, filterChain);

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).isEmpty();
        verify(filterChain, never()).doFilter(any(), any());
    }

    @Test
    @DisplayName("Reused nonce is rejected with 401")
    void testReusedNonceRejected() throws Exception {
        when(biolockDeviceRepository.findByIdAndStatus(deviceId, DeviceStatus.ACTIVE))
                .thenReturn(Optional.of(activeDevice));
        String nonce = randomNonce();
        when(deviceNonceRepository.existsByDeviceIdAndNonce(deviceId, nonce)).thenReturn(true);

        String timestamp = String.valueOf(now.getEpochSecond());
        String path = "/api/device/biolock/jobs/next";

        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.addHeader("X-Device-Id", deviceId.toString());
        request.addHeader("X-Timestamp", timestamp);
        request.addHeader("X-Nonce", nonce);
        request.addHeader("X-Signature", "b".repeat(64));

        MockHttpServletResponse response = new MockHttpServletResponse();

        deviceAuthFilter.doFilter(request, response, filterChain);

        assertThat(response.getStatus()).isEqualTo(401);
        verify(filterChain, never()).doFilter(any(), any());
    }

    @Test
    @DisplayName("Revoked or nonexistent device returns 401")
    void testRevokedDeviceReturns401() throws Exception {
        when(biolockDeviceRepository.findByIdAndStatus(deviceId, DeviceStatus.ACTIVE))
                .thenReturn(Optional.empty());

        String nonce = randomNonce();
        String timestamp = String.valueOf(now.getEpochSecond());
        String path = "/api/device/biolock/jobs/next";

        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.addHeader("X-Device-Id", deviceId.toString());
        request.addHeader("X-Timestamp", timestamp);
        request.addHeader("X-Nonce", nonce);
        request.addHeader("X-Signature", "c".repeat(64));

        MockHttpServletResponse response = new MockHttpServletResponse();

        deviceAuthFilter.doFilter(request, response, filterChain);

        assertThat(response.getStatus()).isEqualTo(401);
        verify(filterChain, never()).doFilter(any(), any());
    }

    @Test
    @DisplayName("Missing authentication headers return 401")
    void testMissingHeadersReturns401() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/device/biolock/jobs/next");
        MockHttpServletResponse response = new MockHttpServletResponse();

        deviceAuthFilter.doFilter(request, response, filterChain);

        assertThat(response.getStatus()).isEqualTo(401);
        verify(filterChain, never()).doFilter(any(), any());
    }
}
