package com.taskoura.repository;

import com.taskoura.entity.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
public class BiolockDataModelTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private BiolockDeviceRepository deviceRepository;

    @Autowired
    private BiometricCredentialRepository credentialRepository;

    @Autowired
    private ProjectBiometricSettingRepository projectBiometricSettingRepository;

    @Autowired
    private BiolockJobRepository jobRepository;

    @Autowired
    private DeviceNonceRepository nonceRepository;

    @Autowired
    private DocumentAccessRequestRepository accessRequestRepository;

    @Autowired
    private BiolockAuditEventRepository auditEventRepository;

    @Autowired
    private AttachmentRepository attachmentRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private UserRepository userRepository;

    @Test
    @DisplayName("BiolockDevice: persists, queries by owner and status, and updates lastSeenAt")
    void testBiolockDeviceEntityAndRepository() {
        UUID ownerId = UUID.randomUUID();
        Instant now = Instant.now();

        BiolockDevice device = BiolockDevice.builder()
                .ownerUserId(ownerId)
                .name("ESP32 Lab Door 1")
                .status(DeviceStatus.ACTIVE)
                .keyVersion(1)
                .lastSeenAt(now)
                .build();

        BiolockDevice saved = deviceRepository.save(device);
        entityManager.flush();
        entityManager.clear();

        Optional<BiolockDevice> foundOpt = deviceRepository.findByIdAndStatus(saved.getId(), DeviceStatus.ACTIVE);
        assertThat(foundOpt).isPresent();
        assertThat(foundOpt.get().getName()).isEqualTo("ESP32 Lab Door 1");
        assertThat(foundOpt.get().getOwnerUserId()).isEqualTo(ownerId);
        assertThat(foundOpt.get().getKeyVersion()).isEqualTo(1);
        assertThat(deviceRepository.existsByOwnerUserIdAndStatus(ownerId, DeviceStatus.ACTIVE)).isTrue();

        // Revoke device
        foundOpt.get().setStatus(DeviceStatus.REVOKED);
        deviceRepository.save(foundOpt.get());
        entityManager.flush();
        entityManager.clear();

        assertThat(deviceRepository.existsByOwnerUserIdAndStatus(ownerId, DeviceStatus.ACTIVE)).isFalse();
        assertThat(deviceRepository.findByIdAndStatus(saved.getId(), DeviceStatus.REVOKED)).isPresent();
    }

    @Test
    @DisplayName("BiometricCredential: persists, links user to device slot, and excludes DELETED credentials")
    void testBiometricCredentialRepository() {
        UUID userId = UUID.randomUUID();
        UUID deviceId = UUID.randomUUID();

        BiometricCredential credential = BiometricCredential.builder()
                .userId(userId)
                .deviceId(deviceId)
                .sensorSlotId(42)
                .status(CredentialStatus.ACTIVE)
                .enrolledAt(Instant.now())
                .build();

        BiometricCredential saved = credentialRepository.save(credential);
        entityManager.flush();
        entityManager.clear();

        Optional<BiometricCredential> activeOpt = credentialRepository.findByDeviceIdAndSensorSlotIdAndStatusNot(
                deviceId, 42, CredentialStatus.DELETED
        );
        assertThat(activeOpt).isPresent();
        assertThat(activeOpt.get().getSensorSlotId()).isEqualTo(42);

        List<BiometricCredential> activeCreds = credentialRepository.findByUserIdAndStatusNot(userId, CredentialStatus.DELETED);
        assertThat(activeCreds).hasSize(1);

        // Mark credential DELETED
        activeOpt.get().setStatus(CredentialStatus.DELETED);
        credentialRepository.save(activeOpt.get());
        entityManager.flush();
        entityManager.clear();

        assertThat(credentialRepository.findByDeviceIdAndSensorSlotIdAndStatusNot(deviceId, 42, CredentialStatus.DELETED)).isEmpty();
        assertThat(credentialRepository.findByUserIdAndStatusNot(userId, CredentialStatus.DELETED)).isEmpty();
    }

    @Test
    @DisplayName("ProjectBiometricSetting: counts active projects using a credential ignoring soft-deleted projects")
    void testProjectBiometricSettingCountExcludesDeleted() {
        User owner = userRepository.save(User.builder()
                .name("Leader")
                .email("leader-" + UUID.randomUUID() + "@taskoura.dev")
                .passwordHash("hash")
                .verified(true)
                .build());

        Project activeProject = projectRepository.save(Project.builder()
                .name("Active Project")
                .owner(owner)
                .build());

        Project deletedProject = projectRepository.save(Project.builder()
                .name("Deleted Project")
                .owner(owner)
                .deletedAt(LocalDateTime.now())
                .build());

        UUID credentialId = UUID.randomUUID();

        projectBiometricSettingRepository.save(ProjectBiometricSetting.builder()
                .projectId(activeProject.getId())
                .credentialId(credentialId)
                .enabled(true)
                .build());

        projectBiometricSettingRepository.save(ProjectBiometricSetting.builder()
                .projectId(deletedProject.getId())
                .credentialId(credentialId)
                .enabled(true)
                .build());

        entityManager.flush();
        entityManager.clear();

        long count = projectBiometricSettingRepository.countActiveProjectsUsingCredential(credentialId);
        // Only activeProject has deletedAt IS NULL
        assertThat(count).isEqualTo(1L);
    }

    @Test
    @DisplayName("BiolockJob: finds claimable jobs with lock, respects lease and expiration")
    void testBiolockJobClaimAndExpiration() {
        UUID deviceId = UUID.randomUUID();
        Instant now = Instant.now();

        BiolockJob activeQueuedJob = jobRepository.save(BiolockJob.builder()
                .deviceId(deviceId)
                .type(JobType.VERIFY_ACCESS)
                .status(JobStatus.QUEUED)
                .challenge("hash123")
                .expiresAt(now.plusSeconds(120))
                .build());

        BiolockJob expiredJob = jobRepository.save(BiolockJob.builder()
                .deviceId(deviceId)
                .type(JobType.VERIFY_ACCESS)
                .status(JobStatus.QUEUED)
                .challenge("hash456")
                .expiresAt(now.minusSeconds(10))
                .build());

        entityManager.flush();
        entityManager.clear();

        List<BiolockJob> claimable = jobRepository.findNextClaimableJobsWithLock(deviceId, now);
        assertThat(claimable).extracting(BiolockJob::getId).containsExactly(activeQueuedJob.getId());

        List<BiolockJob> expired = jobRepository.findExpiredJobs(now);
        assertThat(expired).extracting(BiolockJob::getId).contains(expiredJob.getId());
    }

    @Test
    @DisplayName("DeviceNonce: stores nonce and supports expiration cleanup")
    void testDeviceNonceRepository() {
        UUID deviceId = UUID.randomUUID();
        Instant now = Instant.now();

        DeviceNonce activeNonce = nonceRepository.save(DeviceNonce.builder()
                .deviceId(deviceId)
                .nonce("abcdef0123456789")
                .expiresAt(now.plusSeconds(600))
                .build());

        DeviceNonce staleNonce = nonceRepository.save(DeviceNonce.builder()
                .deviceId(deviceId)
                .nonce("fedcba9876543210")
                .expiresAt(now.minusSeconds(60))
                .build());

        entityManager.flush();
        entityManager.clear();

        assertThat(nonceRepository.existsByDeviceIdAndNonce(deviceId, "abcdef0123456789")).isTrue();
        assertThat(nonceRepository.existsByDeviceIdAndNonce(deviceId, "unknown")).isFalse();

        int deleted = nonceRepository.deleteExpiredNonces(now);
        assertThat(deleted).isGreaterThanOrEqualTo(1);

        entityManager.flush();
        entityManager.clear();

        assertThat(nonceRepository.existsByDeviceIdAndNonce(deviceId, "fedcba9876543210")).isFalse();
        assertThat(nonceRepository.existsByDeviceIdAndNonce(deviceId, "abcdef0123456789")).isTrue();
    }

    @Test
    @DisplayName("DeviceNonce: duplicate deviceId + nonce is rejected by unique constraint")
    void testDeviceNonceUniqueConstraint() {
        UUID deviceId = UUID.randomUUID();
        Instant now = Instant.now();

        nonceRepository.save(DeviceNonce.builder()
                .deviceId(deviceId)
                .nonce("dup-nonce-test")
                .expiresAt(now.plusSeconds(300))
                .build());
        entityManager.flush();

        assertThatThrownBy(() -> {
            nonceRepository.save(DeviceNonce.builder()
                    .deviceId(deviceId)
                    .nonce("dup-nonce-test")
                    .expiresAt(now.plusSeconds(300))
                    .build());
            entityManager.flush();
        }).isInstanceOf(Exception.class)
          .matches(e -> e.getMessage().toLowerCase().contains("unique") 
                     || e.getCause() instanceof org.hibernate.exception.ConstraintViolationException
                     || e instanceof DataIntegrityViolationException);
    }

    @Test
    @DisplayName("DocumentAccessRequest: open requests, active grants, and rate limiting queries")
    void testDocumentAccessRequestQueries() {
        UUID attachmentId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        UUID leaderId = UUID.randomUUID();
        UUID credentialId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        Instant now = Instant.now();

        DocumentAccessRequest pendingReq = accessRequestRepository.save(DocumentAccessRequest.builder()
                .projectId(projectId)
                .attachmentId(attachmentId)
                .requesterId(requesterId)
                .leaderId(leaderId)
                .credentialId(credentialId)
                .status(AccessRequestStatus.PENDING)
                .expiresAt(now.plusSeconds(120))
                .build());

        entityManager.flush();
        entityManager.clear();

        Optional<DocumentAccessRequest> openOpt = accessRequestRepository.findOpenRequest(attachmentId, requesterId, now);
        assertThat(openOpt).isPresent();
        assertThat(openOpt.get().getId()).isEqualTo(pendingReq.getId());

        // Approved grant check
        assertThat(accessRequestRepository.findActiveGrant(attachmentId, requesterId, now)).isEmpty();

        pendingReq.setStatus(AccessRequestStatus.APPROVED);
        pendingReq.setAccessExpiresAt(now.plus(15, ChronoUnit.MINUTES));
        accessRequestRepository.save(pendingReq);
        entityManager.flush();
        entityManager.clear();

        assertThat(accessRequestRepository.findActiveGrant(attachmentId, requesterId, now)).isPresent();

        // Rate limit count check
        long count = accessRequestRepository.countRequestsSince(attachmentId, requesterId, now.minusSeconds(3600));
        assertThat(count).isEqualTo(1L);
    }

    @Test
    @DisplayName("Attachment: restricted field defaults to false and can be set to true")
    void testAttachmentRestrictedField() {
        User user = userRepository.save(User.builder()
                .name("Doc Owner")
                .email("doc-owner-" + UUID.randomUUID() + "@taskoura.dev")
                .passwordHash("hash")
                .verified(true)
                .build());

        Project project = projectRepository.save(Project.builder()
                .name("Doc Project")
                .owner(user)
                .build());

        Task task = taskRepository.save(Task.builder()
                .title("Doc Task")
                .project(project)
                .build());

        Attachment standardAttachment = attachmentRepository.save(Attachment.builder()
                .task(task)
                .uploadedBy(user)
                .fileUrl("https://res.cloudinary.com/test/file1.pdf")
                .fileName("spec.pdf")
                .build());

        Attachment restrictedAttachment = attachmentRepository.save(Attachment.builder()
                .task(task)
                .uploadedBy(user)
                .fileUrl("https://res.cloudinary.com/test/file2.pdf")
                .fileName("classified.pdf")
                .restricted(true)
                .build());

        entityManager.flush();
        entityManager.clear();

        Attachment loadedStandard = attachmentRepository.findById(standardAttachment.getId()).orElseThrow();
        assertThat(loadedStandard.isRestricted()).isFalse();

        Attachment loadedRestricted = attachmentRepository.findById(restrictedAttachment.getId()).orElseThrow();
        assertThat(loadedRestricted.isRestricted()).isTrue();
    }

    @Test
    @DisplayName("Migration SQL: backend/docs/migrations/biolock.sql executes twice idempotently without error")
    void testMigrationSqlRunsTwiceIdempotently() throws IOException {
        List<String> cleanLines = Files.readAllLines(Path.of("docs/migrations/biolock.sql"))
                .stream()
                .map(String::trim)
                .filter(line -> !line.startsWith("--") && !line.isBlank())
                .toList();
        String cleanSql = String.join("\n", cleanLines);
        String[] statements = cleanSql.split(";");

        boolean isH2 = Boolean.TRUE.equals(jdbcTemplate.execute((java.sql.Connection conn) ->
                conn.getMetaData().getDatabaseProductName().equalsIgnoreCase("H2")
        ));

        // First pass
        for (String raw : statements) {
            String trimmed = raw.trim();
            if (!trimmed.isEmpty()) {
                String toExec = trimmed;
                if (isH2 && toExec.toUpperCase().contains("CREATE UNIQUE INDEX") && toExec.toUpperCase().matches("(?s).*\\bWHERE\\b.*")) {
                    toExec = toExec.replaceAll("(?i)\\s+WHERE\\s+.*$", "");
                }
                jdbcTemplate.execute(toExec);
            }
        }

        // Second pass (idempotence verification)
        for (String raw : statements) {
            String trimmed = raw.trim();
            if (!trimmed.isEmpty()) {
                String toExec = trimmed;
                if (isH2 && toExec.toUpperCase().contains("CREATE UNIQUE INDEX") && toExec.toUpperCase().matches("(?s).*\\bWHERE\\b.*")) {
                    toExec = toExec.replaceAll("(?i)\\s+WHERE\\s+.*$", "");
                }
                jdbcTemplate.execute(toExec);
            }
        }

        // Verify partial index on document_access_requests works
        UUID attachmentId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        UUID req1 = UUID.randomUUID();
        UUID req2 = UUID.randomUUID();

        jdbcTemplate.update("""
            INSERT INTO document_access_requests 
            (id, project_id, attachment_id, requester_id, leader_id, credential_id, status, requested_at, expires_at, leader_email_status, leader_email_attempts)
            VALUES (?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'NOT_SENT', 0)
        """, req1, UUID.randomUUID(), attachmentId, requesterId, UUID.randomUUID(), UUID.randomUUID());

        // A second PENDING request for same (attachmentId, requesterId) must be rejected by partial unique index
        assertThatThrownBy(() -> {
            jdbcTemplate.update("""
                INSERT INTO document_access_requests 
                (id, project_id, attachment_id, requester_id, leader_id, credential_id, status, requested_at, expires_at, leader_email_status, leader_email_attempts)
                VALUES (?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'NOT_SENT', 0)
            """, req2, UUID.randomUUID(), attachmentId, requesterId, UUID.randomUUID(), UUID.randomUUID());
        }).isInstanceOf(DataIntegrityViolationException.class);
    }
}
