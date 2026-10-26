package com.taskoura.service;

import com.icegreen.greenmail.configuration.GreenMailConfiguration;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.util.ServerSetupTest;
import com.taskoura.dto.*;
import com.taskoura.entity.Project;
import com.taskoura.entity.ProjectMember;
import com.taskoura.entity.Task;
import com.taskoura.entity.User;
import com.taskoura.entity.UserProfile;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.EmailDeliveryException;
import com.taskoura.exception.OtpAttemptsExceededException;
import com.taskoura.exception.RateLimitedException;
import com.taskoura.repository.*;
import jakarta.mail.BodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class EmailAndOtpHardeningIntegrationTest {

    @RegisterExtension
    static GreenMailExtension greenMail = new GreenMailExtension(ServerSetupTest.SMTP)
            .withPerMethodLifecycle(true);

    @DynamicPropertySource
    static void configureMail(DynamicPropertyRegistry registry) {
        registry.add("spring.mail.host", () -> "127.0.0.1");
        registry.add("spring.mail.port", () -> ServerSetupTest.SMTP.getPort());
        registry.add("spring.mail.username", () -> "test@taskoura.dev");
        registry.add("spring.mail.password", () -> "secret");
        registry.add("spring.mail.properties.mail.smtp.auth", () -> "false");
        registry.add("spring.mail.properties.mail.smtp.starttls.enable", () -> "false");
        registry.add("mail.from-address", () -> "support@taskoura.dev");
        registry.add("mail.from-name", () -> "Taskoura Team");
        registry.add("app.name", () -> "Taskoura");
        registry.add("app.frontend-url", () -> "http://localhost:5173");
    }

    @Autowired private EmailService emailService;
    @Autowired private OtpService otpService;
    @Autowired private AuthService authService;
    @Autowired private UserRepository userRepository;
    @Autowired private UserProfileRepository userProfileRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private ProjectMemberRepository projectMemberRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private TemplateEngine templateEngine;

    private User testUser;
    private Project testProject;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    @BeforeEach
    void setUp() {
        if (!greenMail.isRunning()) {
            greenMail.start();
        }
        greenMail.reset();
        greenMail.setUser("test@taskoura.dev", "test@taskoura.dev", "secret");

        testUser = userRepository.save(User.builder()
                .name("Alice <script>alert('xss')</script>")
                .email("alice-" + UUID.randomUUID() + "@example.com")
                .passwordHash(passwordEncoder.encode("Password123!"))
                .verified(false)
                .build());

        testProject = projectRepository.save(Project.builder()
                .name("Core Engine <b>Alpha</b>")
                .description("Project for testing HTML escaping")
                .owner(testUser)
                .build());

        projectMemberRepository.save(ProjectMember.builder()
                .project(testProject)
                .user(testUser)
                .role("Owner")
                .build());
    }

    @AfterEach
    @org.springframework.transaction.annotation.Transactional
    void tearDown() {
        try {
            if (testProject != null && testProject.getId() != null) {
                entityManager.createNativeQuery("DELETE FROM project_members WHERE project_id = :pid")
                        .setParameter("pid", testProject.getId()).executeUpdate();
                entityManager.createNativeQuery("DELETE FROM tasks WHERE project_id = :pid")
                        .setParameter("pid", testProject.getId()).executeUpdate();
                entityManager.createNativeQuery("DELETE FROM projects WHERE id = :pid")
                        .setParameter("pid", testProject.getId()).executeUpdate();
            }
            if (testUser != null && testUser.getId() != null) {
                entityManager.createNativeQuery("DELETE FROM user_profiles WHERE user_id = :uid")
                        .setParameter("uid", testUser.getId()).executeUpdate();
                entityManager.createNativeQuery("DELETE FROM users WHERE id = :uid")
                        .setParameter("uid", testUser.getId()).executeUpdate();
            }
        } catch (Exception ignored) {
        }
        if (!greenMail.isRunning()) {
            greenMail.start();
        }
    }

    // -------------------------------------------------------------------------
    // 1. Template Rendering & HTML Auto-Escaping (Task 1 & Task 5)
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Thymeleaf templates auto-escape HTML in user inputs like <script> and <b>")
    void testTemplateRendering_escapesUserInput() {
        Context ctx = new Context();
        ctx.setVariable("recipientName", "Alice <script>alert('xss')</script>");
        ctx.setVariable("code", "1234");
        ctx.setVariable("expiryMinutes", 10);
        ctx.setVariable("appName", "Taskoura");
        ctx.setVariable("frontendUrl", "http://localhost:5173");
        ctx.setVariable("currentYear", 2026);

        String renderedVerification = templateEngine.process("email/verification-code", ctx);
        assertThat(renderedVerification).contains("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
        assertThat(renderedVerification).doesNotContain("<script>alert('xss')</script>");

        ctx.setVariable("taskTitle", "Task <b>Urgent</b>");
        ctx.setVariable("projectName", "Project <script>");
        ctx.setVariable("priority", "High");
        ctx.setVariable("deadline", "Tomorrow");
        ctx.setVariable("taskUrl", "http://localhost:5173/app/projects/1?task=2");

        String renderedTaskAssigned = templateEngine.process("email/task-assigned", ctx);
        assertThat(renderedTaskAssigned).contains("Task &lt;b&gt;Urgent&lt;/b&gt;");
        assertThat(renderedTaskAssigned).doesNotContain("Task <b>Urgent</b>");
        assertThat(renderedTaskAssigned).contains("Project &lt;script&gt;");

        ctx.setVariable("inviterName", "Boss <img src=x onerror=alert(1)>");
        ctx.setVariable("role", "Admin");
        ctx.setVariable("projectUrl", "http://localhost:5173/app/projects/1");
        String renderedInvite = templateEngine.process("email/project-invite", ctx);
        assertThat(renderedInvite).contains("&lt;img src=x onerror=alert(1)&gt;");
        assertThat(renderedInvite).doesNotContain("<img src=x onerror=alert(1)>");
    }

    @Autowired private UserService userService;

    // -------------------------------------------------------------------------
    // 2. GreenMail Multipart Alternative Verification (Task 1 & Task 2)
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Email sending creates multipart message with both text/plain and text/html alternatives and proper sender")
    void testMultipartEmailStructure() throws Exception {
        emailService.sendVerificationEmail("recipient@example.com", "Bob", "5678");

        MimeMessage[] receivedMessages = greenMail.getReceivedMessages();
        assertThat(receivedMessages).hasSize(1);

        MimeMessage message = receivedMessages[0];
        assertThat(message.getSubject()).isEqualTo("Taskoura — Your verification code");
        assertThat(message.getFrom()[0].toString()).contains("Taskoura Team");
        assertThat(message.getFrom()[0].toString()).contains("support@taskoura.dev");

        // Assert multipart content (text/plain and text/html)
        assertThat(message.getContent()).isInstanceOf(MimeMultipart.class);
        MimeMultipart multipart = (MimeMultipart) message.getContent();

        StringBuilder plainText = new StringBuilder();
        StringBuilder htmlText = new StringBuilder();
        extractParts(multipart, plainText, htmlText);

        assertThat(plainText.toString()).contains("Your verification code is: 5678");
        assertThat(htmlText.toString()).contains("5678");
        assertThat(htmlText.toString()).contains("<!DOCTYPE html>");
    }

    private void extractParts(MimeMultipart multipart, StringBuilder plain, StringBuilder html) throws Exception {
        for (int i = 0; i < multipart.getCount(); i++) {
            BodyPart part = multipart.getBodyPart(i);
            if (part.isMimeType("text/plain")) {
                plain.append(part.getContent().toString());
            } else if (part.isMimeType("text/html")) {
                html.append(part.getContent().toString());
            } else if (part.getContent() instanceof MimeMultipart nested) {
                extractParts(nested, plain, html);
            }
        }
    }

    // -------------------------------------------------------------------------
    // 3. Preferences Gate Optional Emails (Task 1 & Task 3, Phase 5 depend)
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Notification preferences gate optional emails: taskAssigned, deadlineReminders, mentions, projectInvites, statusChanges")
    void testNotificationPreferencesGateOptionalEmails() throws Exception {
        // Disable all notification preferences via UserService
        userService.updateProfileDetails(testUser.getEmail(), new ProfileDtos.UpdateProfileDetailsRequest(
                null, null, null, null, null, null, null, null, null, null,
                new ProfileDtos.NotificationPrefsDto(false, false, false, false, false)
        ));

        // Try sending each optional email type
        emailService.sendTaskAssignedEmail(testUser, "Test Task", testProject.getName(), testProject.getId(), UUID.randomUUID(), "High", LocalDate.now().plusDays(3));
        emailService.sendDeadlineReminderEmail(testUser, "Test Task", testProject.getName(), testProject.getId(), UUID.randomUUID(), LocalDate.now().plusDays(1));
        emailService.sendMentionEmail(testUser, "Mentioner", "Test Task", testProject.getName(), testProject.getId(), UUID.randomUUID(), "Hey @Alice please check this");
        emailService.sendProjectInviteEmail(testUser, "Inviter", testProject.getName(), testProject.getId(), "Member");
        emailService.sendTaskStatusChangedEmail(testUser, "Test Task", testProject.getName(), testProject.getId(), UUID.randomUUID(), "InProgress", "Completed", "Updater");

        // Wait briefly for async tasks if any
        Thread.sleep(500);

        // Assert that NO emails were sent because preferences gated all of them!
        assertThat(greenMail.getReceivedMessages()).isEmpty();

        // Now enable statusChanges and taskAssigned
        userService.updateProfileDetails(testUser.getEmail(), new ProfileDtos.UpdateProfileDetailsRequest(
                null, null, null, null, null, null, null, null, null, null,
                new ProfileDtos.NotificationPrefsDto(true, false, false, false, true)
        ));

        emailService.sendTaskAssignedEmail(testUser, "Allowed Task", testProject.getName(), testProject.getId(), UUID.randomUUID(), "Medium", LocalDate.now().plusDays(3));
        emailService.sendTaskStatusChangedEmail(testUser, "Allowed Task", testProject.getName(), testProject.getId(), UUID.randomUUID(), "InProgress", "Completed", "Updater");

        // Wait for @Async completion
        greenMail.waitForIncomingEmail(3000, 2);
        assertThat(greenMail.getReceivedMessages()).hasSize(2);
    }

    // -------------------------------------------------------------------------
    // 4. Critical Account Emails Always Send (Contract)
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Account emails (verification, password reset, welcome, security alert) always send regardless of prefs")
    void testCriticalEmailsAlwaysSend() throws Exception {
        // Disable all notification preferences via UserService
        userService.updateProfileDetails(testUser.getEmail(), new ProfileDtos.UpdateProfileDetailsRequest(
                null, null, null, null, null, null, null, null, null, null,
                new ProfileDtos.NotificationPrefsDto(false, false, false, false, false)
        ));

        // Verification email
        emailService.sendVerificationEmail(testUser.getEmail(), testUser.getName(), "1111");
        // Password reset email
        emailService.sendPasswordResetEmail(testUser.getEmail(), testUser.getName(), "2222");
        // Welcome email
        emailService.sendWelcomeEmail(testUser.getEmail(), testUser.getName());
        // Password changed security alert
        emailService.sendPasswordChangedEmail(testUser.getEmail(), testUser.getName());

        greenMail.waitForIncomingEmail(3000, 4);
        assertThat(greenMail.getReceivedMessages()).hasSize(4);
    }

    // -------------------------------------------------------------------------
    // 5. OTP Hardening: Hashing at Rest, Expiry, Single Use (Task 4)
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("OTP is stored as HMAC-SHA256 at rest, expires after configured minutes, and is single-use")
    void testOtpHardening_hashingExpirySingleUse() {
        // Generate and send verification OTP
        otpService.generateAndSendOtp(testUser);

        User reloaded = userRepository.findById(testUser.getId()).orElseThrow();
        String storedHash = reloaded.getOtpCode();

        // Hash at rest: 64-char hex string, not a 4-digit code
        assertThat(storedHash).isNotNull().hasSize(64);
        assertThat(storedHash).doesNotMatch("^\\d{4}$");
        assertThat(reloaded.getOtpExpiresAt()).isAfter(LocalDateTime.now());
        assertThat(reloaded.getOtpAttempts()).isEqualTo(0);

        // Expiry check: simulate expired code
        reloaded.setOtpExpiresAt(LocalDateTime.now().minusMinutes(1));
        userRepository.save(reloaded);

        boolean expiredVerified = otpService.verifyOtp(reloaded, "1234");
        assertThat(expiredVerified).isFalse();

        // Single-use check: set fresh valid OTP
        reloaded.setOtpCode(otpService.hashOtp("7777"));
        reloaded.setOtpExpiresAt(LocalDateTime.now().plusMinutes(10));
        reloaded.setOtpAttempts(0);
        userRepository.save(reloaded);

        boolean success = otpService.verifyOtp(reloaded, "7777");
        assertThat(success).isTrue();

        // Code and expiration must be cleared after single use
        User verifiedUser = userRepository.findById(testUser.getId()).orElseThrow();
        assertThat(verifiedUser.isVerified()).isTrue();
        assertThat(verifiedUser.getOtpCode()).isNull();
        assertThat(verifiedUser.getOtpExpiresAt()).isNull();

        // Second attempt with same code fails (single-use)
        boolean reuseSuccess = otpService.verifyOtp(verifiedUser, "7777");
        assertThat(reuseSuccess).isFalse();
    }

    // -------------------------------------------------------------------------
    // 6. OTP Hardening: 5 Wrong Attempts Invalidation (Contract & Task 4)
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Wrong OTP: 400 VALIDATION_FAILED stays; after 5 wrong attempts code is invalidated with OTP_ATTEMPTS_EXCEEDED")
    void testOtpAttemptLimit_fiveWrongAttemptsInvalidatesCode() {
        testUser.setOtpCode(otpService.hashOtp("4321"));
        testUser.setOtpExpiresAt(LocalDateTime.now().plusMinutes(10));
        testUser.setOtpAttempts(0);
        userRepository.save(testUser);

        // 4 wrong attempts: return false and increment attempts counter
        for (int i = 1; i <= 4; i++) {
            boolean result = otpService.verifyOtp(testUser, "0000");
            assertThat(result).isFalse();
            User userInDb = userRepository.findById(testUser.getId()).orElseThrow();
            assertThat(userInDb.getOtpAttempts()).isEqualTo(i);
            assertThat(userInDb.getOtpCode()).isNotNull();
        }

        // 5th wrong attempt: throws OtpAttemptsExceededException, clears code and expiresAt
        assertThatThrownBy(() -> otpService.verifyOtp(testUser, "0000"))
                .isInstanceOf(OtpAttemptsExceededException.class)
                .hasMessage("Too many attempts. Request a new code.");

        User invalidatedUser = userRepository.findById(testUser.getId()).orElseThrow();
        assertThat(invalidatedUser.getOtpCode()).isNull();
        assertThat(invalidatedUser.getOtpExpiresAt()).isNull();

        // Subsequent attempt with even the correct code fails
        assertThat(otpService.verifyOtp(invalidatedUser, "4321")).isFalse();
    }

    @Test
    @DisplayName("Reset OTP: 5 wrong attempts invalidates code with OTP_ATTEMPTS_EXCEEDED")
    void testResetOtpAttemptLimit_fiveWrongAttemptsInvalidatesCode() {
        testUser.setResetOtpCode(otpService.hashOtp("9876"));
        testUser.setResetOtpExpiresAt(LocalDateTime.now().plusMinutes(10));
        testUser.setResetOtpAttempts(0);
        userRepository.save(testUser);

        for (int i = 1; i <= 4; i++) {
            boolean result = otpService.verifyResetOtp(testUser, "0000");
            assertThat(result).isFalse();
            User userInDb = userRepository.findById(testUser.getId()).orElseThrow();
            assertThat(userInDb.getResetOtpAttempts()).isEqualTo(i);
        }

        assertThatThrownBy(() -> otpService.verifyResetOtp(testUser, "0000"))
                .isInstanceOf(OtpAttemptsExceededException.class)
                .hasMessage("Too many attempts. Request a new code.");

        User invalidatedUser = userRepository.findById(testUser.getId()).orElseThrow();
        assertThat(invalidatedUser.getResetOtpCode()).isNull();
        assertThat(invalidatedUser.getResetOtpExpiresAt()).isNull();
    }

    // -------------------------------------------------------------------------
    // 7. OTP Hardening: 30-Second Cooldown (Contract & Task 4)
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Resend and forgot-password within 30 seconds of last send throws 429 RateLimitedException with retryAfterSeconds")
    void testOtpResendCooldown_rateLimited() {
        // First send succeeds
        otpService.generateAndSendOtp(testUser);

        // Immediate second send fails with RateLimitedException
        assertThatThrownBy(() -> otpService.generateAndSendOtp(testUser))
                .isInstanceOf(RateLimitedException.class)
                .hasMessage("Please wait before requesting another code.")
                .satisfies(e -> {
                    RateLimitedException rle = (RateLimitedException) e;
                    assertThat(rle.getRetryAfterSeconds()).isBetween(1, 30);
                });

        // Same for reset OTP
        testUser.setVerified(true);
        userRepository.save(testUser);

        otpService.generateAndSendResetOtp(testUser);

        assertThatThrownBy(() -> otpService.generateAndSendResetOtp(testUser))
                .isInstanceOf(RateLimitedException.class)
                .hasMessage("Please wait before requesting another code.")
                .satisfies(e -> {
                    RateLimitedException rle = (RateLimitedException) e;
                    assertThat(rle.getRetryAfterSeconds()).isBetween(1, 30);
                });
    }

    // -------------------------------------------------------------------------
    // 8. Delivery Failure Mapping (Contract & Task 3)
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Critical email delivery failure throws EmailDeliveryException mapped to 502")
    void testCriticalEmailDeliveryFailure_throwsEmailDeliveryException() {
        // Stop GreenMail server to simulate delivery failure
        greenMail.stop();

        assertThatThrownBy(() -> emailService.sendVerificationEmail(testUser.getEmail(), testUser.getName(), "1234"))
                .isInstanceOf(EmailDeliveryException.class)
                .hasMessage("We could not send the email. Please try again.");

        assertThatThrownBy(() -> emailService.sendPasswordResetEmail(testUser.getEmail(), testUser.getName(), "5678"))
                .isInstanceOf(EmailDeliveryException.class)
                .hasMessage("We could not send the email. Please try again.");
    }

    @Test
    @DisplayName("Optional notification email delivery failure is logged and does not fail business action")
    void testOptionalEmailDeliveryFailure_doesNotThrow() {
        // Stop GreenMail server to simulate delivery failure
        greenMail.stop();

        // Optional email send should NOT throw any exception even if delivery fails
        emailService.sendTaskAssignedEmail(testUser, "Task Failure Test", testProject.getName(), testProject.getId(), UUID.randomUUID(), "Low", LocalDate.now().plusDays(5));
        emailService.sendProjectInviteEmail(testUser, "Inviter", testProject.getName(), testProject.getId(), "Viewer");
        emailService.sendMentionEmail(testUser, "Mentioner", "Failure Task", testProject.getName(), testProject.getId(), UUID.randomUUID(), "Hello");
        emailService.sendDeadlineReminderEmail(testUser, "Deadline Task", testProject.getName(), testProject.getId(), UUID.randomUUID(), LocalDate.now().plusDays(1));
    }
}
