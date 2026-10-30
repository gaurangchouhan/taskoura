package com.taskoura.service;

import com.taskoura.dto.*;
import com.taskoura.dto.OAuthDtos.OAuthProviderInfo;
import com.taskoura.dto.OAuthDtos.OAuthProvidersResponse;
import com.taskoura.entity.User;
import com.taskoura.entity.UserSession;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.ConflictException;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.exception.UnauthorizedException;
import java.util.Optional;
import com.taskoura.repository.UserRepository;
import com.taskoura.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final OtpService otpService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final SessionService sessionService;
    private final EmailService emailService;
    private final OAuthCodeService oAuthCodeService;
    private final com.taskoura.security.oauth.OAuthLinkTokenService oAuthLinkTokenService;
    private final org.springframework.security.oauth2.client.registration.ClientRegistrationRepository clientRegistrationRepository;

    public AuthService(UserRepository userRepository, OtpService otpService,
                       PasswordEncoder passwordEncoder, JwtUtil jwtUtil,
                       SessionService sessionService,
                       @Autowired(required = false) EmailService emailService,
                       @Autowired(required = false) OAuthCodeService oAuthCodeService,
                       @Autowired(required = false) com.taskoura.security.oauth.OAuthLinkTokenService oAuthLinkTokenService,
                       @Autowired(required = false) org.springframework.security.oauth2.client.registration.ClientRegistrationRepository clientRegistrationRepository) {
        this.userRepository = userRepository;
        this.otpService = otpService;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.sessionService = sessionService;
        this.emailService = emailService;
        this.oAuthCodeService = oAuthCodeService;
        this.oAuthLinkTokenService = oAuthLinkTokenService;
        this.clientRegistrationRepository = clientRegistrationRepository;
    }

    public MessageResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new ConflictException("Email already registered");
        }

        User user = User.builder()
                .name(request.name())
                .email(request.email())
                .passwordHash(passwordEncoder.encode(request.password()))
                .passwordLoginEnabled(true)
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
        return login(request, null);
    }

    public AuthResponse login(LoginRequest request, String userAgent) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new UnauthorizedException("Invalid credentials"));

        if (!user.isPasswordLoginEnabled() || user.getPasswordHash() == null) {
            throw new UnauthorizedException("Invalid credentials");
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid credentials");
        }
        if (!user.isVerified()) {
            throw new ForbiddenException("Please verify your email before logging in");
        }

        UserSession session = sessionService.createSession(user, userAgent);
        String token = jwtUtil.generateToken(user.getEmail(), session.getId(), session.getAbsoluteExpiresAt());
        UserResponse userResponse = new UserResponse(user.getId(), user.getName(), user.getEmail());
        SessionInfoResponse sessionInfo = sessionService.buildSessionInfo(session);

        return new AuthResponse(token, userResponse, sessionInfo);
    }

    public MessageResponse forgotPassword(ForgotPasswordRequest request) {
        Optional<User> optionalUser = userRepository.findByEmail(request.email());
        if (optionalUser.isPresent()) {
            User user = optionalUser.get();
            if (!user.isVerified()) {
                throw new BadRequestException("Account is not verified. Please verify your email first.");
            }
            otpService.generateAndSendResetOtp(user);
        }
        return new MessageResponse("If an account exists with that email, a password reset code has been sent.");
    }

    public MessageResponse resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new BadRequestException("Invalid or expired reset code"));

        if (!otpService.verifyResetOtp(user, request.otp())) {
            throw new BadRequestException("Invalid or expired reset code");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setPasswordLoginEnabled(true);
        user.setResetOtpCode(null);
        user.setResetOtpExpiresAt(null);
        user.setResetOtpAttempts(0);
        userRepository.save(user);

        if (emailService != null) {
            emailService.sendPasswordChangedEmail(user.getEmail(), user.getName());
        }

        // PHASE 4: Password reset revokes all of that user's sessions
        sessionService.revokeAllUserSessions(user.getId());

        return new MessageResponse("Password reset successfully. You can now log in with your new password.");
    }

    public com.taskoura.dto.OAuthDtos.OAuthLinkStartResponse startOAuthLink(String email, String provider) {
        if (provider == null || provider.isBlank()) {
            throw new BadRequestException("Provider is required");
        }
        String p = provider.trim().toLowerCase();
        if (clientRegistrationRepository == null || clientRegistrationRepository.findByRegistrationId(p) == null) {
            throw new BadRequestException("Provider is not configured or disabled");
        }
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found"));

        if (oAuthLinkTokenService == null) {
            throw new BadRequestException("OAuth linking service is not available");
        }
        String token = oAuthLinkTokenService.createLinkToken(user.getId(), p);
        String url = "/oauth2/authorization/" + p + "?link_token=" + token;
        return new com.taskoura.dto.OAuthDtos.OAuthLinkStartResponse(url);
    }

    public OAuthProvidersResponse getAvailableOAuthProviders() {
        java.util.List<OAuthProviderInfo> providers = new java.util.ArrayList<>();
        if (clientRegistrationRepository != null) {
            if (clientRegistrationRepository.findByRegistrationId("google") != null) {
                providers.add(new OAuthProviderInfo("google", "Google", "/oauth2/authorization/google"));
            }
            if (clientRegistrationRepository.findByRegistrationId("github") != null) {
                providers.add(new OAuthProviderInfo("github", "GitHub", "/oauth2/authorization/github"));
            }
        }
        return new OAuthProvidersResponse(providers);
    }

    public AuthResponse exchangeOAuthCode(String code, String userAgent) {
        if (oAuthCodeService == null) {
            throw new BadRequestException("OAuth code exchange is not available");
        }
        java.util.UUID userId = oAuthCodeService.consumeCode(code);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));

        UserSession session = sessionService.createSession(user, userAgent);
        String token = jwtUtil.generateToken(user.getEmail(), session.getId(), session.getAbsoluteExpiresAt());
        UserResponse userResponse = new UserResponse(user.getId(), user.getName(), user.getEmail());
        SessionInfoResponse sessionInfo = sessionService.buildSessionInfo(session);

        return new AuthResponse(token, userResponse, sessionInfo);
    }
}