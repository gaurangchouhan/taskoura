package com.taskoura.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.config.BiolockProperties;
import com.taskoura.dto.BioLockDtos.*;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.entity.*;
import com.taskoura.repository.*;
import com.taskoura.security.JwtUtil;
import com.taskoura.security.biolock.DeviceKeyService;
import com.taskoura.service.BioLockDeviceService;
import com.taskoura.service.ProjectService;
import com.taskoura.service.SessionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class BioLockDeviceAndJobIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private SessionService sessionService;
    @Autowired private Clock clock;

    @Autowired private UserRepository userRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private BiolockDeviceRepository biolockDeviceRepository;
    @Autowired private BiometricCredentialRepository biometricCredentialRepository;
    @Autowired private ProjectBiometricSettingRepository projectBiometricSettingRepository;
    @Autowired private BiolockJobRepository biolockJobRepository;
    @Autowired private DocumentAccessRequestRepository documentAccessRequestRepository;

    @Autowired private BiolockProperties biolockProperties;
    @Autowired private DeviceKeyService deviceKeyService;
    @Autowired private BioLockDeviceService bioLockDeviceService;
    @Autowired private ProjectService projectService;

    @MockitoBean private JavaMailSender mailSender;

    private User leader1;
    private User leader2;
    private String token1;
    private String token2;
    private String masterKeyBase64;

    @BeforeEach
    void setUp() {
        masterKeyBase64 = Base64.getEncoder().encodeToString("01234567890123456789012345678901".getBytes());
        biolockProperties.setEnabled(true);
        biolockProperties.setDeviceMasterKey(masterKeyBase64);
        biolockProperties.setDeviceOnlineSeconds(30);
        biolockProperties.setCleanupGraceMinutes(0);

        leader1 = userRepository.save(User.builder()
                .name("Leader Alice")
                .email("alice-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());

        leader2 = userRepository.save(User.builder()
                .name("Leader Bob")
                .email("bob-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());

        token1 = createToken(leader1);
        token2 = createToken(leader2);
    }

    private String createToken(User user) {
        var s = sessionService.createSession(user, "TestAgent");
        return jwtUtil.generateToken(user.getEmail(), s.getId(), s.getAbsoluteExpiresAt());
    }

    private String randomNonce() {
        byte[] bytes = new byte[16];
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private void addDeviceHeaders(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder req,
                                  UUID deviceId,
                                  String deviceKeyHex,
                                  String method,
                                  String path,
                                  byte[] body) {
        String timestamp = String.valueOf(clock.instant().getEpochSecond());
        String nonce = randomNonce();
        String signature = deviceKeyService.calculateRequestSignature(deviceKeyHex, method, path, timestamp, nonce, body);

        req.header("X-Device-Id", deviceId.toString())
           .header("X-Timestamp", timestamp)
           .header("X-Nonce", nonce)
           .header("X-Signature", signature);
    }

    @Test
    @DisplayName("Feature flag off returns BIOLOCK_DISABLED")
    void testFeatureFlagOffReturnsBiolockDisabled() throws Exception {
        biolockProperties.setEnabled(false);

        mockMvc.perform(post("/api/biolock/devices")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("BIOLOCK_DISABLED")));
    }

    @Test
    @DisplayName("Device registration returns deviceId and deviceKey; cannot register duplicate active device")
    void testDeviceRegistrationAndDuplicatePrevention() throws Exception {
        var res = mockMvc.perform(post("/api/biolock/devices")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"ESP32 Lab\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.deviceId", notNullValue()))
                .andExpect(jsonPath("$.deviceKey", notNullValue()))
                .andReturn();

        DeviceRegistrationResponse reg = objectMapper.readValue(res.getResponse().getContentAsString(), DeviceRegistrationResponse.class);
        assertThat(reg.deviceId()).isNotNull();
        assertThat(reg.deviceKey()).hasSize(64);

        // Attempting to register another active device fails with 409
        mockMvc.perform(post("/api/biolock/devices")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Second Scanner\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Key rotation produces new deviceKey; old key signature is rejected")
    void testDeviceKeyRotation() throws Exception {
        var regRes = mockMvc.perform(post("/api/biolock/devices")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"ESP32 Lab\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        DeviceRegistrationResponse reg = objectMapper.readValue(regRes.getResponse().getContentAsString(), DeviceRegistrationResponse.class);

        var rotRes = mockMvc.perform(post("/api/biolock/devices/" + reg.deviceId() + "/rotate-key")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keyVersion", is(2)))
                .andReturn();
        DeviceRotateKeyResponse rot = objectMapper.readValue(rotRes.getResponse().getContentAsString(), DeviceRotateKeyResponse.class);
        assertThat(rot.deviceKey()).isNotEqualTo(reg.deviceKey());

        // Polling with old key returns 401
        var oldReq = get("/api/device/biolock/jobs/next");
        addDeviceHeaders(oldReq, reg.deviceId(), reg.deviceKey(), "GET", "/api/device/biolock/jobs/next", new byte[0]);
        mockMvc.perform(oldReq).andExpect(status().isUnauthorized());

        // Polling with new key succeeds (returns 204 when no jobs)
        var newReq = get("/api/device/biolock/jobs/next");
        addDeviceHeaders(newReq, reg.deviceId(), rot.deviceKey(), "GET", "/api/device/biolock/jobs/next", new byte[0]);
        mockMvc.perform(newReq).andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("Revoked device returns 401")
    void testDeviceRevocation() throws Exception {
        var regRes = mockMvc.perform(post("/api/biolock/devices")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"ESP32 Lab\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        DeviceRegistrationResponse reg = objectMapper.readValue(regRes.getResponse().getContentAsString(), DeviceRegistrationResponse.class);

        mockMvc.perform(delete("/api/biolock/devices/" + reg.deviceId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1))
                .andExpect(status().isNoContent());

        var req = get("/api/device/biolock/jobs/next");
        addDeviceHeaders(req, reg.deviceId(), reg.deviceKey(), "GET", "/api/device/biolock/jobs/next", new byte[0]);
        mockMvc.perform(req).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Rate limiting device polling returns 429 with Retry-After header")
    void testDevicePollingRateLimiting() throws Exception {
        var regRes = mockMvc.perform(post("/api/biolock/devices")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"ESP32 Lab\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        DeviceRegistrationResponse reg = objectMapper.readValue(regRes.getResponse().getContentAsString(), DeviceRegistrationResponse.class);

        // First poll succeeds (204)
        var req1 = get("/api/device/biolock/jobs/next");
        addDeviceHeaders(req1, reg.deviceId(), reg.deviceKey(), "GET", "/api/device/biolock/jobs/next", new byte[0]);
        mockMvc.perform(req1).andExpect(status().isNoContent());

        // Immediate second poll fails with 429 and Retry-After: 2
        var req2 = get("/api/device/biolock/jobs/next");
        addDeviceHeaders(req2, reg.deviceId(), reg.deviceKey(), "GET", "/api/device/biolock/jobs/next", new byte[0]);
        mockMvc.perform(req2)
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string(HttpHeaders.RETRY_AFTER, "2"))
                .andExpect(jsonPath("$.code", is("BIOLOCK_RATE_LIMITED")));
    }

    @Test
    @DisplayName("Enrollment flow: start enrollment, device claims job and submits result with proof, creating active credential")
    void testEnrollmentFullFlow() throws Exception {
        var regRes = mockMvc.perform(post("/api/biolock/devices")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Scanner 1\"}"))
                .andReturn();
        DeviceRegistrationResponse reg = objectMapper.readValue(regRes.getResponse().getContentAsString(), DeviceRegistrationResponse.class);

        // Poll once so device is seen online
        var ping = get("/api/device/biolock/jobs/next");
        addDeviceHeaders(ping, reg.deviceId(), reg.deviceKey(), "GET", "/api/device/biolock/jobs/next", new byte[0]);
        mockMvc.perform(ping).andExpect(status().isNoContent());

        // Leader starts enrollment
        var enrRes = mockMvc.perform(post("/api/biolock/enrollment")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.jobId", notNullValue()))
                .andReturn();
        EnrollmentResponse enr = objectMapper.readValue(enrRes.getResponse().getContentAsString(), EnrollmentResponse.class);

        // Leader cannot start second enrollment while one is in progress
        mockMvc.perform(post("/api/biolock/enrollment")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code", is("BIOLOCK_REQUEST_ACTIVE")));

        // Device claims the job (resetting poll timer in test)
        BiolockJob job = biolockJobRepository.findById(enr.jobId()).orElseThrow();
        assertThat(job.getStatus()).isEqualTo(JobStatus.QUEUED);
        assertThat(job.getType()).isEqualTo(JobType.ENROLL);

        // Device submits ENROLLED outcome with slot 1 and HMAC proof
        Integer slot = 1;
        String proof = deviceKeyService.calculateProofHex(reg.deviceKey(), job.getId(), job.getChallenge(), "ENROLLED", slot);
        BioLockJobResultRequest resultReq = new BioLockJobResultRequest("ENROLLED", slot, null, null, null, proof);
        byte[] body = objectMapper.writeValueAsBytes(resultReq);

        var submitReq = post("/api/device/biolock/jobs/" + job.getId() + "/result")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body);
        addDeviceHeaders(submitReq, reg.deviceId(), reg.deviceKey(), "POST", "/api/device/biolock/jobs/" + job.getId() + "/result", body);
        mockMvc.perform(submitReq).andExpect(status().isOk());

        // Verify credential created
        List<BiometricCredential> creds = biometricCredentialRepository.findByUserIdAndStatusNot(leader1.getId(), CredentialStatus.DELETED);
        assertThat(creds).hasSize(1);
        assertThat(creds.get(0).getStatus()).isEqualTo(CredentialStatus.ACTIVE);
        assertThat(creds.get(0).getSensorSlotId()).isEqualTo(1);

        // Browser polling shows COMPLETED
        mockMvc.perform(get("/api/biolock/enrollment/" + job.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("COMPLETED")))
                .andExpect(jsonPath("$.outcome", is("ENROLLED")));

        // Duplicate submission returns OK and changes nothing
        var dupReq = post("/api/device/biolock/jobs/" + job.getId() + "/result")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body);
        addDeviceHeaders(dupReq, reg.deviceId(), reg.deviceKey(), "POST", "/api/device/biolock/jobs/" + job.getId() + "/result", body);
        mockMvc.perform(dupReq).andExpect(status().isOk());

        // Conflicting result on closed job returns 409
        BioLockJobResultRequest diffResult = new BioLockJobResultRequest("FAILED", null, null, null, "error", null);
        byte[] diffBody = objectMapper.writeValueAsBytes(diffResult);
        var diffReq = post("/api/device/biolock/jobs/" + job.getId() + "/result")
                .contentType(MediaType.APPLICATION_JSON)
                .content(diffBody);
        addDeviceHeaders(diffReq, reg.deviceId(), reg.deviceKey(), "POST", "/api/device/biolock/jobs/" + job.getId() + "/result", diffBody);
        mockMvc.perform(diffReq).andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Two devices cannot claim one job and device cannot submit result for another device's job")
    void testDeviceIsolationOnJobs() throws Exception {
        // Register device 1
        var reg1 = objectMapper.readValue(mockMvc.perform(post("/api/biolock/devices")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Dev 1\"}")).andReturn().getResponse().getContentAsString(), DeviceRegistrationResponse.class);

        // Register device 2 for leader 2
        var reg2 = objectMapper.readValue(mockMvc.perform(post("/api/biolock/devices")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token2)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Dev 2\"}")).andReturn().getResponse().getContentAsString(), DeviceRegistrationResponse.class);

        // Create job for device 1
        BiolockJob job = new BiolockJob();
        job.setType(JobType.ENROLL);
        job.setStatus(JobStatus.QUEUED);
        job.setDeviceId(reg1.deviceId());
        job.setChallenge("abc123challenge");
        job.setCreatedAt(clock.instant());
        job.setExpiresAt(clock.instant().plusSeconds(180));
        job = biolockJobRepository.save(job);

        // Device 2 claims next job -> should return 204 No Content
        var claimReq2 = get("/api/device/biolock/jobs/next");
        addDeviceHeaders(claimReq2, reg2.deviceId(), reg2.deviceKey(), "GET", "/api/device/biolock/jobs/next", new byte[0]);
        mockMvc.perform(claimReq2).andExpect(status().isNoContent());

        // Device 2 attempts to submit result for job 1 -> 403 Forbidden
        BioLockJobResultRequest resultReq = new BioLockJobResultRequest("FAILED", null, null, null, "hack", null);
        byte[] body = objectMapper.writeValueAsBytes(resultReq);
        var submitReq2 = post("/api/device/biolock/jobs/" + job.getId() + "/result")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body);
        addDeviceHeaders(submitReq2, reg2.deviceId(), reg2.deviceKey(), "POST", "/api/device/biolock/jobs/" + job.getId() + "/result", body);
        mockMvc.perform(submitReq2).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Project settings, multi-project reuse, and deletion hook lifecycle")
    void testProjectSettingsAndDeletionLifecycle() throws Exception {
        // Setup device and credential for leader 1
        var reg = objectMapper.readValue(mockMvc.perform(post("/api/biolock/devices")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Scanner\"}")).andReturn().getResponse().getContentAsString(), DeviceRegistrationResponse.class);

        BiometricCredential cred = BiometricCredential.builder()
                .userId(leader1.getId())
                .deviceId(reg.deviceId())
                .sensorSlotId(1)
                .status(CredentialStatus.ACTIVE)
                .enrolledAt(clock.instant())
                .createdAt(clock.instant())
                .updatedAt(clock.instant())
                .build();
        cred = biometricCredentialRepository.save(cred);

        // Create two projects for leader 1
        ProjectResponse p1 = projectService.createProject(leader1.getEmail(),
                new CreateProjectRequest("Project Alpha", "Desc", "React", "Spring", "PG", "JUnit", LocalDate.now().plusMonths(1)));
        ProjectResponse p2 = projectService.createProject(leader1.getEmail(),
                new CreateProjectRequest("Project Beta", "Desc", "React", "Spring", "PG", "JUnit", LocalDate.now().plusMonths(1)));

        // Enabling BioLock on Project Alpha links credential
        mockMvc.perform(put("/api/projects/" + p1.id() + "/biolock")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"enabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled", is(true)))
                .andExpect(jsonPath("$.credentialId", is(cred.getId().toString())));

        // Enabling BioLock on Project Beta reuses the same credential
        mockMvc.perform(put("/api/projects/" + p2.id() + "/biolock")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"enabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled", is(true)))
                .andExpect(jsonPath("$.credentialId", is(cred.getId().toString())));

        // Delete credential while projects still use it -> 409
        mockMvc.perform(delete("/api/biolock/credential")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1))
                .andExpect(status().isConflict());

        // Deleting Project Alpha keeps credential ACTIVE because Project Beta still uses it
        projectService.deleteProject(p1.id(), leader1.getEmail());
        BiometricCredential credAfterFirstDelete = biometricCredentialRepository.findById(cred.getId()).orElseThrow();
        assertThat(credAfterFirstDelete.getStatus()).isEqualTo(CredentialStatus.ACTIVE);

        // Deleting Project Beta (the last project):
        // With grace = 0, moves to PENDING_DELETE and enqueues DELETE_TEMPLATE job
        projectService.deleteProject(p2.id(), leader1.getEmail());
        BiometricCredential credAfterSecondDelete = biometricCredentialRepository.findById(cred.getId()).orElseThrow();
        assertThat(credAfterSecondDelete.getStatus()).isEqualTo(CredentialStatus.PENDING_DELETE);

        // Verify DELETE_TEMPLATE job enqueued
        List<BiolockJob> delJobs = biolockJobRepository.findByDeviceIdAndStatus(reg.deviceId(), JobStatus.QUEUED);
        assertThat(delJobs).anyMatch(j -> j.getType() == JobType.DELETE_TEMPLATE && j.getSlot() == 1);
        BiolockJob delJob = delJobs.stream().filter(j -> j.getType() == JobType.DELETE_TEMPLATE).findFirst().orElseThrow();

        // While device is offline, credential stays PENDING_DELETE
        assertThat(biometricCredentialRepository.findById(cred.getId()).orElseThrow().getStatus()).isEqualTo(CredentialStatus.PENDING_DELETE);

        // Device comes online and submits DELETED outcome with proof
        String proof = deviceKeyService.calculateProofHex(reg.deviceKey(), delJob.getId(), delJob.getChallenge(), "DELETED", 1);
        BioLockJobResultRequest delResult = new BioLockJobResultRequest("DELETED", 1, null, null, null, proof);
        byte[] delBody = objectMapper.writeValueAsBytes(delResult);

        var submitDel = post("/api/device/biolock/jobs/" + delJob.getId() + "/result")
                .contentType(MediaType.APPLICATION_JSON)
                .content(delBody);
        addDeviceHeaders(submitDel, reg.deviceId(), reg.deviceKey(), "POST", "/api/device/biolock/jobs/" + delJob.getId() + "/result", delBody);
        mockMvc.perform(submitDel).andExpect(status().isOk());

        // Only after device confirmation is it marked DELETED
        assertThat(biometricCredentialRepository.findById(cred.getId()).orElseThrow().getStatus()).isEqualTo(CredentialStatus.DELETED);
    }

    @Test
    @DisplayName("Status endpoint returns device, online status, and credential")
    void testStatusEndpoint() throws Exception {
        var reg = objectMapper.readValue(mockMvc.perform(post("/api/biolock/devices")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Lab Scanner\"}")).andReturn().getResponse().getContentAsString(), DeviceRegistrationResponse.class);

        // Update device lastSeenAt to now so it's online
        BiolockDevice dev = biolockDeviceRepository.findById(reg.deviceId()).orElseThrow();
        dev.setLastSeenAt(clock.instant());
        biolockDeviceRepository.save(dev);

        biometricCredentialRepository.save(BiometricCredential.builder()
                .userId(leader1.getId())
                .deviceId(reg.deviceId())
                .sensorSlotId(3)
                .status(CredentialStatus.ACTIVE)
                .enrolledAt(clock.instant())
                .createdAt(clock.instant())
                .updatedAt(clock.instant())
                .build());

        mockMvc.perform(get("/api/biolock/status")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled", is(true)))
                .andExpect(jsonPath("$.device.id", is(reg.deviceId().toString())))
                .andExpect(jsonPath("$.device.online", is(true)))
                .andExpect(jsonPath("$.credential.slot", is(3)))
                .andExpect(jsonPath("$.credential.status", is("ACTIVE")));
    }
}
