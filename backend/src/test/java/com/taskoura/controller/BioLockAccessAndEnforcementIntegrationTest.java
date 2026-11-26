package com.taskoura.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.config.BiolockProperties;
import com.taskoura.dto.AttachmentDtos.RestrictDocumentRequest;
import com.taskoura.dto.BioLockDtos.BioLockJobResultRequest;
import com.taskoura.entity.*;
import com.taskoura.repository.*;
import com.taskoura.security.JwtUtil;
import com.taskoura.security.biolock.DeviceKeyService;
import com.taskoura.service.AttachmentStorageService;
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

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class BioLockAccessAndEnforcementIntegrationTest {

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

    @MockitoBean private JavaMailSender mailSender;
    @MockitoBean private AttachmentStorageService attachmentStorageService;

    private User leader;
    private User member1;
    private User member2;
    private User outsider;

    private String leaderToken;
    private String member1Token;
    private String member2Token;
    private String outsiderToken;

    private Project project;
    private Task task;
    private Attachment attachment;
    private Attachment secondAttachment;

    private BiolockDevice device;
    private BiometricCredential credential;
    private String deviceKeyHex;

    @BeforeEach
    void setUp() {
        String masterKeyBase64 = Base64.getEncoder().encodeToString("01234567890123456789012345678901".getBytes());
        biolockProperties.setEnabled(true);
        biolockProperties.setDeviceMasterKey(masterKeyBase64);
        biolockProperties.setRequestTtlSeconds(120);
        biolockProperties.setAccessTtlMinutes(15);
        biolockProperties.setDeviceOnlineSeconds(30);
        biolockProperties.setEmailThrottleMinutes(5);
        biolockProperties.setEmailOnRequest(true);

        when(attachmentStorageService.downloadFile(anyString()))
                .thenReturn("Protected document content bytes".getBytes(StandardCharsets.UTF_8));
        when(attachmentStorageService.downloadFileStream(anyString()))
                .thenAnswer(inv -> new ByteArrayInputStream("Protected document content bytes".getBytes(StandardCharsets.UTF_8)));
        when(attachmentStorageService.moveToAuthenticatedDelivery(anyString()))
                .thenReturn("https://res.cloudinary.com/demo/image/authenticated/v1/spec.pdf");
        when(attachmentStorageService.moveToPublicDelivery(anyString()))
                .thenReturn("https://res.cloudinary.com/demo/image/upload/v1/spec.pdf");

        leader = userRepository.save(User.builder()
                .name("Leader Alice")
                .email("alice-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());

        member1 = userRepository.save(User.builder()
                .name("Member Bob")
                .email("bob-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());

        member2 = userRepository.save(User.builder()
                .name("Member Charlie")
                .email("charlie-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());

        outsider = userRepository.save(User.builder()
                .name("Outsider Dave")
                .email("dave-" + UUID.randomUUID() + "@example.com")
                .passwordHash("hashed")
                .verified(true)
                .build());

        leaderToken = createToken(leader);
        member1Token = createToken(member1);
        member2Token = createToken(member2);
        outsiderToken = createToken(outsider);

        project = projectRepository.save(Project.builder()
                .name("Top Secret Bio Project")
                .owner(leader)
                .build());

        projectMemberRepository.save(ProjectMember.builder()
                .project(project)
                .user(member1)
                .role("Member")
                .build());

        projectMemberRepository.save(ProjectMember.builder()
                .project(project)
                .user(member2)
                .role("Member")
                .build());

        task = taskRepository.save(Task.builder()
                .project(project)
                .title("Design Architecture")
                .status("IN_PROGRESS")
                .build());

        attachment = attachmentRepository.save(Attachment.builder()
                .task(task)
                .uploadedBy(leader)
                .fileName("secret-specs.pdf")
                .fileType("application/pdf")
                .fileUrl("https://res.cloudinary.com/demo/image/upload/v1/secret-specs.pdf")
                .restricted(false)
                .build());

        secondAttachment = attachmentRepository.save(Attachment.builder()
                .task(task)
                .uploadedBy(leader)
                .fileName("other-doc.pdf")
                .fileType("application/pdf")
                .fileUrl("https://res.cloudinary.com/demo/image/upload/v1/other-doc.pdf")
                .restricted(true)
                .build());

        Instant now = clock.instant();

        device = biolockDeviceRepository.save(BiolockDevice.builder()
                .ownerUserId(leader.getId())
                .name("Alice Scanner")
                .status(DeviceStatus.ACTIVE)
                .keyVersion(1)
                .lastSeenAt(now)
                .createdAt(now)
                .build());

        deviceKeyHex = deviceKeyService.deriveDeviceKeyHex(device.getId(), device.getKeyVersion());

        credential = biometricCredentialRepository.save(BiometricCredential.builder()
                .userId(leader.getId())
                .deviceId(device.getId())
                .sensorSlotId(3)
                .status(CredentialStatus.ACTIVE)
                .enrolledAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build());

        projectBiometricSettingRepository.save(ProjectBiometricSetting.builder()
                .projectId(project.getId())
                .credentialId(credential.getId())
                .enabled(true)
                .createdAt(now)
                .build());
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
                                  String devKeyHex,
                                  String method,
                                  String path,
                                  byte[] body) {
        String timestamp = String.valueOf(clock.instant().getEpochSecond());
        String nonce = randomNonce();
        String signature = deviceKeyService.calculateRequestSignature(devKeyHex, method, path, timestamp, nonce, body);

        req.header("X-Device-Id", deviceId.toString())
           .header("X-Timestamp", timestamp)
           .header("X-Nonce", nonce)
           .header("X-Signature", signature);
    }

    @Test
    @DisplayName("Project owner can restrict document; non-owner is forbidden")
    void testRestrictingDocumentPermissions() throws Exception {
        // Non-owner member tries to restrict
        mockMvc.perform(put("/api/attachments/{id}/restricted", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member1Token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RestrictDocumentRequest(true))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code", is("FORBIDDEN")));

        // Project owner restricts document
        mockMvc.perform(put("/api/attachments/{id}/restricted", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + leaderToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RestrictDocumentRequest(true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.restricted", is(true)))
                .andExpect(jsonPath("$.locked", is(false)))
                .andExpect(jsonPath("$.fileUrl").doesNotExist());

        // Verify attachment list for owner (unlocked, but fileUrl null)
        mockMvc.perform(get("/api/tasks/{taskId}/attachments", task.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + leaderToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].restricted", is(true)))
                .andExpect(jsonPath("$[0].locked", is(false)))
                .andExpect(jsonPath("$[0].fileUrl").doesNotExist());

        // Verify attachment list for member (locked, fileUrl null)
        mockMvc.perform(get("/api/tasks/{taskId}/attachments", task.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].restricted", is(true)))
                .andExpect(jsonPath("$[0].locked", is(true)))
                .andExpect(jsonPath("$[0].fileUrl").doesNotExist());
    }

    @Test
    @DisplayName("Restricted document blocks member from streaming and downloading until approved")
    void testRestrictedDocumentBlocksAccess() throws Exception {
        attachment.setRestricted(true);
        attachmentRepository.save(attachment);

        // Member cannot stream content
        mockMvc.perform(get("/api/attachments/{id}/content", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member1Token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code", is("BIOLOCK_ACCESS_REQUIRED")));

        // Member cannot download
        mockMvc.perform(get("/api/attachments/{id}/download", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member1Token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code", is("BIOLOCK_ACCESS_REQUIRED")));

        // Outsider gets 403 Forbidden
        mockMvc.perform(get("/api/attachments/{id}/content", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());

        // Project owner has unconditional access
        var leaderStreamResult = mockMvc.perform(get("/api/attachments/{id}/content", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + leaderToken))
                .andExpect(status().isOk())
                .andExpect(request().asyncStarted())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andReturn();

        mockMvc.perform(asyncDispatch(leaderStreamResult))
                .andExpect(status().isOk())
                .andExpect(content().string("Protected document content bytes"));
    }

    @Test
    @DisplayName("Access request is refused with 409 when leader's device is offline")
    void testAccessRequestOfflineDevice() throws Exception {
        attachment.setRestricted(true);
        attachmentRepository.save(attachment);

        // Set device last seen 45 seconds ago (threshold is 30s)
        device.setLastSeenAt(clock.instant().minusSeconds(45));
        biolockDeviceRepository.save(device);

        mockMvc.perform(post("/api/attachments/{id}/access-request", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member1Token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code", is("BIOLOCK_DEVICE_OFFLINE")));
    }

    @Test
    @DisplayName("End-to-end BioLock access approval flow with MATCH outcome and slot verification")
    void testAccessRequestAndApprovalFlow() throws Exception {
        attachment.setRestricted(true);
        attachmentRepository.save(attachment);

        // 1. Member requests access
        String reqResJson = mockMvc.perform(post("/api/attachments/{id}/access-request", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member1Token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status", is("PENDING")))
                .andExpect(jsonPath("$.deviceName", is("Alice Scanner")))
                .andExpect(jsonPath("$.secondsRemaining", greaterThan(0)))
                .andReturn().getResponse().getContentAsString();

        UUID requestId = UUID.fromString(objectMapper.readTree(reqResJson).get("requestId").asText());

        // Check duplicate request is refused with 409 BIOLOCK_REQUEST_ACTIVE
        mockMvc.perform(post("/api/attachments/{id}/access-request", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member1Token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code", is("BIOLOCK_REQUEST_ACTIVE")))
                .andExpect(jsonPath("$.requestId", is(requestId.toString())));

        // Check GET /api/attachments/{id}/access state is PENDING
        mockMvc.perform(get("/api/attachments/{id}/access", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state", is("PENDING")))
                .andExpect(jsonPath("$.requestId", is(requestId.toString())));

        // 2. Leader's device polls and claims the VERIFY_ACCESS job
        var nextJobReq = get("/api/device/biolock/jobs/next");
        addDeviceHeaders(nextJobReq, device.getId(), deviceKeyHex, "GET", "/api/device/biolock/jobs/next", new byte[0]);

        String jobResJson = mockMvc.perform(nextJobReq)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type", is("VERIFY_ACCESS")))
                .andExpect(jsonPath("$.expectedSlot", is(3)))
                .andReturn().getResponse().getContentAsString();

        UUID jobId = UUID.fromString(objectMapper.readTree(jobResJson).get("jobId").asText());
        String challenge = objectMapper.readTree(jobResJson).get("challenge").asText();

        // 3. Leader places registered finger on device (slot 3 matches credential)
        String outcome = "MATCH";
        int matchedSlot = 3;
        String proofHex = deviceKeyService.calculateProofHex(deviceKeyHex, jobId, challenge, outcome, matchedSlot);

        BioLockJobResultRequest resultReq = new BioLockJobResultRequest(outcome, null, matchedSlot, proofHex, null);
        byte[] bodyBytes = objectMapper.writeValueAsBytes(resultReq);

        var submitReq = post("/api/device/biolock/jobs/{id}/result", jobId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(bodyBytes);
        addDeviceHeaders(submitReq, device.getId(), deviceKeyHex, "POST", "/api/device/biolock/jobs/" + jobId + "/result", bodyBytes);

        mockMvc.perform(submitReq)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("OK")));

        // Verify request is now APPROVED
        DocumentAccessRequest savedReq = documentAccessRequestRepository.findById(requestId).orElseThrow();
        assertThat(savedReq.getStatus()).isEqualTo(AccessRequestStatus.APPROVED);
        assertThat(savedReq.getDecidedByDeviceId()).isEqualTo(device.getId());
        assertThat(savedReq.getAccessExpiresAt()).isNotNull();

        // 4. Member checks access state -> APPROVED
        mockMvc.perform(get("/api/attachments/{id}/access", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state", is("APPROVED")))
                .andExpect(jsonPath("$.secondsRemaining", greaterThan(0)));

        // 5. Member streams content successfully
        var memberStreamResult = mockMvc.perform(get("/api/attachments/{id}/content", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member1Token))
                .andExpect(status().isOk())
                .andExpect(request().asyncStarted())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andReturn();

        mockMvc.perform(asyncDispatch(memberStreamResult))
                .andExpect(status().isOk())
                .andExpect(content().string("Protected document content bytes"));

        // 6. Isolation check: Member 2 is still blocked from this attachment
        mockMvc.perform(get("/api/attachments/{id}/content", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member2Token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code", is("BIOLOCK_ACCESS_REQUIRED")));

        // 7. Isolation check: Member 1 is still blocked from another restricted attachment
        mockMvc.perform(get("/api/attachments/{id}/content", secondAttachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member1Token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code", is("BIOLOCK_ACCESS_REQUIRED")));
    }

    @Test
    @DisplayName("Non-matching fingerprint or wrong slot denies access and does not unlock document")
    void testNonMatchingOrSlotMismatchFingerprint() throws Exception {
        attachment.setRestricted(true);
        attachmentRepository.save(attachment);

        // 1. Member requests access
        String reqResJson = mockMvc.perform(post("/api/attachments/{id}/access-request", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member1Token))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        UUID requestId = UUID.fromString(objectMapper.readTree(reqResJson).get("requestId").asText());

        // 2. Device claims job
        var nextJobReq = get("/api/device/biolock/jobs/next");
        addDeviceHeaders(nextJobReq, device.getId(), deviceKeyHex, "GET", "/api/device/biolock/jobs/next", new byte[0]);
        String jobResJson = mockMvc.perform(nextJobReq).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        UUID jobId = UUID.fromString(objectMapper.readTree(jobResJson).get("jobId").asText());
        String challenge = objectMapper.readTree(jobResJson).get("challenge").asText();

        // 3. Device reports MATCH, but on slot 4 (credential is slot 3)
        int wrongSlot = 4;
        String proofHex = deviceKeyService.calculateProofHex(deviceKeyHex, jobId, challenge, "MATCH", wrongSlot);

        BioLockJobResultRequest resultReq = new BioLockJobResultRequest("MATCH", null, wrongSlot, proofHex, null);
        byte[] bodyBytes = objectMapper.writeValueAsBytes(resultReq);

        var submitReq = post("/api/device/biolock/jobs/{id}/result", jobId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(bodyBytes);
        addDeviceHeaders(submitReq, device.getId(), deviceKeyHex, "POST", "/api/device/biolock/jobs/" + jobId + "/result", bodyBytes);

        mockMvc.perform(submitReq).andExpect(status().isOk());

        // Request must be DENIED due to slot mismatch
        DocumentAccessRequest savedReq = documentAccessRequestRepository.findById(requestId).orElseThrow();
        assertThat(savedReq.getStatus()).isEqualTo(AccessRequestStatus.DENIED);
        assertThat(savedReq.getFailureReason()).isEqualTo("BIOLOCK_SLOT_MISMATCH");

        // Member cannot access content
        mockMvc.perform(get("/api/attachments/{id}/content", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member1Token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code", is("BIOLOCK_ACCESS_REQUIRED")));
    }

    @Test
    @DisplayName("Requester can cancel their own pending access request")
    void testCancelPendingAccessRequest() throws Exception {
        attachment.setRestricted(true);
        attachmentRepository.save(attachment);

        String reqResJson = mockMvc.perform(post("/api/attachments/{id}/access-request", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member1Token))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        UUID requestId = UUID.fromString(objectMapper.readTree(reqResJson).get("requestId").asText());

        // Another member cannot cancel it
        mockMvc.perform(post("/api/attachments/access-requests/{requestId}/cancel", requestId)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member2Token))
                .andExpect(status().isForbidden());

        // Requester cancels
        mockMvc.perform(post("/api/attachments/access-requests/{requestId}/cancel", requestId)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member1Token))
                .andExpect(status().isOk());

        DocumentAccessRequest savedReq = documentAccessRequestRepository.findById(requestId).orElseThrow();
        assertThat(savedReq.getStatus()).isEqualTo(AccessRequestStatus.CANCELLED);

        BiolockJob job = biolockJobRepository.findByAccessRequestId(requestId).orElseThrow();
        assertThat(job.getStatus()).isEqualTo(JobStatus.CANCELLED);
    }

    @Test
    @DisplayName("Unrestricting a document revokes open requests/grants and restores public access")
    void testUnrestrictingDocumentRevokesGrants() throws Exception {
        attachment.setRestricted(true);
        attachmentRepository.save(attachment);

        // Member requests access
        String reqResJson = mockMvc.perform(post("/api/attachments/{id}/access-request", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member1Token))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        UUID requestId = UUID.fromString(objectMapper.readTree(reqResJson).get("requestId").asText());

        // Leader un-restricts the document
        mockMvc.perform(put("/api/attachments/{id}/restricted", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + leaderToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RestrictDocumentRequest(false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.restricted", is(false)))
                .andExpect(jsonPath("$.locked", is(false)))
                .andExpect(jsonPath("$.fileUrl", notNullValue()));

        // Verify request was revoked
        DocumentAccessRequest savedReq = documentAccessRequestRepository.findById(requestId).orElseThrow();
        assertThat(savedReq.getStatus()).isEqualTo(AccessRequestStatus.REVOKED);

        // Access state is now UNRESTRICTED
        mockMvc.perform(get("/api/attachments/{id}/access", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state", is("UNRESTRICTED")));
    }

    @Test
    @DisplayName("Removing a member from a project revokes open access requests")
    void testMemberRemovalRevokesAccess() throws Exception {
        attachment.setRestricted(true);
        attachmentRepository.save(attachment);

        // Member requests access
        String reqResJson = mockMvc.perform(post("/api/attachments/{id}/access-request", attachment.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + member1Token))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        UUID requestId = UUID.fromString(objectMapper.readTree(reqResJson).get("requestId").asText());

        // Owner removes member from project
        mockMvc.perform(delete("/api/projects/{projectId}/members/{userId}", project.getId(), member1.getId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + leaderToken))
                .andExpect(status().isNoContent());

        // Verify request was revoked
        DocumentAccessRequest savedReq = documentAccessRequestRepository.findById(requestId).orElseThrow();
        assertThat(savedReq.getStatus()).isEqualTo(AccessRequestStatus.REVOKED);
    }
}
