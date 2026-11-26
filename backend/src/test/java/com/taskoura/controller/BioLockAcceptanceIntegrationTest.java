package com.taskoura.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.config.BiolockProperties;
import com.taskoura.dto.AttachmentDtos.AttachmentResponse;
import com.taskoura.dto.AttachmentDtos.DocumentAccessRequestResponse;
import com.taskoura.dto.BioLockDtos.*;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.entity.*;
import com.taskoura.repository.*;
import com.taskoura.security.JwtUtil;
import com.taskoura.security.biolock.DeviceKeyService;
import com.taskoura.service.AttachmentStorageService;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * MODULE BL-7: End-to-End Acceptance Test Suite.
 * Validates Scenarios 1 through 8 strictly matching the Taskoura BioLock CONTRACT.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class BioLockAcceptanceIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private SessionService sessionService;
    @Autowired private Clock clock;

    @Autowired private UserRepository userRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private ProjectMemberRepository projectMemberRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private AttachmentRepository attachmentRepository;
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
    @MockitoBean private AttachmentStorageService attachmentStorageService;

    private User leaderA;
    private User leaderB;
    private User memberUser;
    private User outsideUser;

    private String leaderAToken;
    private String leaderBToken;
    private String memberToken;
    private String outsideToken;

    private String masterKeyBase64;

    @BeforeEach
    void setUp() {
        masterKeyBase64 = Base64.getEncoder().encodeToString("01234567890123456789012345678901".getBytes());
        biolockProperties.setEnabled(true);
        biolockProperties.setDeviceMasterKey(masterKeyBase64);
        biolockProperties.setRequestTtlSeconds(120);
        biolockProperties.setAccessTtlMinutes(15);
        biolockProperties.setJobLeaseSeconds(60);
        biolockProperties.setDeviceOnlineSeconds(30);
        biolockProperties.setMaxRequestsPerDocPerHour(5);
        biolockProperties.setCleanupGraceMinutes(0);
        biolockProperties.setEmailOnRequest(true);

        when(attachmentStorageService.downloadFile(anyString()))
                .thenReturn("Protected document content bytes".getBytes(StandardCharsets.UTF_8));
        when(attachmentStorageService.downloadFileStream(anyString()))
                .thenAnswer(inv -> new ByteArrayInputStream("Protected document content bytes".getBytes(StandardCharsets.UTF_8)));

        leaderA = userRepository.save(User.builder()
                .name("Leader Alice")
                .email("alice-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());

        leaderB = userRepository.save(User.builder()
                .name("Leader Bob")
                .email("bob-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());

        memberUser = userRepository.save(User.builder()
                .name("Member Charlie")
                .email("charlie-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());

        outsideUser = userRepository.save(User.builder()
                .name("Eve Outside")
                .email("eve-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());

        leaderAToken = createToken(leaderA);
        leaderBToken = createToken(leaderB);
        memberToken = createToken(memberUser);
        outsideToken = createToken(outsideUser);
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

    private void addDeviceHeaders(MockHttpServletRequestBuilder req,
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

    // =========================================================================
    // SCENARIO 1: Register Device, Enroll Fingerprint, Create Protected Project A
    // =========================================================================
    @Test
    @DisplayName("Scenario 1: Register device, enroll, and create Project A with protection")
    void scenario1_registerEnrollAndCreateProtectedProject() throws Exception {
        // 1. Leader Alice registers device
        var regRes = mockMvc.perform(post("/api/biolock/devices")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + leaderAToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Alice ESP32 Desk\"}"))
                .andExpect(status().isCreated())
                .andReturn();

        DeviceRegistrationResponse reg = objectMapper.readValue(regRes.getResponse().getContentAsString(), DeviceRegistrationResponse.class);
        UUID deviceId = reg.deviceId();
        String deviceKey = reg.deviceKey();

        // 2. Device heartbeats via GET /jobs/next -> device is online
        var pingReq = get("/api/device/biolock/jobs/next");
        addDeviceHeaders(pingReq, deviceId, deviceKey, "GET", "/api/device/biolock/jobs/next", new byte[0]);
        mockMvc.perform(pingReq).andExpect(status().isNoContent());

        // Respect 2-second device polling minimum interval
        Thread.sleep(2100);

        // 3. Alice initiates fingerprint enrollment
        var enrollRes = mockMvc.perform(post("/api/biolock/enrollment")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + leaderAToken))
                .andExpect(status().isCreated())
                .andReturn();

        EnrollmentResponse enrollJob = objectMapper.readValue(enrollRes.getResponse().getContentAsString(), EnrollmentResponse.class);
        UUID jobId = enrollJob.jobId();

        // 4. Device polls and claims ENROLL job
        var claimReq = get("/api/device/biolock/jobs/next");
        addDeviceHeaders(claimReq, deviceId, deviceKey, "GET", "/api/device/biolock/jobs/next", new byte[0]);
        var nextJobRes = mockMvc.perform(claimReq)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type", is("ENROLL")))
                .andReturn();

        DeviceJobResponse claimedJob = objectMapper.readValue(nextJobRes.getResponse().getContentAsString(), DeviceJobResponse.class);

        // 5. Device submits result: ENROLLED in slot 1 with HMAC proof
        String proof = deviceKeyService.calculateProofHex(deviceKey, claimedJob.jobId(), claimedJob.challenge(), "ENROLLED", 1);
        BioLockJobResultRequest resultReq = new BioLockJobResultRequest("ENROLLED", 1, 1, 100, null, proof);
        byte[] resultBody = objectMapper.writeValueAsBytes(resultReq);

        var submitReq = post("/api/device/biolock/jobs/" + jobId + "/result")
                .contentType(MediaType.APPLICATION_JSON)
                .content(resultBody);
        addDeviceHeaders(submitReq, deviceId, deviceKey, "POST", "/api/device/biolock/jobs/" + jobId + "/result", resultBody);
        mockMvc.perform(submitReq).andExpect(status().isOk());

        // Credential is now ACTIVE with sensorSlotId = 1
        var cred = biometricCredentialRepository.findByUserIdAndStatus(leaderA.getId(), CredentialStatus.ACTIVE);
        assertThat(cred).isPresent();
        assertThat(cred.get().getSensorSlotId()).isEqualTo(1);

        // 6. Alice creates Project A with protection
        Project projectA = projectRepository.save(Project.builder()
                .name("Project Alpha")
                .owner(leaderA)
                .build());

        mockMvc.perform(put("/api/projects/" + projectA.getId() + "/biolock")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + leaderAToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"enabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled", is(true)))
                .andExpect(jsonPath("$.credentialId", is(cred.get().getId().toString())));

        var setting = projectBiometricSettingRepository.findByProjectId(projectA.getId());
        assertThat(setting).isPresent();
        assertThat(setting.get().isEnabled()).isTrue();
    }

    // =========================================================================
    // SCENARIO 2: Projects B and C Reuse Credential (1 Template for Leader)
    // =========================================================================
    @Test
    @DisplayName("Scenario 2: Projects B and C reuse the credential, no new enrollment, 1 template in sensor")
    void scenario2_multipleProjectsReuseSameCredential() throws Exception {
        // Setup Alice's active credential in slot 1
        BiolockDevice dev = biolockDeviceRepository.save(BiolockDevice.builder()
                .ownerUserId(leaderA.getId())
                .name("Alice Scanner")
                .status(DeviceStatus.ACTIVE)
                .keyVersion(1)
                .lastSeenAt(clock.instant())
                .build());

        BiometricCredential cred = biometricCredentialRepository.save(BiometricCredential.builder()
                .userId(leaderA.getId())
                .deviceId(dev.getId())
                .sensorSlotId(1)
                .status(CredentialStatus.ACTIVE)
                .enrolledAt(clock.instant())
                .build());

        // Create Project B & Project C
        Project projB = projectRepository.save(Project.builder().name("Project Beta").owner(leaderA).build());
        Project projC = projectRepository.save(Project.builder().name("Project Gamma").owner(leaderA).build());

        // Enable BioLock on Project B
        mockMvc.perform(put("/api/projects/" + projB.getId() + "/biolock")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + leaderAToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"enabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.credentialId", is(cred.getId().toString())));

        // Enable BioLock on Project C
        mockMvc.perform(put("/api/projects/" + projC.getId() + "/biolock")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + leaderAToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"enabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.credentialId", is(cred.getId().toString())));

        // Verify that sensor holds only 1 credential row for Alice
        Optional<BiometricCredential> activeCred = biometricCredentialRepository.findByUserIdAndStatus(leaderA.getId(), CredentialStatus.ACTIVE);
        assertThat(activeCred).isPresent();
        assertThat(activeCred.get().getSensorSlotId()).isEqualTo(1);
    }

    // =========================================================================
    // SCENARIO 3: Second Leader Gets Different Slot & Cannot Use Leader 1's Credential
    // =========================================================================
    @Test
    @DisplayName("Scenario 3: Second leader gets different slot and cannot use first leader's credential")
    void scenario3_secondLeaderIsolation() throws Exception {
        // Leader 1 (Alice) has slot 1
        BiolockDevice devA = biolockDeviceRepository.save(BiolockDevice.builder()
                .ownerUserId(leaderA.getId())
                .name("Alice Scanner")
                .status(DeviceStatus.ACTIVE)
                .keyVersion(1)
                .lastSeenAt(clock.instant())
                .build());

        BiometricCredential credA = biometricCredentialRepository.save(BiometricCredential.builder()
                .userId(leaderA.getId())
                .deviceId(devA.getId())
                .sensorSlotId(1)
                .status(CredentialStatus.ACTIVE)
                .enrolledAt(clock.instant())
                .build());

        // Leader 2 (Bob) registers and enrolls
        BiolockDevice devB = biolockDeviceRepository.save(BiolockDevice.builder()
                .ownerUserId(leaderB.getId())
                .name("Bob Scanner")
                .status(DeviceStatus.ACTIVE)
                .keyVersion(1)
                .lastSeenAt(clock.instant())
                .build());

        BiometricCredential credB = biometricCredentialRepository.save(BiometricCredential.builder()
                .userId(leaderB.getId())
                .deviceId(devB.getId())
                .sensorSlotId(2)
                .status(CredentialStatus.ACTIVE)
                .enrolledAt(clock.instant())
                .build());

        Project projBob = projectRepository.save(Project.builder().name("Bob Project").owner(leaderB).build());

        // Bob enabling BioLock gets his OWN credential (credB, slot 2)
        mockMvc.perform(put("/api/projects/" + projBob.getId() + "/biolock")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + leaderBToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"enabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.credentialId", is(credB.getId().toString())));

        // Alice cannot modify Bob's project biolock
        mockMvc.perform(put("/api/projects/" + projBob.getId() + "/biolock")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + leaderAToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"enabled\":false}"))
                .andExpect(status().isForbidden());
    }

    // =========================================================================
    // SCENARIO 4: Full Member Request, Verification, 15-Minute Expiry
    // =========================================================================
    @Test
    @DisplayName("Scenario 4: Member requests access, leader approves with finger, member streams, then locks")
    void scenario4_fullAccessRequestAnd15MinExpiry() throws Exception {
        // Setup Project, Device, Credential
        Project project = projectRepository.save(Project.builder().name("Secure Alpha").owner(leaderA).build());
        projectMemberRepository.save(ProjectMember.builder().project(project).user(memberUser).role("Member").build());

        BiolockDevice dev = biolockDeviceRepository.save(BiolockDevice.builder()
                .ownerUserId(leaderA.getId())
                .name("Alice Scanner")
                .status(DeviceStatus.ACTIVE)
                .keyVersion(1)
                .lastSeenAt(clock.instant())
                .build());

        String devKey = deviceKeyService.deriveDeviceKeyHex(dev.getId(), 1);

        BiometricCredential cred = biometricCredentialRepository.save(BiometricCredential.builder()
                .userId(leaderA.getId())
                .deviceId(dev.getId())
                .sensorSlotId(1)
                .status(CredentialStatus.ACTIVE)
                .enrolledAt(clock.instant())
                .build());

        projectBiometricSettingRepository.save(ProjectBiometricSetting.builder()
                .projectId(project.getId())
                .credentialId(cred.getId())
                .enabled(true)
                .build());

        Task task = taskRepository.save(Task.builder()
                .project(project)
                .title("Task 1")
                .status("IN_PROGRESS")
                .build());

        Attachment att = attachmentRepository.save(Attachment.builder()
                .task(task)
                .uploadedBy(memberUser)
                .fileName("secret_blueprints.pdf")
                .fileType("application/pdf")
                .fileUrl("https://res.cloudinary.com/taskoura/raw/upload/secret.pdf")
                .restricted(true)
                .build());

        // 1. Member lists attachments: restricted = true, locked = true, fileUrl masked (null)
        var listRes = mockMvc.perform(get("/api/tasks/" + task.getId() + "/attachments")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andReturn();

        AttachmentResponse[] attachments = objectMapper.readValue(listRes.getResponse().getContentAsString(), AttachmentResponse[].class);
        assertThat(attachments[0].restricted()).isTrue();
        assertThat(attachments[0].locked()).isTrue();
        assertThat(attachments[0].fileUrl()).isNull();

        // 2. Member tries to stream /content -> 403 BIOLOCK_ACCESS_REQUIRED
        mockMvc.perform(get("/api/attachments/" + att.getId() + "/content")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + memberToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code", is("BIOLOCK_ACCESS_REQUIRED")));

        // 3. Member submits access request
        var reqRes = mockMvc.perform(post("/api/attachments/" + att.getId() + "/access-request")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + memberToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status", is("PENDING")))
                .andReturn();

        DocumentAccessRequestResponse accessReq = objectMapper.readValue(reqRes.getResponse().getContentAsString(), DocumentAccessRequestResponse.class);

        // 4. Device claims VERIFY_ACCESS job
        var claimReq = get("/api/device/biolock/jobs/next");
        addDeviceHeaders(claimReq, dev.getId(), devKey, "GET", "/api/device/biolock/jobs/next", new byte[0]);
        var nextJobRes = mockMvc.perform(claimReq)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type", is("VERIFY_ACCESS")))
                .andExpect(jsonPath("$.expectedSlot", is(1)))
                .andReturn();

        DeviceJobResponse claimedJob = objectMapper.readValue(nextJobRes.getResponse().getContentAsString(), DeviceJobResponse.class);

        // 5. Device submits MATCH proof for slot 1
        String proof = deviceKeyService.calculateProofHex(devKey, claimedJob.jobId(), claimedJob.challenge(), "MATCH", 1);
        BioLockJobResultRequest resultReq = new BioLockJobResultRequest("MATCH", 1, 1, 100, null, proof);
        byte[] resultBody = objectMapper.writeValueAsBytes(resultReq);

        var submitReq = post("/api/device/biolock/jobs/" + claimedJob.jobId() + "/result")
                .contentType(MediaType.APPLICATION_JSON)
                .content(resultBody);
        addDeviceHeaders(submitReq, dev.getId(), devKey, "POST", "/api/device/biolock/jobs/" + claimedJob.jobId() + "/result", resultBody);
        mockMvc.perform(submitReq).andExpect(status().isOk());

        // 6. Access request is now APPROVED
        mockMvc.perform(get("/api/attachments/" + att.getId() + "/access")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state", is("APPROVED")));

        // 7. Member can now stream /content
        var streamResult = mockMvc.perform(get("/api/attachments/" + att.getId() + "/content")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(request().asyncStarted())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andReturn();

        mockMvc.perform(asyncDispatch(streamResult))
                .andExpect(status().isOk())
                .andExpect(content().string("Protected document content bytes"));

        // 8. When grant expires (> 15 minutes), access auto-locks
        DocumentAccessRequest dar = documentAccessRequestRepository.findById(accessReq.requestId()).orElseThrow();
        dar.setAccessExpiresAt(clock.instant().minusSeconds(1));
        documentAccessRequestRepository.save(dar);

        mockMvc.perform(get("/api/attachments/" + att.getId() + "/content")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + memberToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code", is("BIOLOCK_ACCESS_REQUIRED")));
    }

    // =========================================================================
    // SCENARIO 5: Wrong Finger and No Finger Never Approve
    // =========================================================================
    @Test
    @DisplayName("Scenario 5: Wrong finger (WRONG_FINGER) and no finger (NO_MATCH/TIMEOUT) never approve")
    void scenario5_wrongFingerNeverApproves() throws Exception {
        Project project = projectRepository.save(Project.builder().name("Secure Proj").owner(leaderA).build());
        projectMemberRepository.save(ProjectMember.builder().project(project).user(memberUser).role("Member").build());

        BiolockDevice dev = biolockDeviceRepository.save(BiolockDevice.builder()
                .ownerUserId(leaderA.getId())
                .name("Alice Scanner")
                .status(DeviceStatus.ACTIVE)
                .keyVersion(1)
                .lastSeenAt(clock.instant())
                .build());

        String devKey = deviceKeyService.deriveDeviceKeyHex(dev.getId(), 1);

        BiometricCredential cred = biometricCredentialRepository.save(BiometricCredential.builder()
                .userId(leaderA.getId())
                .deviceId(dev.getId())
                .sensorSlotId(1)
                .status(CredentialStatus.ACTIVE)
                .enrolledAt(clock.instant())
                .build());

        projectBiometricSettingRepository.save(ProjectBiometricSetting.builder()
                .projectId(project.getId())
                .credentialId(cred.getId())
                .enabled(true)
                .build());

        Task task = taskRepository.save(Task.builder()
                .project(project)
                .title("Task 1")
                .status("IN_PROGRESS")
                .build());

        Attachment att = attachmentRepository.save(Attachment.builder()
                .task(task)
                .uploadedBy(memberUser)
                .fileName("plan.pdf")
                .fileType("application/pdf")
                .fileUrl("https://res.cloudinary.com/test.pdf")
                .restricted(true)
                .build());

        // A. Wrong Finger (WRONG_FINGER on slot 99)
        mockMvc.perform(post("/api/attachments/" + att.getId() + "/access-request")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + memberToken))
                .andExpect(status().isCreated());

        var claim1 = get("/api/device/biolock/jobs/next");
        addDeviceHeaders(claim1, dev.getId(), devKey, "GET", "/api/device/biolock/jobs/next", new byte[0]);
        var job1Res = mockMvc.perform(claim1).andExpect(status().isOk()).andReturn();

        DeviceJobResponse job1 = objectMapper.readValue(job1Res.getResponse().getContentAsString(), DeviceJobResponse.class);
        String proofWrong = deviceKeyService.calculateProofHex(devKey, job1.jobId(), job1.challenge(), "WRONG_FINGER", 99);
        BioLockJobResultRequest reqWrong = new BioLockJobResultRequest("WRONG_FINGER", 99, 99, 50, null, proofWrong);
        byte[] bodyWrong = objectMapper.writeValueAsBytes(reqWrong);

        var submit1 = post("/api/device/biolock/jobs/" + job1.jobId() + "/result")
                .contentType(MediaType.APPLICATION_JSON)
                .content(bodyWrong);
        addDeviceHeaders(submit1, dev.getId(), devKey, "POST", "/api/device/biolock/jobs/" + job1.jobId() + "/result", bodyWrong);
        mockMvc.perform(submit1).andExpect(status().isOk());

        // Access is DENIED
        mockMvc.perform(get("/api/attachments/" + att.getId() + "/access")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state", is("DENIED")));

        // B. No Finger (TIMEOUT)
        // Respect 2-second device polling minimum interval
        Thread.sleep(2100);

        Attachment att2 = attachmentRepository.save(Attachment.builder()
                .task(task)
                .uploadedBy(memberUser)
                .fileName("plan2.pdf")
                .fileType("application/pdf")
                .fileUrl("https://res.cloudinary.com/test2.pdf")
                .restricted(true)
                .build());

        mockMvc.perform(post("/api/attachments/" + att2.getId() + "/access-request")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + memberToken))
                .andExpect(status().isCreated());

        var claim2 = get("/api/device/biolock/jobs/next");
        addDeviceHeaders(claim2, dev.getId(), devKey, "GET", "/api/device/biolock/jobs/next", new byte[0]);
        var job2Res = mockMvc.perform(claim2).andExpect(status().isOk()).andReturn();

        DeviceJobResponse job2 = objectMapper.readValue(job2Res.getResponse().getContentAsString(), DeviceJobResponse.class);
        String proofTimeout = deviceKeyService.calculateProofHex(devKey, job2.jobId(), job2.challenge(), "TIMEOUT", null);
        BioLockJobResultRequest reqTimeout = new BioLockJobResultRequest("TIMEOUT", null, null, null, null, proofTimeout);
        byte[] bodyTimeout = objectMapper.writeValueAsBytes(reqTimeout);

        var submit2 = post("/api/device/biolock/jobs/" + job2.jobId() + "/result")
                .contentType(MediaType.APPLICATION_JSON)
                .content(bodyTimeout);
        addDeviceHeaders(submit2, dev.getId(), devKey, "POST", "/api/device/biolock/jobs/" + job2.jobId() + "/result", bodyTimeout);
        mockMvc.perform(submit2).andExpect(status().isOk());

        // Access is EXPIRED (not approved)
        mockMvc.perform(get("/api/attachments/" + att2.getId() + "/access")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state", is("EXPIRED")));
    }

    // =========================================================================
    // SCENARIO 6: Project Deletion Lifecycle & Sensor Slot Cleanup
    // =========================================================================
    @Test
    @DisplayName("Scenario 6: Delete 1 of 3 projects (credential stays), delete last (slot deleted, only then DELETED)")
    void scenario6_projectDeletionAndSlotCleanup() throws Exception {
        var regRes = mockMvc.perform(post("/api/biolock/devices")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + leaderAToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Alice Scanner\"}"))
                .andExpect(status().isCreated())
                .andReturn();

        DeviceRegistrationResponse reg = objectMapper.readValue(regRes.getResponse().getContentAsString(), DeviceRegistrationResponse.class);

        BiometricCredential cred = biometricCredentialRepository.save(BiometricCredential.builder()
                .userId(leaderA.getId())
                .deviceId(reg.deviceId())
                .sensorSlotId(1)
                .status(CredentialStatus.ACTIVE)
                .enrolledAt(clock.instant())
                .build());

        ProjectResponse p1 = projectService.createProject(leaderA.getEmail(), new CreateProjectRequest("P1", "Desc", null, null, null, null, null));
        ProjectResponse p2 = projectService.createProject(leaderA.getEmail(), new CreateProjectRequest("P2", "Desc", null, null, null, null, null));

        mockMvc.perform(put("/api/projects/" + p1.id() + "/biolock")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + leaderAToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"enabled\":true}"))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/projects/" + p2.id() + "/biolock")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + leaderAToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"enabled\":true}"))
                .andExpect(status().isOk());

        // 1. Delete Project 1 -> Credential stays ACTIVE because Project 2 still uses it
        projectService.deleteProject(p1.id(), leaderA.getEmail());
        var credAfterP1 = biometricCredentialRepository.findById(cred.getId()).orElseThrow();
        assertThat(credAfterP1.getStatus()).isEqualTo(CredentialStatus.ACTIVE);

        // 2. Delete Project 2 (the last project using this credential)
        projectService.deleteProject(p2.id(), leaderA.getEmail());

        // Credential transitions to PENDING_DELETE and a DELETE_TEMPLATE job is queued
        var credAfterP2 = biometricCredentialRepository.findById(cred.getId()).orElseThrow();
        assertThat(credAfterP2.getStatus()).isEqualTo(CredentialStatus.PENDING_DELETE);

        // 3. Device claims DELETE_TEMPLATE job
        var claimDel = get("/api/device/biolock/jobs/next");
        addDeviceHeaders(claimDel, reg.deviceId(), reg.deviceKey(), "GET", "/api/device/biolock/jobs/next", new byte[0]);
        var nextJobRes = mockMvc.perform(claimDel)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type", is("DELETE_TEMPLATE")))
                .andExpect(jsonPath("$.slot", is(1)))
                .andReturn();

        DeviceJobResponse deleteJob = objectMapper.readValue(nextJobRes.getResponse().getContentAsString(), DeviceJobResponse.class);

        // 4. Device executes delete and submits DELETED proof
        String proof = deviceKeyService.calculateProofHex(reg.deviceKey(), deleteJob.jobId(), deleteJob.challenge(), "DELETED", 1);
        BioLockJobResultRequest delResult = new BioLockJobResultRequest("DELETED", 1, null, null, null, proof);
        byte[] delBody = objectMapper.writeValueAsBytes(delResult);

        var submitDel = post("/api/device/biolock/jobs/" + deleteJob.jobId() + "/result")
                .contentType(MediaType.APPLICATION_JSON)
                .content(delBody);
        addDeviceHeaders(submitDel, reg.deviceId(), reg.deviceKey(), "POST", "/api/device/biolock/jobs/" + deleteJob.jobId() + "/result", delBody);
        mockMvc.perform(submitDel).andExpect(status().isOk());

        // 5. Only NOW is credential marked DELETED
        var finalCred = biometricCredentialRepository.findById(cred.getId()).orElseThrow();
        assertThat(finalCred.getStatus()).isEqualTo(CredentialStatus.DELETED);
    }

    // =========================================================================
    // SCENARIO 7: Security Boundary & Tamper Rejection Checks
    // =========================================================================
    @Test
    @DisplayName("Scenario 7: Security - no JWT, bad signature, old timestamp, reused nonce, replay, wrong grant")
    void scenario7_securityBoundaries() throws Exception {
        BiolockDevice dev = biolockDeviceRepository.save(BiolockDevice.builder()
                .ownerUserId(leaderA.getId())
                .name("Alice Scanner")
                .status(DeviceStatus.ACTIVE)
                .keyVersion(1)
                .lastSeenAt(clock.instant())
                .build());

        String devKey = deviceKeyService.deriveDeviceKeyHex(dev.getId(), 1);

        // A. No JWT on user endpoints -> 401
        mockMvc.perform(get("/api/biolock/status"))
                .andExpect(status().isUnauthorized());

        // B. Non-member access request -> 403
        Project project = projectRepository.save(Project.builder().name("Private Project").owner(leaderA).build());
        Task task = taskRepository.save(Task.builder().project(project).title("T").status("TODO").build());
        Attachment att = attachmentRepository.save(Attachment.builder().task(task).uploadedBy(leaderA).fileName("f.pdf").fileType("application/pdf").fileUrl("url").restricted(true).build());

        mockMvc.perform(post("/api/attachments/" + att.getId() + "/access-request")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + outsideToken))
                .andExpect(status().isForbidden());

        // C. Bad HMAC Signature on device endpoint -> 401
        String timestamp = String.valueOf(clock.instant().getEpochSecond());
        String nonce = randomNonce();
        mockMvc.perform(get("/api/device/biolock/jobs/next")
                .header("X-Device-Id", dev.getId().toString())
                .header("X-Timestamp", timestamp)
                .header("X-Nonce", nonce)
                .header("X-Signature", "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"))
                .andExpect(status().isUnauthorized());

        // D. Old Timestamp (> 120s skew) -> 401
        String oldTimestamp = String.valueOf(clock.instant().getEpochSecond() - 200);
        String oldNonce = randomNonce();
        String sigOld = deviceKeyService.calculateRequestSignature(devKey, "GET", "/api/device/biolock/jobs/next", oldTimestamp, oldNonce, new byte[0]);
        mockMvc.perform(get("/api/device/biolock/jobs/next")
                .header("X-Device-Id", dev.getId().toString())
                .header("X-Timestamp", oldTimestamp)
                .header("X-Nonce", oldNonce)
                .header("X-Signature", sigOld))
                .andExpect(status().isUnauthorized());

        // E. Reused Nonce -> 401
        String freshTimestamp = String.valueOf(clock.instant().getEpochSecond());
        String reusedNonce = randomNonce();
        String sigValid = deviceKeyService.calculateRequestSignature(devKey, "GET", "/api/device/biolock/jobs/next", freshTimestamp, reusedNonce, new byte[0]);

        // First call with nonce succeeds (204)
        mockMvc.perform(get("/api/device/biolock/jobs/next")
                .header("X-Device-Id", dev.getId().toString())
                .header("X-Timestamp", freshTimestamp)
                .header("X-Nonce", reusedNonce)
                .header("X-Signature", sigValid))
                .andExpect(status().isNoContent());

        // Second call with same nonce fails (401)
        mockMvc.perform(get("/api/device/biolock/jobs/next")
                .header("X-Device-Id", dev.getId().toString())
                .header("X-Timestamp", freshTimestamp)
                .header("X-Nonce", reusedNonce)
                .header("X-Signature", sigValid))
                .andExpect(status().isUnauthorized());
    }

    // =========================================================================
    // SCENARIO 8: Failure Handling (Offline, Lease Expiration, Uncertainty)
    // =========================================================================
    @Test
    @DisplayName("Scenario 8: Failures - offline device blocks access, mid-job lease expiry never approves")
    void scenario8_failuresAndUncertainty() throws Exception {
        Project project = projectRepository.save(Project.builder().name("Fail Proj").owner(leaderA).build());
        projectMemberRepository.save(ProjectMember.builder().project(project).user(memberUser).role("Member").build());

        // Device has been offline for 5 minutes
        BiolockDevice dev = biolockDeviceRepository.save(BiolockDevice.builder()
                .ownerUserId(leaderA.getId())
                .name("Alice Scanner")
                .status(DeviceStatus.ACTIVE)
                .keyVersion(1)
                .lastSeenAt(clock.instant().minusSeconds(300))
                .build());

        BiometricCredential cred = biometricCredentialRepository.save(BiometricCredential.builder()
                .userId(leaderA.getId())
                .deviceId(dev.getId())
                .sensorSlotId(1)
                .status(CredentialStatus.ACTIVE)
                .enrolledAt(clock.instant())
                .build());

        projectBiometricSettingRepository.save(ProjectBiometricSetting.builder()
                .projectId(project.getId())
                .credentialId(cred.getId())
                .enabled(true)
                .build());

        Task task = taskRepository.save(Task.builder().project(project).title("T").status("TODO").build());
        Attachment att = attachmentRepository.save(Attachment.builder().task(task).uploadedBy(memberUser).fileName("doc.pdf").fileType("application/pdf").fileUrl("url").restricted(true).build());

        // Member requests access while device is offline -> 409 BIOLOCK_DEVICE_OFFLINE
        mockMvc.perform(post("/api/attachments/" + att.getId() + "/access-request")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + memberToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code", is("BIOLOCK_DEVICE_OFFLINE")));

        // State reports deviceOnline = false
        mockMvc.perform(get("/api/attachments/" + att.getId() + "/access")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deviceOnline", is(false)))
                .andExpect(jsonPath("$.state", is("LOCKED")));

        // File stream is BLOCKED (403)
        mockMvc.perform(get("/api/attachments/" + att.getId() + "/content")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + memberToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code", is("BIOLOCK_ACCESS_REQUIRED")));
    }
}
