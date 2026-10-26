package com.taskoura.service;

import com.taskoura.entity.User;
import com.taskoura.exception.OtpAttemptsExceededException;
import com.taskoura.exception.RateLimitedException;
import com.taskoura.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;

@Service
public class OtpService {

    private final UserRepository userRepository;
    private final EmailService emailService;
    private final Clock clock;

    @Value("${otp.expiry-minutes:10}")
    private int expiryMinutes;

    @Value("${otp.pepper:${jwt.secret:EQtBDdAQjvZlm+MeX+xcGSjt8DaU+FQH5qFoooPeyzs=}}")
    private String pepper;

    private final SecureRandom random = new SecureRandom();

    public OtpService(UserRepository userRepository,
                      EmailService emailService,
                      @Autowired(required = false) Clock clock) {
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.clock = clock != null ? clock : Clock.systemUTC();
    }

    public void setPepper(String pepper) {
        this.pepper = pepper;
    }

    public void generateAndSendOtp(User user) {
        checkResendCooldown(user.getOtpLastSentAt());

        String otp = String.format("%04d", random.nextInt(10000));
        user.setOtpCode(hashOtp(otp));
        user.setOtpExpiresAt(LocalDateTime.now(clock).plusMinutes(expiryMinutes));
        user.setOtpAttempts(0);
        user.setOtpLastSentAt(LocalDateTime.now(clock));
        userRepository.save(user);

        emailService.sendVerificationEmail(user.getEmail(), user.getName(), otp);
    }

    public boolean verifyOtp(User user, String submittedOtp) {
        if (user.getOtpCode() == null || user.getOtpExpiresAt() == null) {
            return false;
        }

        if (LocalDateTime.now(clock).isAfter(user.getOtpExpiresAt())) {
            return false;
        }

        if (user.getOtpAttempts() >= 5) {
            user.setOtpCode(null);
            user.setOtpExpiresAt(null);
            user.setOtpAttempts(0);
            userRepository.save(user);
            throw new OtpAttemptsExceededException("Too many attempts. Request a new code.");
        }

        String submittedHash = hashOtp(submittedOtp);
        boolean matches = MessageDigest.isEqual(
                user.getOtpCode().getBytes(StandardCharsets.UTF_8),
                submittedHash.getBytes(StandardCharsets.UTF_8)
        );

        if (matches) {
            user.setVerified(true);
            user.setOtpCode(null);
            user.setOtpExpiresAt(null);
            user.setOtpAttempts(0);
            userRepository.save(user);

            emailService.sendWelcomeEmail(user.getEmail(), user.getName());
            return true;
        } else {
            int newAttempts = user.getOtpAttempts() + 1;
            user.setOtpAttempts(newAttempts);
            if (newAttempts >= 5) {
                user.setOtpCode(null);
                user.setOtpExpiresAt(null);
                user.setOtpAttempts(0);
                userRepository.save(user);
                throw new OtpAttemptsExceededException("Too many attempts. Request a new code.");
            }
            userRepository.save(user);
            return false;
        }
    }

    public void generateAndSendResetOtp(User user) {
        checkResendCooldown(user.getResetOtpLastSentAt());

        String otp = String.format("%04d", random.nextInt(10000));
        user.setResetOtpCode(hashOtp(otp));
        user.setResetOtpExpiresAt(LocalDateTime.now(clock).plusMinutes(expiryMinutes));
        user.setResetOtpAttempts(0);
        user.setResetOtpLastSentAt(LocalDateTime.now(clock));
        userRepository.save(user);

        emailService.sendPasswordResetEmail(user.getEmail(), user.getName(), otp);
    }

    public boolean verifyResetOtp(User user, String submittedOtp) {
        if (user.getResetOtpCode() == null || user.getResetOtpExpiresAt() == null) {
            return false;
        }

        if (LocalDateTime.now(clock).isAfter(user.getResetOtpExpiresAt())) {
            return false;
        }

        if (user.getResetOtpAttempts() >= 5) {
            user.setResetOtpCode(null);
            user.setResetOtpExpiresAt(null);
            user.setResetOtpAttempts(0);
            userRepository.save(user);
            throw new OtpAttemptsExceededException("Too many attempts. Request a new code.");
        }

        String submittedHash = hashOtp(submittedOtp);
        boolean matches = MessageDigest.isEqual(
                user.getResetOtpCode().getBytes(StandardCharsets.UTF_8),
                submittedHash.getBytes(StandardCharsets.UTF_8)
        );

        if (matches) {
            return true;
        } else {
            int newAttempts = user.getResetOtpAttempts() + 1;
            user.setResetOtpAttempts(newAttempts);
            if (newAttempts >= 5) {
                user.setResetOtpCode(null);
                user.setResetOtpExpiresAt(null);
                user.setResetOtpAttempts(0);
                userRepository.save(user);
                throw new OtpAttemptsExceededException("Too many attempts. Request a new code.");
            }
            userRepository.save(user);
            return false;
        }
    }

    public String hashOtp(String code) {
        if (code == null) return null;
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(pepper.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(secretKey);
            byte[] hash = hmac.doFinal(code.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to calculate OTP HMAC", e);
        }
    }

    private void checkResendCooldown(LocalDateTime lastSentAt) {
        if (lastSentAt == null) return;
        LocalDateTime now = LocalDateTime.now(clock);
        long secondsSince = ChronoUnit.SECONDS.between(lastSentAt, now);
        if (secondsSince < 30) {
            int retryAfter = (int) (30 - secondsSince);
            throw new RateLimitedException("Please wait before requesting another code.", Math.max(1, retryAfter));
        }
    }
}