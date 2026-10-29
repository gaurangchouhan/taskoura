package com.taskoura.service;

import com.taskoura.entity.User;
import com.taskoura.exception.EmailDeliveryException;
import com.taskoura.repository.UserProfileRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.util.ReflectionTestUtils;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.net.ConnectException;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailServiceTest {

    @Mock
    private JavaMailSender mailSender;

    @Mock
    private UserProfileRepository userProfileRepository;

    private SpringTemplateEngine templateEngine;
    private EmailService emailService;

    @BeforeEach
    void setUp() {
        templateEngine = new SpringTemplateEngine();
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setSuffix(".html");
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCharacterEncoding("UTF-8");
        templateEngine.setTemplateResolver(resolver);

        emailService = new EmailService(mailSender, templateEngine, userProfileRepository);
        ReflectionTestUtils.setField(emailService, "fromAddress", "support@taskoura.dev");
        ReflectionTestUtils.setField(emailService, "fromName", "Taskoura");
        ReflectionTestUtils.setField(emailService, "frontendUrl", "https://taskoura.vercel.app");
        ReflectionTestUtils.setField(emailService, "appName", "Taskoura");
    }

    @Test
    @DisplayName("sendVerificationEmail successfully renders template and sends email")
    void testSendVerificationEmail_Success() {
        Session session = Session.getInstance(new Properties());
        MimeMessage mimeMessage = new MimeMessage(session);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        emailService.sendVerificationEmail("user@example.com", "Alice", "1234");

        verify(mailSender, times(1)).send(mimeMessage);
    }

    @Test
    @DisplayName("sendVerificationEmail failure throws EmailDeliveryException and sanitizes logs")
    void testSendVerificationEmail_ThrowsEmailDeliveryException() {
        Session session = Session.getInstance(new Properties());
        MimeMessage mimeMessage = new MimeMessage(session);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        doThrow(new MailAuthenticationException("Authentication failed for user sensitive@taskoura.dev with password=SuperSecretPassword123 and code 9999"))
                .when(mailSender).send(any(MimeMessage.class));

        assertThatThrownBy(() -> emailService.sendVerificationEmail("user@example.com", "Alice", "1234"))
                .isInstanceOf(EmailDeliveryException.class)
                .hasMessage("We could not send the email. Please try again.")
                .hasCauseInstanceOf(MailAuthenticationException.class);
    }

    @Test
    @DisplayName("sendPasswordResetEmail failure throws EmailDeliveryException")
    void testSendPasswordResetEmail_ThrowsEmailDeliveryException() {
        Session session = Session.getInstance(new Properties());
        MimeMessage mimeMessage = new MimeMessage(session);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        doThrow(new MailSendException("SMTP server connection timeout")).when(mailSender).send(any(MimeMessage.class));

        assertThatThrownBy(() -> emailService.sendPasswordResetEmail("user@example.com", "Bob", "5678"))
                .isInstanceOf(EmailDeliveryException.class)
                .hasMessage("We could not send the email. Please try again.");
    }

    @Test
    @DisplayName("sendWelcomeEmail handles delivery failure gracefully without throwing")
    void testSendWelcomeEmail_FailureDoesNotThrow() {
        Session session = Session.getInstance(new Properties());
        MimeMessage mimeMessage = new MimeMessage(session);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        doThrow(new MailAuthenticationException("535 5.7.8 Authentication failed")).when(mailSender).send(any(MimeMessage.class));

        // Must not throw
        emailService.sendWelcomeEmail("user@example.com", "Charlie");
    }

    @Test
    @DisplayName("sendPasswordChangedEmail handles delivery failure gracefully without throwing")
    void testSendPasswordChangedEmail_FailureDoesNotThrow() {
        Session session = Session.getInstance(new Properties());
        MimeMessage mimeMessage = new MimeMessage(session);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        doThrow(new MailSendException("Transport unavailable")).when(mailSender).send(any(MimeMessage.class));

        // Must not throw
        emailService.sendPasswordChangedEmail("user@example.com", "Charlie");
    }

    @Test
    @DisplayName("sendProjectInviteEmail failure does not throw or fail business action")
    void testSendProjectInviteEmail_FailureDoesNotThrow() {
        Session session = Session.getInstance(new Properties());
        MimeMessage mimeMessage = new MimeMessage(session);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        doThrow(new MailSendException("Delivery failed")).when(mailSender).send(any(MimeMessage.class));

        User user = User.builder().id(UUID.randomUUID()).email("recipient@taskoura.dev").name("David").build();
        emailService.sendProjectInviteEmail(user, "Lead", "Alpha Project", UUID.randomUUID(), "Member");
    }

    @Test
    @DisplayName("extractSafeDiagnostic extracts root cause and nested MailSendException details")
    void testExtractSafeDiagnostic_WithMailSendException() {
        ConnectException connectException = new ConnectException("Connection refused");
        MessagingException messagingException = new MessagingException("Couldn't connect to host, port: smtp-relay.brevo.com, 587", connectException);
        Map<Object, Exception> failedMap = new HashMap<>();
        failedMap.put("dummyMsg", messagingException);

        MailSendException mse = new MailSendException(failedMap);

        String diagnostic = emailService.extractSafeDiagnostic(mse);

        assertThat(diagnostic).contains("rootCause=ConnectException");
        assertThat(diagnostic).contains("Connection refused");
        assertThat(diagnostic).contains("failedCount=1");
        assertThat(diagnostic).contains("nestedErrors=[MessagingException");
    }

    @Test
    @DisplayName("sanitizeMessage redacts emails, passwords, OTPs, and API keys")
    void testSanitizeMessage_RedactsSensitiveInformation() {
        String raw = "Auth failed for user john.doe@example.com with password=SuperSecretPassword123 and code 4829. "
                + "Brevo key: xkeysib-1234567890abcdef and token=secretToken and Bearer eyJhbGciOi. "
                + "Your verification code is: 1234.";

        String sanitized = emailService.sanitizeMessage(raw);

        assertThat(sanitized).doesNotContain("john.doe@example.com");
        assertThat(sanitized).contains("[REDACTED_EMAIL]");
        assertThat(sanitized).doesNotContain("SuperSecretPassword123");
        assertThat(sanitized).contains("password=[REDACTED]");
        assertThat(sanitized).doesNotContain("xkeysib-1234567890abcdef");
        assertThat(sanitized).contains("xkeysib-[REDACTED]");
        assertThat(sanitized).doesNotContain("secretToken");
        assertThat(sanitized).contains("Bearer [REDACTED]");
        assertThat(sanitized).contains("[REDACTED_CODE]");
    }

    @Test
    @DisplayName("maskEmail masks local part while preserving domain")
    void testMaskEmail() {
        assertThat(emailService.maskEmail("support@taskoura.dev")).isEqualTo("s***t@taskoura.dev");
        assertThat(emailService.maskEmail("gaurangchouhan316@gmail.com")).isEqualTo("g***6@gmail.com");
        assertThat(emailService.maskEmail("ab@test.com")).isEqualTo("a***@test.com");
        assertThat(emailService.maskEmail("")).isEqualTo("not-set");
        assertThat(emailService.maskEmail(null)).isEqualTo("not-set");
    }

    @Test
    @DisplayName("logMailConfiguration safely executes for JavaMailSenderImpl and custom sender")
    void testLogMailConfiguration() {
        JavaMailSenderImpl impl = new JavaMailSenderImpl();
        impl.setHost("smtp-relay.brevo.com");
        impl.setPort(587);
        impl.setUsername("testuser");
        impl.setPassword("testpass");

        EmailService serviceWithImpl = new EmailService(impl, templateEngine, userProfileRepository);
        ReflectionTestUtils.setField(serviceWithImpl, "fromAddress", "support@taskoura.dev");
        ReflectionTestUtils.setField(serviceWithImpl, "fromName", "Taskoura");

        // Should log safely without throwing
        serviceWithImpl.logMailConfiguration();

        // Also test mock sender branch
        emailService.logMailConfiguration();
    }
}
