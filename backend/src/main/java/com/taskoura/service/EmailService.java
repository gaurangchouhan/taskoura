package com.taskoura.service;

import com.taskoura.entity.User;
import com.taskoura.entity.UserProfile;
import com.taskoura.exception.EmailDeliveryException;
import com.taskoura.repository.UserProfileRepository;
import jakarta.annotation.PostConstruct;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}");
    private static final Pattern OTP_PATTERN =
            Pattern.compile("(?i)(?:code|otp|pin|token)[:=\\s]+[0-9a-zA-Z]{4,8}\\b");
    private static final Pattern VERIFICATION_CODE_PHRASE =
            Pattern.compile("(?i)(your (?:verification|reset) code is:?\\s*)[0-9a-zA-Z]+");
    private static final Pattern SECRET_PATTERN =
            Pattern.compile("(?i)(password|passwd|secret|token|pwd|apikey|apiKey)\\s*[:=]\\s*\\S+");
    private static final Pattern BEARER_PATTERN =
            Pattern.compile("(?i)bearer\\s+[a-zA-Z0-9_\\-\\.]+");
    private static final Pattern BREVO_KEY_PATTERN =
            Pattern.compile("xkeysib-[a-zA-Z0-9\\-]+");
    private static final Pattern SENDGRID_KEY_PATTERN =
            Pattern.compile("SG\\.[a-zA-Z0-9_\\-\\.]+");

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;
    private final UserProfileRepository userProfileRepository;

    @Value("${MAIL_FROM:${mail.from-address:${spring.mail.username:support@taskoura.dev}}}")
    private String fromAddress;

    @Value("${MAIL_FROM_NAME:${mail.from-name:Taskoura}}")
    private String fromName;

    @Value("${FRONTEND_URL:${app.frontend-url:http://localhost:5173}}")
    private String frontendUrl;

    @Value("${APP_NAME:${app.name:Taskoura}}")
    private String appName;

    public EmailService(JavaMailSender mailSender,
                        TemplateEngine templateEngine,
                        @Autowired(required = false) UserProfileRepository userProfileRepository) {
        this.mailSender = mailSender;
        this.templateEngine = templateEngine;
        this.userProfileRepository = userProfileRepository;
    }

    @PostConstruct
    public void logMailConfiguration() {
        if (mailSender instanceof JavaMailSenderImpl impl) {
            String host = impl.getHost();
            int port = impl.getPort();
            boolean usernameConfigured = impl.getUsername() != null && !impl.getUsername().isBlank();
            boolean passwordConfigured = impl.getPassword() != null && !impl.getPassword().isBlank();
            log.info("EmailService initialized: host={}, port={}, authConfigured={}, passwordConfigured={}, fromAddress='{} <{}>'",
                    host != null ? host : "default",
                    port,
                    usernameConfigured,
                    passwordConfigured,
                    fromName,
                    maskEmail(fromAddress));
        } else {
            log.info("EmailService initialized with custom JavaMailSender: fromAddress='{} <{}>'",
                    fromName,
                    maskEmail(fromAddress));
        }
    }

    // -------------------------------------------------------------------------
    // Critical (Synchronous) Account Emails
    // -------------------------------------------------------------------------

    public void sendVerificationEmail(String toEmail, String recipientName, String code) {
        String safeName = (recipientName != null && !recipientName.isBlank()) ? recipientName.trim() : "there";
        Context ctx = createContext();
        ctx.setVariable("recipientName", safeName);
        ctx.setVariable("code", code);
        ctx.setVariable("expiryMinutes", 10);

        String html = templateEngine.process("email/verification-code", ctx);
        String plain = "Hello " + safeName + ",\n\n"
                + "Thank you for signing up for Taskoura. Your verification code is: " + code + "\n\n"
                + "This code expires in 10 minutes and can only be used once.\n\n"
                + "If you did not request this, you can safely ignore this email.\n\n"
                + "— The Taskoura Team";

        sendCriticalEmail(toEmail, appName + " — Your verification code", html, plain);
    }

    public void sendPasswordResetEmail(String toEmail, String recipientName, String code) {
        String safeName = (recipientName != null && !recipientName.isBlank()) ? recipientName.trim() : "there";
        Context ctx = createContext();
        ctx.setVariable("recipientName", safeName);
        ctx.setVariable("code", code);
        ctx.setVariable("expiryMinutes", 10);

        String html = templateEngine.process("email/password-reset", ctx);
        String plain = "Hello " + safeName + ",\n\n"
                + "We received a request to reset your password. Your one-time reset code is: " + code + "\n\n"
                + "This code expires in 10 minutes and can only be used once.\n\n"
                + "If you did not request a password reset, your account is secure. Do not share this code with anyone.\n\n"
                + "— The Taskoura Team";

        sendCriticalEmail(toEmail, appName + " — Password reset code", html, plain);
    }

    public void sendWelcomeEmail(String toEmail, String recipientName) {
        String safeName = (recipientName != null && !recipientName.isBlank()) ? recipientName.trim() : "there";
        Context ctx = createContext();
        ctx.setVariable("recipientName", safeName);
        ctx.setVariable("dashboardUrl", frontendUrl + "/app");

        String html = templateEngine.process("email/welcome", ctx);
        String plain = "Hello " + safeName + ",\n\n"
                + "Welcome to Taskoura! Your account has been verified and is ready to use.\n\n"
                + "Access your dashboard here: " + frontendUrl + "/app\n\n"
                + "— The Taskoura Team";

        try {
            sendCriticalEmail(toEmail, "Welcome to " + appName + "!", html, plain);
        } catch (Exception e) {
            log.error("Failed to deliver welcome email to recipient. Diagnostic: [{}]", extractSafeDiagnostic(e));
        }
    }

    public void sendPasswordChangedEmail(String toEmail, String recipientName) {
        String safeName = (recipientName != null && !recipientName.isBlank()) ? recipientName.trim() : "there";
        String changedAt = DateTimeFormatter.RFC_1123_DATE_TIME.format(ZonedDateTime.now(ZoneOffset.UTC));
        Context ctx = createContext();
        ctx.setVariable("recipientName", safeName);
        ctx.setVariable("changedAt", changedAt);
        ctx.setVariable("forgotPasswordUrl", frontendUrl + "/forgot-password");

        String html = templateEngine.process("email/password-changed", ctx);
        String plain = "Hello " + safeName + ",\n\n"
                + "The password for your Taskoura account was successfully changed on " + changedAt + ".\n\n"
                + "If you did not make this change, please immediately reset your password here: "
                + frontendUrl + "/forgot-password\n\n"
                + "— The Taskoura Team";

        try {
            sendCriticalEmail(toEmail, appName + " Security Alert — Your password was changed", html, plain);
        } catch (Exception e) {
            log.error("Failed to deliver password-changed security email to recipient. Diagnostic: [{}]", extractSafeDiagnostic(e));
        }
    }

    // Legacy signatures for backward compatibility
    public void sendOtpEmail(String toEmail, String otpCode) {
        sendVerificationEmail(toEmail, "there", otpCode);
    }

    // -------------------------------------------------------------------------
    // Optional (Asynchronous) Notification Emails (Gated by User Preferences)
    // -------------------------------------------------------------------------

    @Async("emailTaskExecutor")
    public void sendProjectInviteEmail(User recipient, String inviterName, String projectName, UUID projectId, String role) {
        if (recipient == null || recipient.getEmail() == null) return;
        if (!isPrefEnabled(recipient.getId(), UserProfile::isPrefProjectInvites, true)) {
            log.debug("Skipping project invite email for user {}: pref disabled", recipient.getEmail());
            return;
        }

        String safeRecipientName = recipient.getName() != null ? recipient.getName().trim() : "there";
        String safeInviter = inviterName != null ? inviterName.trim() : "A team lead";
        String safeRole = role != null ? role : "Member";

        Context ctx = createContext();
        ctx.setVariable("recipientName", safeRecipientName);
        ctx.setVariable("inviterName", safeInviter);
        ctx.setVariable("projectName", projectName);
        ctx.setVariable("role", safeRole);
        ctx.setVariable("projectUrl", frontendUrl + "/app/projects/" + projectId);

        String html = templateEngine.process("email/project-invite", ctx);
        String plain = "Hello " + safeRecipientName + ",\n\n"
                + safeInviter + " invited you to collaborate on project \"" + projectName + "\" as " + safeRole + ".\n\n"
                + "Open project: " + frontendUrl + "/app/projects/" + projectId + "\n\n"
                + "— The Taskoura Team";

        sendOptionalEmail(recipient.getEmail(), "PROJECT_INVITE",
                "You've been invited to join " + projectName + " on " + appName, html, plain);
    }

    @Async("emailTaskExecutor")
    public void sendTaskAssignedEmail(User recipient, String taskTitle, String projectName,
                                      UUID projectId, UUID taskId, String priority, LocalDate deadline) {
        if (recipient == null || recipient.getEmail() == null) return;
        if (!isPrefEnabled(recipient.getId(), UserProfile::isPrefTaskAssigned, true)) {
            log.debug("Skipping task assigned email for user {}: pref disabled", recipient.getEmail());
            return;
        }

        String safeRecipientName = recipient.getName() != null ? recipient.getName().trim() : "there";
        Context ctx = createContext();
        ctx.setVariable("recipientName", safeRecipientName);
        ctx.setVariable("taskTitle", taskTitle);
        ctx.setVariable("projectName", projectName);
        ctx.setVariable("priority", priority);
        ctx.setVariable("deadline", deadline != null ? deadline.toString() : null);
        ctx.setVariable("taskUrl", frontendUrl + "/app/projects/" + projectId + "?task=" + taskId);

        String html = templateEngine.process("email/task-assigned", ctx);
        String plain = "Hello " + safeRecipientName + ",\n\n"
                + "You have been assigned to task: \"" + taskTitle + "\" in project \"" + projectName + "\".\n"
                + (deadline != null ? "Deadline: " + deadline + "\n" : "")
                + "View task: " + frontendUrl + "/app/projects/" + projectId + "?task=" + taskId + "\n\n"
                + "— The Taskoura Team";

        sendOptionalEmail(recipient.getEmail(), "TASK_ASSIGNED",
                "Task assigned: " + taskTitle + " [" + projectName + "]", html, plain);
    }

    @Async("emailTaskExecutor")
    public void sendDeadlineReminderEmail(User recipient, String taskTitle, String projectName,
                                          UUID projectId, UUID taskId, LocalDate deadline) {
        if (recipient == null || recipient.getEmail() == null) return;
        if (!isPrefEnabled(recipient.getId(), UserProfile::isPrefDeadlineReminders, true)) {
            log.debug("Skipping deadline reminder email for user {}: pref disabled", recipient.getEmail());
            return;
        }

        String safeRecipientName = recipient.getName() != null ? recipient.getName().trim() : "there";
        Context ctx = createContext();
        ctx.setVariable("recipientName", safeRecipientName);
        ctx.setVariable("taskTitle", taskTitle);
        ctx.setVariable("projectName", projectName);
        ctx.setVariable("deadline", deadline != null ? deadline.toString() : "tomorrow");
        ctx.setVariable("taskUrl", frontendUrl + "/app/projects/" + projectId + "?task=" + taskId);

        String html = templateEngine.process("email/deadline-reminder", ctx);
        String plain = "Hello " + safeRecipientName + ",\n\n"
                + "Reminder: Task \"" + taskTitle + "\" in project \"" + projectName + "\" is due tomorrow.\n\n"
                + "View task: " + frontendUrl + "/app/projects/" + projectId + "?task=" + taskId + "\n\n"
                + "— The Taskoura Team";

        sendOptionalEmail(recipient.getEmail(), "DEADLINE_REMINDER",
                "Reminder: " + taskTitle + " is due tomorrow [" + projectName + "]", html, plain);
    }

    @Async("emailTaskExecutor")
    public void sendMentionEmail(User recipient, String commenterName, String taskTitle,
                                 String projectName, UUID projectId, UUID taskId, String commentSnippet) {
        if (recipient == null || recipient.getEmail() == null) return;
        if (!isPrefEnabled(recipient.getId(), UserProfile::isPrefMentions, true)) {
            log.debug("Skipping mention email for user {}: pref disabled", recipient.getEmail());
            return;
        }

        String safeRecipientName = recipient.getName() != null ? recipient.getName().trim() : "there";
        String safeCommenter = commenterName != null ? commenterName.trim() : "A teammate";
        String cleanSnippet = (commentSnippet != null && commentSnippet.length() > 200)
                ? commentSnippet.substring(0, 197) + "..." : commentSnippet;

        Context ctx = createContext();
        ctx.setVariable("recipientName", safeRecipientName);
        ctx.setVariable("commenterName", safeCommenter);
        ctx.setVariable("taskTitle", taskTitle);
        ctx.setVariable("projectName", projectName);
        ctx.setVariable("commentSnippet", cleanSnippet);
        ctx.setVariable("taskUrl", frontendUrl + "/app/projects/" + projectId + "?task=" + taskId);

        String html = templateEngine.process("email/mention", ctx);
        String plain = "Hello " + safeRecipientName + ",\n\n"
                + safeCommenter + " mentioned you in a comment on task \"" + taskTitle + "\" (" + projectName + "):\n\n"
                + "\"" + cleanSnippet + "\"\n\n"
                + "View comment: " + frontendUrl + "/app/projects/" + projectId + "?task=" + taskId + "\n\n"
                + "— The Taskoura Team";

        sendOptionalEmail(recipient.getEmail(), "MENTION",
                safeCommenter + " mentioned you in a comment on " + taskTitle, html, plain);
    }

    @Async("emailTaskExecutor")
    public void sendTaskStatusChangedEmail(User recipient, String taskTitle, String projectName,
                                           UUID projectId, UUID taskId, String updatedByName,
                                           String oldStatus, String newStatus) {
        if (recipient == null || recipient.getEmail() == null) return;
        if (!isPrefEnabled(recipient.getId(), UserProfile::isPrefStatusChanges, false)) {
            log.debug("Skipping status changed email for user {}: pref disabled", recipient.getEmail());
            return;
        }

        String safeRecipientName = recipient.getName() != null ? recipient.getName().trim() : "there";
        String safeUpdater = updatedByName != null ? updatedByName.trim() : "A teammate";

        Context ctx = createContext();
        ctx.setVariable("recipientName", safeRecipientName);
        ctx.setVariable("taskTitle", taskTitle);
        ctx.setVariable("projectName", projectName);
        ctx.setVariable("updatedByName", safeUpdater);
        ctx.setVariable("oldStatus", oldStatus);
        ctx.setVariable("newStatus", newStatus);
        ctx.setVariable("taskUrl", frontendUrl + "/app/projects/" + projectId + "?task=" + taskId);

        String html = templateEngine.process("email/task-status-changed", ctx);
        String plain = "Hello " + safeRecipientName + ",\n\n"
                + safeUpdater + " updated task \"" + taskTitle + "\" status from " + oldStatus + " to " + newStatus + ".\n\n"
                + "View task: " + frontendUrl + "/app/projects/" + projectId + "?task=" + taskId + "\n\n"
                + "— The Taskoura Team";

        sendOptionalEmail(recipient.getEmail(), "TASK_STATUS_CHANGED",
                "Task status updated: " + taskTitle + " is now " + newStatus, html, plain);
    }

    // -------------------------------------------------------------------------
    // Core Email Sending Helpers
    // -------------------------------------------------------------------------

    private void sendCriticalEmail(String toEmail, String subject, String htmlContent, String plainTextContent) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());

            String effectiveFrom = (fromAddress != null && !fromAddress.trim().isEmpty())
                    ? fromAddress.trim() : "support@taskoura.dev";
            if (fromName != null && !fromName.isBlank()) {
                helper.setFrom(new InternetAddress(effectiveFrom, fromName.trim()));
            } else {
                helper.setFrom(effectiveFrom);
            }

            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(plainTextContent, htmlContent);

            mailSender.send(message);
        } catch (Exception e) {
            String diagnostic = extractSafeDiagnostic(e);
            log.error("Critical email delivery failed to recipient. Exception: [{}], Root Cause: [{}], Diagnostic: [{}]",
                    e.getClass().getName(),
                    getRootCauseDescription(e),
                    diagnostic);
            throw new EmailDeliveryException("We could not send the email. Please try again.", e);
        }
    }

    private void sendOptionalEmail(String toEmail, String emailType, String subject, String htmlContent, String plainTextContent) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());

            String effectiveFrom = (fromAddress != null && !fromAddress.trim().isEmpty())
                    ? fromAddress.trim() : "support@taskoura.dev";
            if (fromName != null && !fromName.isBlank()) {
                helper.setFrom(new InternetAddress(effectiveFrom, fromName.trim()));
            } else {
                helper.setFrom(effectiveFrom);
            }

            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(plainTextContent, htmlContent);

            mailSender.send(message);
        } catch (Exception e) {
            // Task 3: "a failure is logged (type only, never the code, token or message body) and never fails the business action."
            log.error("Failed to send optional email of type {}. Diagnostic: [{}]", emailType, extractSafeDiagnostic(e));
        }
    }

    // -------------------------------------------------------------------------
    // Safe Diagnostic & Sanitization Helpers
    // -------------------------------------------------------------------------

    String extractSafeDiagnostic(Throwable throwable) {
        if (throwable == null) {
            return "No exception provided";
        }
        StringBuilder sb = new StringBuilder();

        Throwable rootCause = getRootCause(throwable);
        sb.append("rootCause=").append(rootCause.getClass().getSimpleName());
        appendSmtpDetails(sb, rootCause);
        if (rootCause.getMessage() != null && !rootCause.getMessage().isBlank()) {
            sb.append(": ").append(sanitizeMessage(rootCause.getMessage()));
        }

        if (throwable instanceof MailSendException mse) {
            Map<Object, Exception> failed = mse.getFailedMessages();
            if (failed != null && !failed.isEmpty()) {
                sb.append(" | failedCount=").append(failed.size());
            }
            Exception[] messageExceptions = mse.getMessageExceptions();
            if (messageExceptions != null && messageExceptions.length > 0) {
                sb.append(" | nestedErrors=[");
                for (int i = 0; i < messageExceptions.length; i++) {
                    if (i > 0) sb.append(", ");
                    Exception ex = messageExceptions[i];
                    sb.append(ex.getClass().getSimpleName());
                    appendSmtpDetails(sb, ex);
                    if (ex.getMessage() != null && !ex.getMessage().isBlank()) {
                        sb.append(": ").append(sanitizeMessage(ex.getMessage()));
                    }
                }
                sb.append("]");
            }
        }

        return sb.toString();
    }

    private void appendSmtpDetails(StringBuilder sb, Throwable ex) {
        if (ex == null) return;
        try {
            Method getReturnCode = ex.getClass().getMethod("getReturnCode");
            Object code = getReturnCode.invoke(ex);
            if (code != null) {
                sb.append("(smtpCode=").append(code).append(")");
            }
        } catch (Exception ignored) {
            // No getReturnCode method
        }
    }

    private Throwable getRootCause(Throwable throwable) {
        if (throwable instanceof MailSendException mse) {
            Exception[] msgExceptions = mse.getMessageExceptions();
            if (msgExceptions != null && msgExceptions.length > 0) {
                return getRootCause(msgExceptions[0]);
            }
        }
        Throwable root = throwable;
        while (root != null) {
            Throwable next = root.getCause();
            if (next == null && root instanceof MessagingException me) {
                Exception nextEx = me.getNextException();
                if (nextEx != null && nextEx != root) {
                    next = nextEx;
                }
            }
            if (next == null || next == root) {
                break;
            }
            root = next;
        }
        return root;
    }

    private String getRootCauseDescription(Throwable throwable) {
        Throwable root = getRootCause(throwable);
        String name = root.getClass().getSimpleName();
        String msg = root.getMessage();
        if (msg == null || msg.isBlank()) {
            return name;
        }
        return name + ": " + sanitizeMessage(msg);
    }

    String sanitizeMessage(String message) {
        if (message == null || message.isBlank()) {
            return "";
        }
        String sanitized = message;
        sanitized = EMAIL_PATTERN.matcher(sanitized).replaceAll("[REDACTED_EMAIL]");
        sanitized = VERIFICATION_CODE_PHRASE.matcher(sanitized).replaceAll("$1[REDACTED_CODE]");
        sanitized = OTP_PATTERN.matcher(sanitized).replaceAll("code=[REDACTED_CODE]");
        sanitized = SECRET_PATTERN.matcher(sanitized).replaceAll("$1=[REDACTED]");
        sanitized = BEARER_PATTERN.matcher(sanitized).replaceAll("Bearer [REDACTED]");
        sanitized = BREVO_KEY_PATTERN.matcher(sanitized).replaceAll("xkeysib-[REDACTED]");
        sanitized = SENDGRID_KEY_PATTERN.matcher(sanitized).replaceAll("SG.[REDACTED]");

        if (sanitized.length() > 300) {
            sanitized = sanitized.substring(0, 297) + "...";
        }
        return sanitized;
    }

    String maskEmail(String email) {
        if (email == null || email.isBlank()) {
            return "not-set";
        }
        int atIdx = email.indexOf('@');
        if (atIdx <= 1) {
            return "***" + email.substring(Math.max(0, atIdx));
        }
        String local = email.substring(0, atIdx);
        String domain = email.substring(atIdx);
        if (local.length() <= 2) {
            return local.charAt(0) + "***" + domain;
        }
        return local.charAt(0) + "***" + local.charAt(local.length() - 1) + domain;
    }

    private boolean isPrefEnabled(UUID userId, Function<UserProfile, Boolean> prefGetter, boolean defaultVal) {
        if (userId == null || userProfileRepository == null) return defaultVal;
        return userProfileRepository.findById(userId)
                .map(prefGetter)
                .orElse(defaultVal);
    }

    private Context createContext() {
        Context ctx = new Context();
        ctx.setVariable("frontendUrl", frontendUrl);
        ctx.setVariable("appName", appName);
        ctx.setVariable("currentYear", ZonedDateTime.now(ZoneOffset.UTC).getYear());
        return ctx;
    }
}
