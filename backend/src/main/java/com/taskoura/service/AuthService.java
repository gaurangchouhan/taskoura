package com.taskoura.service;

import com.taskoura.dto.*;
import com.taskoura.entity.User;
import com.taskoura.repository.UserRepository;
import com.taskoura.security.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final OtpService otpService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthService(UserRepository userRepository, OtpService otpService,
                        PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.otpService = otpService;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    public MessageResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalStateException("Email already registered");
        }

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .verified(false)
                .build();

        User saved = userRepository.save(user);
        otpService.generateAndSendOtp(saved);

        return new MessageResponse("OTP sent to email. Please verify to activate your account.");
    }

    public MessageResponse verifyOtp(VerifyOtpRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalStateException("User not found"));

        boolean success = otpService.verifyOtp(user, request.getOtp());
        if (!success) {
            throw new IllegalStateException("Invalid or expired OTP");
        }
        return new MessageResponse("Account verified. You can now log in.");
    }

    public MessageResponse resendOtp(ResendOtpRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalStateException("User not found"));

        if (user.isVerified()) {
            throw new IllegalStateException("Account already verified");
        }
        otpService.generateAndSendOtp(user);
        return new MessageResponse("OTP resent");
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalStateException("Invalid credentials"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalStateException("Invalid credentials");
        }
        if (!user.isVerified()) {
            throw new IllegalStateException("Please verify your email before logging in");
        }

        String token = jwtUtil.generateToken(user.getEmail());

        UserResponse userResponse = UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .build();

        return new AuthResponse(token, userResponse);
    }
}