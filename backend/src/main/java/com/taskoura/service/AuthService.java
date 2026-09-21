package com.taskoura.service;

import com.taskoura.dto.AuthResponse;
import com.taskoura.dto.LoginRequest;
import com.taskoura.dto.MessageResponse;
import com.taskoura.dto.RegisterRequest;
import com.taskoura.dto.ResendOtpRequest;
import com.taskoura.dto.UserResponse;
import com.taskoura.dto.VerifyOtpRequest;
import com.taskoura.entity.User;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.ConflictException;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.exception.UnauthorizedException;
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
        if (userRepository.existsByEmail(request.email())) {
            throw new ConflictException("Email already registered");
        }

        User user = User.builder()
                .name(request.name())
                .email(request.email())
                .passwordHash(passwordEncoder.encode(request.password()))
                .verified(false)
                .build();

        User saved = userRepository.save(user);
        otpService.generateAndSendOtp(saved);

        return new MessageResponse("OTP sent to email. Please verify to activate your account.");
    }

    public MessageResponse verifyOtp(VerifyOtpRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new NotFoundException("User not found"));

        boolean success = otpService.verifyOtp(user, request.otp());
        if (!success) {
            throw new BadRequestException("Invalid or expired OTP");
        }
        return new MessageResponse("Account verified. You can now log in.");
    }

    public MessageResponse resendOtp(ResendOtpRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new NotFoundException("User not found"));

        if (user.isVerified()) {
            throw new ConflictException("Account already verified");
        }
        otpService.generateAndSendOtp(user);
        return new MessageResponse("OTP resent");
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new UnauthorizedException("Invalid credentials"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid credentials");
        }
        if (!user.isVerified()) {
            throw new ForbiddenException("Please verify your email before logging in");
        }

        String token = jwtUtil.generateToken(user.getEmail());
        UserResponse userResponse = new UserResponse(user.getId(), user.getName(), user.getEmail());
        return new AuthResponse(token, userResponse);
    }
}