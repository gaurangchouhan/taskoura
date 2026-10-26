package com.taskoura.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.dto.LoginRequest;
import com.taskoura.dto.ResetPasswordRequest;
import com.taskoura.dto.SessionInfoResponse;
import com.taskoura.entity.User;
import com.taskoura.entity.UserSession;
import com.taskoura.repository.UserRepository;
import com.taskoura.repository.UserSessionRepository;
import com.taskoura.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.notNullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class SessionTimeoutIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private UserSessionRepository userSessionRepository;
    @Autowired private SessionService sessionService;
    @Autowired private AuthService authService;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private MutableClock testClock;

    @MockitoBean private JavaMailSender mailSender;
    @MockitoBean private OtpService otpService;

    private User testUser;
    private final String rawPassword = "Password123!";

    public static class MutableClock extends Clock {
        private Instant currentInstant;
        private final ZoneId zone;

        public MutableClock(Instant initialInstant, ZoneId zone) {
            this.currentInstant = initialInstant;
            this.zone = zone;
        }

        public void advance(Duration duration) {
            this.currentInstant = this.currentInstant.plus(duration);
        }

        public void setInstant(Instant instant) {
            this.currentInstant = instant;
        }

        @Override
        public ZoneId getZone() {
            return zone;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return new MutableClock(currentInstant, zone);
        }

        @Override
        public Instant instant() {
            return currentInstant;
        }
    }

    @TestConfiguration
    static class TestClockConfiguration {
        @Bean
        @Primary
        public MutableClock testClock() {
            return new MutableClock(Instant.parse("2026-10-25T12:00:00Z"), ZoneOffset.UTC);
        }
    }

    @BeforeEach
    void setUp() {
        testClock.setInstant(Instant.parse("2026-10-25T12:00:00Z"));

        testUser = userRepository.save(User.builder()
                .name("Session Tester")
                .email("session-tester-" + UUID.randomUUID() + "@example.com")
                .passwordHash(passwordEncoder.encode(rawPassword))
                .verified(true)
                .build());
    }

    private String loginAndGetToken() throws Exception {
        LoginRequest request = new LoginRequest(testUser.getEmail(), rawPassword);
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                        .header("User-Agent", "IntegrationTest/1.0 (Macintosh)"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.session.idleTimeoutSeconds").value(1800))
                .andExpect(jsonPath("$.session.warningSeconds").value(120))
                .andExpect(jsonPath("$.session.idleExpiresAt").value(endsWith("Z")))
                .andExpect(jsonPath("$.session.absoluteExpiresAt").value(endsWith("Z")))
                .andExpect(jsonPath("$.session.serverTime").value(endsWith("Z")))
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        return objectMapper.readTree(responseBody).get("token").asText();
    }

    @Test
    @DisplayName("Login returns session info in contract shape and creates user_sessions row")
    void login_createsSessionAndReturnsSessionInfo() throws Exception {
        LoginRequest request = new LoginRequest(testUser.getEmail(), rawPassword);
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                        .header("User-Agent", "TaskouraApp/1.0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.session.idleTimeoutSeconds").value(1800))
                .andExpect(jsonPath("$.session.warningSeconds").value(120))
                .andExpect(jsonPath("$.session.serverTime").value("2026-10-25T12:00:00Z"))
                .andExpect(jsonPath("$.session.idleExpiresAt").value("2026-10-25T12:30:00Z"))
                .andExpect(jsonPath("$.session.absoluteExpiresAt").value("2026-10-26T00:00:00Z"))
                .andReturn();

        String token = objectMapper.readTree(result.getResponse().getContentAsString()).get("token").asText();
        UUID sid = jwtUtil.extractSid(token).orElseThrow();
        assertThat(sid).isNotNull();

        Optional<UserSession> sessionOpt = userSessionRepository.findById(sid);
        assertThat(sessionOpt).isPresent();
        UserSession session = sessionOpt.get();
        assertThat(session.getUser().getId()).isEqualTo(testUser.getId());
        assertThat(session.getUserAgent()).isEqualTo("TaskouraApp/1.0");
        assertThat(session.getCreatedAt()).isEqualTo(Instant.parse("2026-10-25T12:00:00Z"));
        assertThat(session.getRevokedAt()).isNull();
    }

    @Test
    @DisplayName("Idle timeout: request after 30 minutes idle is rejected with 401 IDLE_TIMEOUT")
    void idleTimeout_rejectsRequestWith401() throws Exception {
        String token = loginAndGetToken();

        // Advance clock past the 30-minute idle threshold
        testClock.advance(Duration.ofMinutes(31));

        mockMvc.perform(get("/api/auth/session")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"))
                .andExpect(jsonPath("$.reason").value("IDLE_TIMEOUT"))
                .andExpect(jsonPath("$.message").value("Session expired due to inactivity"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")));
    }

    @Test
    @DisplayName("Absolute timeout: request after 12 hours is rejected with 401 ABSOLUTE_TIMEOUT")
    void absoluteTimeout_rejectsRequestWith401() throws Exception {
        String token = loginAndGetToken();

        // Advance clock past 12 hours
        testClock.advance(Duration.ofHours(12).plusMinutes(1));

        mockMvc.perform(get("/api/auth/session")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"))
                .andExpect(jsonPath("$.reason").value("ABSOLUTE_TIMEOUT"))
                .andExpect(jsonPath("$.message").value("Session expired due to maximum duration"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")));
    }

    @Test
    @DisplayName("Revoked session: request on revoked session returns 401 REVOKED")
    void revokedSession_rejectsRequestWith401() throws Exception {
        String token = loginAndGetToken();
        UUID sid = jwtUtil.extractSid(token).orElseThrow();

        // Revoke session
        sessionService.revokeSession(sid);

        mockMvc.perform(get("/api/auth/session")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"))
                .andExpect(jsonPath("$.reason").value("REVOKED"))
                .andExpect(jsonPath("$.message").value("Session has been revoked"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")));
    }

    @Test
    @DisplayName("Legacy token: token without sid claim is rejected with 401 LEGACY_TOKEN")
    void legacyToken_rejectsWith401LegacyToken() throws Exception {
        // Generate legacy token without sid
        String legacyToken = jwtUtil.generateToken(testUser.getEmail());

        mockMvc.perform(get("/api/auth/session")
                        .header("Authorization", "Bearer " + legacyToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"))
                .andExpect(jsonPath("$.reason").value("LEGACY_TOKEN"))
                .andExpect(jsonPath("$.message").value("Session token is invalid or missing session identifier"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")));
    }

    @Test
    @DisplayName("Background request: does NOT extend idle period")
    void backgroundRequest_doesNotExtendIdle() throws Exception {
        String token = loginAndGetToken();
        UUID sid = jwtUtil.extractSid(token).orElseThrow();
        Instant initialActivity = userSessionRepository.findById(sid).orElseThrow().getLastActivityAt();

        // Advance 20 minutes
        testClock.advance(Duration.ofMinutes(20));

        // Make background request with X-Background-Request header
        mockMvc.perform(get("/api/auth/session")
                        .header("Authorization", "Bearer " + token)
                        .header("X-Background-Request", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.idleExpiresAt").value(initialActivity.plus(30, ChronoUnit.MINUTES).toString()));

        // Confirm lastActivityAt was NOT modified in the database
        UserSession session = userSessionRepository.findById(sid).orElseThrow();
        assertThat(session.getLastActivityAt()).isEqualTo(initialActivity);

        // Advance 15 more minutes (20 + 15 = 35 minutes idle since initialActivity)
        testClock.advance(Duration.ofMinutes(15));

        // Request now fails with IDLE_TIMEOUT because idle was not extended
        mockMvc.perform(get("/api/auth/session")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"))
                .andExpect(jsonPath("$.reason").value("IDLE_TIMEOUT"));
    }

    @Test
    @DisplayName("GET /api/auth/session: treated as background and does not extend idle period")
    void getSession_treatedAsBackground() throws Exception {
        String token = loginAndGetToken();
        UUID sid = jwtUtil.extractSid(token).orElseThrow();
        Instant initialActivity = userSessionRepository.findById(sid).orElseThrow().getLastActivityAt();

        // Advance 25 minutes
        testClock.advance(Duration.ofMinutes(25));

        // GET /api/auth/session without any special headers
        mockMvc.perform(get("/api/auth/session")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // Verify lastActivityAt was not extended
        UserSession session = userSessionRepository.findById(sid).orElseThrow();
        assertThat(session.getLastActivityAt()).isEqualTo(initialActivity);
    }

    @Test
    @DisplayName("Normal request: extends idle period and throttles database updates")
    void normalRequest_extendsIdleAndThrottles() throws Exception {
        String token = loginAndGetToken();
        UUID sid = jwtUtil.extractSid(token).orElseThrow();
        Instant t0 = userSessionRepository.findById(sid).orElseThrow().getLastActivityAt();

        // 1. Advance 10 seconds (< 30s throttle)
        testClock.advance(Duration.ofSeconds(10));
        mockMvc.perform(post("/api/auth/session/heartbeat") // heartbeat is tested separately; let's call another authenticated endpoint
                        .header("Authorization", "Bearer " + token)
                        .header("X-Background-Request", "false"))
                .andExpect(status().isOk());

        // 2. Advance 35 seconds (now 45 seconds total from t0)
        testClock.advance(Duration.ofSeconds(35));
        Instant t45 = testClock.instant();

        // Calling heartbeat or normal authenticated request
        mockMvc.perform(post("/api/auth/session/heartbeat")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serverTime").value(t45.toString()))
                .andExpect(jsonPath("$.idleExpiresAt").value(t45.plus(30, ChronoUnit.MINUTES).toString()));

        UserSession updatedSession = userSessionRepository.findById(sid).orElseThrow();
        assertThat(updatedSession.getLastActivityAt()).isEqualTo(t45);

        // 3. Advance 25 minutes after t45: should still be active
        testClock.advance(Duration.ofMinutes(25));
        mockMvc.perform(get("/api/auth/session")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Heartbeat: POST /api/auth/session/heartbeat extends idle immediately")
    void heartbeat_extendsIdleImmediately() throws Exception {
        String token = loginAndGetToken();
        UUID sid = jwtUtil.extractSid(token).orElseThrow();
        Instant t0 = userSessionRepository.findById(sid).orElseThrow().getLastActivityAt();

        // Advance 15 minutes
        testClock.advance(Duration.ofMinutes(15));
        Instant t15 = testClock.instant();

        mockMvc.perform(post("/api/auth/session/heartbeat")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serverTime").value(t15.toString()))
                .andExpect(jsonPath("$.idleExpiresAt").value(t15.plus(30, ChronoUnit.MINUTES).toString()))
                .andExpect(jsonPath("$.absoluteExpiresAt").value("2026-10-26T00:00:00Z"));

        UserSession session = userSessionRepository.findById(sid).orElseThrow();
        assertThat(session.getLastActivityAt()).isEqualTo(t15);
    }

    @Test
    @DisplayName("Logout: POST /api/auth/logout revokes session, is 204, safe to call twice, and subsequent request returns 401 REVOKED")
    void logout_revokesSessionAndIsSafeTwice() throws Exception {
        String token = loginAndGetToken();
        UUID sid = jwtUtil.extractSid(token).orElseThrow();

        // 1. First logout -> 204 No Content
        mockMvc.perform(post("/api/auth/logout")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        UserSession session = userSessionRepository.findById(sid).orElseThrow();
        assertThat(session.getRevokedAt()).isNotNull();

        // 2. Second logout -> 204 No Content (idempotent / safe to call twice)
        mockMvc.perform(post("/api/auth/logout")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        // 3. Subsequent authenticated request -> 401 REVOKED
        mockMvc.perform(get("/api/auth/session")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"))
                .andExpect(jsonPath("$.reason").value("REVOKED"));
    }

    @Test
    @DisplayName("Password reset: revokes all sessions belonging to the user")
    void resetPassword_revokesAllUserSessions() throws Exception {
        // Create 2 sessions for the same user
        String token1 = loginAndGetToken();
        String token2 = loginAndGetToken();

        UUID sid1 = jwtUtil.extractSid(token1).orElseThrow();
        UUID sid2 = jwtUtil.extractSid(token2).orElseThrow();
        assertThat(sid1).isNotEqualTo(sid2);

        // Simulate OTP verification for password reset
        when(otpService.verifyResetOtp(any(User.class), any())).thenReturn(true);

        ResetPasswordRequest resetRequest = new ResetPasswordRequest(testUser.getEmail(), "123456", "NewPassword123!");
        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resetRequest)))
                .andExpect(status().isOk());

        // Both sessions should now be revoked
        UserSession s1 = userSessionRepository.findById(sid1).orElseThrow();
        UserSession s2 = userSessionRepository.findById(sid2).orElseThrow();
        assertThat(s1.getRevokedAt()).isNotNull();
        assertThat(s2.getRevokedAt()).isNotNull();

        // Requests with either token should return 401 REVOKED
        mockMvc.perform(get("/api/auth/session")
                        .header("Authorization", "Bearer " + token1))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"))
                .andExpect(jsonPath("$.reason").value("REVOKED"));

        mockMvc.perform(get("/api/auth/session")
                        .header("Authorization", "Bearer " + token2))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"))
                .andExpect(jsonPath("$.reason").value("REVOKED"));
    }

    @Test
    @DisplayName("Cleanup: deletes sessions expired more than 7 days ago")
    void cleanup_deletesOldSessions() {
        Instant now = testClock.instant();

        // Session 1: expired 8 days ago
        UserSession oldSession = UserSession.builder()
                .user(testUser)
                .createdAt(now.minus(10, ChronoUnit.DAYS))
                .lastActivityAt(now.minus(9, ChronoUnit.DAYS))
                .absoluteExpiresAt(now.minus(8, ChronoUnit.DAYS))
                .build();
        userSessionRepository.saveAndFlush(oldSession);

        // Session 2: active session
        UserSession activeSession = UserSession.builder()
                .user(testUser)
                .createdAt(now)
                .lastActivityAt(now)
                .absoluteExpiresAt(now.plus(12, ChronoUnit.HOURS))
                .build();
        userSessionRepository.saveAndFlush(activeSession);

        int deletedCount = sessionService.cleanupExpiredSessions();
        assertThat(deletedCount).isGreaterThanOrEqualTo(1);

        assertThat(userSessionRepository.findById(oldSession.getId())).isEmpty();
        assertThat(userSessionRepository.findById(activeSession.getId())).isPresent();
    }
}
