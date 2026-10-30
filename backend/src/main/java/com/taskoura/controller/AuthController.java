package com.taskoura.controller;

import com.taskoura.dto.*;
import com.taskoura.dto.OAuthDtos.OAuthExchangeRequest;
import com.taskoura.dto.OAuthDtos.OAuthProvidersResponse;
import com.taskoura.entity.UserSession;
import com.taskoura.exception.UnauthorizedException;
import com.taskoura.security.oauth.OAuthExchangeRateLimiter;
import com.taskoura.service.AuthService;
import com.taskoura.service.SessionService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final SessionService sessionService;
    private final OAuthExchangeRateLimiter oAuthExchangeRateLimiter;

    public AuthController(AuthService authService,
                          SessionService sessionService,
                          @Autowired(required = false) OAuthExchangeRateLimiter oAuthExchangeRateLimiter) {
        this.authService = authService;
        this.sessionService = sessionService;
        this.oAuthExchangeRateLimiter = oAuthExchangeRateLimiter;
    }

    @GetMapping("/oauth/providers")
    public ResponseEntity<OAuthProvidersResponse> getOAuthProviders() {
        return ResponseEntity.ok(authService.getAvailableOAuthProviders());
    }

    @PostMapping("/oauth/link/start")
    public ResponseEntity<com.taskoura.dto.OAuthDtos.OAuthLinkStartResponse> startOAuthLink(
            @RequestBody com.taskoura.dto.OAuthDtos.OAuthLinkStartRequest request,
            org.springframework.security.core.Authentication authentication
    ) {
        if (authentication == null || authentication.getName() == null) {
            throw new UnauthorizedException("Authentication required");
        }
        return ResponseEntity.ok(authService.startOAuthLink(authentication.getName(), request.provider()));
    }

    @PostMapping("/oauth/exchange")
    public ResponseEntity<AuthResponse> exchangeOAuthCode(
            @RequestBody OAuthExchangeRequest request,
            @RequestHeader(value = "User-Agent", required = false) String userAgent,
            HttpServletRequest httpRequest) {
        if (oAuthExchangeRateLimiter != null) {
            String clientIp = resolveClientIp(httpRequest);
            oAuthExchangeRateLimiter.checkRateLimit(clientIp);
        }
        return ResponseEntity.ok(authService.exchangeOAuthCode(request.code(), userAgent));
    }

    @PostMapping("/register")
    public ResponseEntity<MessageResponse> register(@RequestBody RegisterRequest request) {
        return ResponseEntity.status(201).body(authService.register(request));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<MessageResponse> verifyOtp(@RequestBody VerifyOtpRequest request) {
        return ResponseEntity.ok(authService.verifyOtp(request));
    }

    @PostMapping("/resend-otp")
    public ResponseEntity<MessageResponse> resendOtp(@RequestBody ResendOtpRequest request) {
        return ResponseEntity.ok(authService.resendOtp(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @RequestBody LoginRequest request,
            @RequestHeader(value = "User-Agent", required = false) String userAgent) {
        return ResponseEntity.ok(authService.login(request, userAgent));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<MessageResponse> forgotPassword(@RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(authService.forgotPassword(request));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<MessageResponse> resetPassword(@RequestBody ResetPasswordRequest request) {
        return ResponseEntity.ok(authService.resetPassword(request));
    }

    @PostMapping("/session/heartbeat")
    public ResponseEntity<SessionInfoResponse> heartbeat(HttpServletRequest request) {
        UserSession session = resolveSession(request);
        UserSession updated = sessionService.touchImmediate(session);
        return ResponseEntity.ok(sessionService.buildTimingResponse(updated));
    }

    @GetMapping("/session")
    public ResponseEntity<SessionInfoResponse> getSession(HttpServletRequest request) {
        UserSession session = resolveSession(request);
        return ResponseEntity.ok(sessionService.buildTimingResponse(session));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        try {
            UserSession session = resolveSession(request);
            sessionService.revokeSession(session.getId());
        } catch (UnauthorizedException ignored) {
            // Idempotent: safe to call twice
        }
        return ResponseEntity.noContent().build();
    }

    private UserSession resolveSession(HttpServletRequest request) {
        UserSession session = (UserSession) request.getAttribute("userSession");
        if (session != null) {
            return session;
        }
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getDetails() instanceof UserSession us) {
            return us;
        }
        throw new UnauthorizedException("No active session found");
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) return "unknown";
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int commaIdx = forwarded.indexOf(',');
            return commaIdx != -1 ? forwarded.substring(0, commaIdx).trim() : forwarded.trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }
}