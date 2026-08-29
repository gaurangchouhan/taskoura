package com.taskoura.service;

import com.taskoura.entity.User;
import com.taskoura.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;

@Service
public class OtpService {

    private final UserRepository userRepository;
    private final EmailService emailService;

    @Value("${otp.expiry-minutes}")
    private int expiryMinutes;

    private final SecureRandom random = new SecureRandom();

    public OtpService(UserRepository userRepository, EmailService emailService) {
        this.userRepository = userRepository;
        this.emailService = emailService;
    }

    public void generateAndSendOtp(User user) {
        String otp = String.format("%04d", random.nextInt(10000));
        user.setOtpCode(otp);
        user.setOtpExpiresAt(LocalDateTime.now().plusMinutes(expiryMinutes));
        userRepository.save(user);
        emailService.sendOtpEmail(user.getEmail(), otp);
    }

    public boolean verifyOtp(User user, String submittedOtp) {
        if (user.getOtpCode() == null || user.getOtpExpiresAt() == null) return false;
        if (LocalDateTime.now().isAfter(user.getOtpExpiresAt())) return false;
        if (!user.getOtpCode().equals(submittedOtp)) return false;

        user.setVerified(true);
        user.setOtpCode(null);
        user.setOtpExpiresAt(null);
        userRepository.save(user);
        return true;
    }
}