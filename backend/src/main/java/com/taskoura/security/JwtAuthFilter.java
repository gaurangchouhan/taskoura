package com.taskoura.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.entity.UserSession;
import com.taskoura.service.SessionService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.*;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final SessionService sessionService;
    private final Clock clock;
    private final ObjectMapper objectMapper;

    private static final Set<String> PUBLIC_PATHS = Set.of(
            "/api/health",
            "/api/auth/register",
            "/api/auth/verify-otp",
            "/api/auth/resend-otp",
            "/api/auth/login",
            "/api/auth/forgot-password",
            "/api/auth/reset-password"
    );

    public JwtAuthFilter(JwtUtil jwtUtil,
                         @Autowired(required = false) SessionService sessionService,
                         @Autowired(required = false) Clock clock,
                         @Autowired(required = false) ObjectMapper objectMapper) {
        this.jwtUtil = jwtUtil;
        this.sessionService = sessionService;
        this.clock = clock != null ? clock : (sessionService != null && sessionService.getClock() != null ? sessionService.getClock() : Clock.systemUTC());
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();

        // If it's a public unauthenticated path without auth or with auth (like logging in), skip session validation
        if (isPublicPath(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);

        // In slice tests where SessionService is not loaded into the context, authenticate with standard token validation
        if (sessionService == null) {
            if (jwtUtil.validateToken(token)) {
                String email = jwtUtil.extractEmail(token);
                UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(email, null, Collections.emptyList());
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
            filterChain.doFilter(request, response);
            return;
        }

        Claims claims;
        try {
            claims = jwtUtil.parseClaimsAllowingExpired(token);
        } catch (Exception e) {
            // Cryptographically invalid or malformed token
            filterChain.doFilter(request, response);
            return;
        }

        String email = claims.getSubject();
        String sidStr = claims.get("sid", String.class);

        // 1. Check for legacy token without sid
        if (sidStr == null || sidStr.isBlank()) {
            sendSessionExpired(response, request, "LEGACY_TOKEN");
            return;
        }

        UUID sessionId;
        try {
            sessionId = UUID.fromString(sidStr);
        } catch (IllegalArgumentException e) {
            sendSessionExpired(response, request, "LEGACY_TOKEN");
            return;
        }

        Instant now = clock.instant();

        // 2. Check if JWT expiration is in the past
        if (claims.getExpiration() != null && !now.isBefore(claims.getExpiration().toInstant())) {
            sendSessionExpired(response, request, "ABSOLUTE_TIMEOUT");
            return;
        }

        // 3. Load session from database
        Optional<UserSession> sessionOpt = sessionService.getSession(sessionId);
        if (sessionOpt.isEmpty()) {
            sendSessionExpired(response, request, "REVOKED");
            return;
        }

        UserSession session = sessionOpt.get();

        // 4. Validate session revocation, absolute timeout, and idle timeout
        Optional<String> invalidReason = sessionService.validateSession(session, now);
        if (invalidReason.isPresent()) {
            String reason = invalidReason.get();
            // Allow logout to be idempotent if already revoked
            boolean isLogout = isLogoutRequest(request);
            if (isLogout && "REVOKED".equals(reason)) {
                UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(email, null, Collections.emptyList());
                auth.setDetails(session);
                SecurityContextHolder.getContext().setAuthentication(auth);
                request.setAttribute("userSession", session);
                filterChain.doFilter(request, response);
                return;
            }

            sendSessionExpired(response, request, reason);
            return;
        }

        // 5. Valid session: handle idle touch throttling vs background request
        boolean isBackground = isBackgroundRequest(request);
        if (!isBackground) {
            sessionService.touchThrottled(session, now);
        }

        // Store session for controllers to access directly
        request.setAttribute("userSession", session);

        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(email, null, Collections.emptyList());
        auth.setDetails(session);
        SecurityContextHolder.getContext().setAuthentication(auth);

        filterChain.doFilter(request, response);
    }

    private boolean isPublicPath(String path) {
        if (PUBLIC_PATHS.contains(path)) {
            return true;
        }
        return path.startsWith("/api/attachments/") && path.endsWith("/download");
    }

    private boolean isLogoutRequest(HttpServletRequest request) {
        return "/api/auth/logout".equals(request.getRequestURI()) && "POST".equalsIgnoreCase(request.getMethod());
    }

    private boolean isBackgroundRequest(HttpServletRequest request) {
        String bgHeader = request.getHeader("X-Background-Request");
        if ("true".equalsIgnoreCase(bgHeader)) {
            return true;
        }
        // GET /api/auth/session is automatically treated as a background request
        return "GET".equalsIgnoreCase(request.getMethod()) && "/api/auth/session".equals(request.getRequestURI());
    }

    private void sendSessionExpired(HttpServletResponse response, HttpServletRequest request, String reason) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());

        String message = switch (reason) {
            case "IDLE_TIMEOUT" -> "Session expired due to inactivity";
            case "ABSOLUTE_TIMEOUT" -> "Session expired due to maximum duration";
            case "REVOKED" -> "Session has been revoked";
            case "LEGACY_TOKEN" -> "Session token is invalid or missing session identifier";
            default -> "Session has expired or is invalid";
        };

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", HttpStatus.UNAUTHORIZED.value());
        body.put("error", HttpStatus.UNAUTHORIZED.getReasonPhrase());
        body.put("code", "SESSION_EXPIRED");
        body.put("message", message);
        body.put("reason", reason);
        body.put("timestamp", clock.instant().toString());
        body.put("path", request.getRequestURI());

        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}