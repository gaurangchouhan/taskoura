package com.taskoura.service;

import com.taskoura.dto.SessionInfoResponse;
import com.taskoura.entity.User;
import com.taskoura.entity.UserSession;
import com.taskoura.repository.UserSessionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

@Service
public class SessionService {

    private final UserSessionRepository userSessionRepository;
    private final Clock clock;

    @Value("${session.idle-timeout-minutes:60}")
    private long idleTimeoutMinutes;

    @Value("${session.absolute-timeout-hours:1}")
    private long absoluteTimeoutHours;

    @Value("${session.warning-seconds:0}")
    private int warningSeconds;

    @Value("${session.touch-throttle-seconds:30}")
    private long touchThrottleSeconds;

    public SessionService(UserSessionRepository userSessionRepository,
                          @Autowired(required = false) Clock clock) {
        this.userSessionRepository = userSessionRepository;
        this.clock = clock != null ? clock : Clock.systemUTC();
    }

    public Clock getClock() {
        return clock;
    }

    public long getIdleTimeoutMinutes() {
        return idleTimeoutMinutes;
    }

    public void setIdleTimeoutMinutes(long idleTimeoutMinutes) {
        this.idleTimeoutMinutes = idleTimeoutMinutes;
    }

    public long getAbsoluteTimeoutHours() {
        return absoluteTimeoutHours;
    }

    public void setAbsoluteTimeoutHours(long absoluteTimeoutHours) {
        this.absoluteTimeoutHours = absoluteTimeoutHours;
    }

    public int getWarningSeconds() {
        return warningSeconds;
    }

    public void setWarningSeconds(int warningSeconds) {
        this.warningSeconds = warningSeconds;
    }

    public long getTouchThrottleSeconds() {
        return touchThrottleSeconds;
    }

    public void setTouchThrottleSeconds(long touchThrottleSeconds) {
        this.touchThrottleSeconds = touchThrottleSeconds;
    }

    @Transactional
    public UserSession createSession(User user, String userAgent) {
        Instant now = clock.instant();
        Instant absoluteExpiresAt = now.plus(absoluteTimeoutHours, ChronoUnit.HOURS);

        String truncatedUserAgent = null;
        if (userAgent != null && !userAgent.isBlank()) {
            truncatedUserAgent = userAgent.length() > 200 ? userAgent.substring(0, 200) : userAgent;
        }

        UserSession session = UserSession.builder()
                .user(user)
                .createdAt(now)
                .lastActivityAt(now)
                .absoluteExpiresAt(absoluteExpiresAt)
                .revokedAt(null)
                .userAgent(truncatedUserAgent)
                .build();

        return userSessionRepository.save(session);
    }

    public Optional<UserSession> getSession(UUID sessionId) {
        return userSessionRepository.findById(sessionId);
    }

    public Optional<String> validateSession(UserSession session, Instant now) {
        if (session.getRevokedAt() != null) {
            return Optional.of("REVOKED");
        }
        if (!now.isBefore(session.getAbsoluteExpiresAt())) {
            return Optional.of("ABSOLUTE_TIMEOUT");
        }
        Instant idleDeadline = session.getLastActivityAt().plus(idleTimeoutMinutes, ChronoUnit.MINUTES);
        if (!now.isBefore(idleDeadline)) {
            return Optional.of("IDLE_TIMEOUT");
        }
        return Optional.empty();
    }

    @Transactional
    public boolean touchThrottled(UserSession session, Instant now) {
        long secondsSinceLastActivity = ChronoUnit.SECONDS.between(session.getLastActivityAt(), now);
        if (secondsSinceLastActivity >= touchThrottleSeconds) {
            session.setLastActivityAt(now);
            userSessionRepository.save(session);
            return true;
        }
        return false;
    }

    @Transactional
    public UserSession touchImmediate(UserSession session, Instant now) {
        session.setLastActivityAt(now);
        return userSessionRepository.save(session);
    }

    @Transactional
    public UserSession touchImmediate(UserSession session) {
        return touchImmediate(session, clock.instant());
    }

    @Transactional
    public void revokeSession(UUID sessionId) {
        userSessionRepository.findById(sessionId).ifPresent(session -> {
            if (session.getRevokedAt() == null) {
                session.setRevokedAt(clock.instant());
                userSessionRepository.save(session);
            }
        });
    }

    @Transactional
    public int revokeAllUserSessions(UUID userId) {
        return userSessionRepository.revokeAllByUserId(userId, clock.instant());
    }

    @Scheduled(cron = "${session.cleanup.cron:0 0 3 * * *}")
    @Transactional
    public int cleanupExpiredSessions() {
        Instant cutoff = clock.instant().minus(7, ChronoUnit.DAYS);
        return userSessionRepository.deleteExpiredBefore(cutoff);
    }

    public SessionInfoResponse buildSessionInfo(UserSession session, Instant now) {
        int idleSec = (int) (idleTimeoutMinutes * 60);
        Instant idleExpiresAt = session.getLastActivityAt().plus(idleTimeoutMinutes, ChronoUnit.MINUTES);
        return new SessionInfoResponse(
                idleSec,
                warningSeconds,
                idleExpiresAt.toString(),
                session.getAbsoluteExpiresAt().toString(),
                now.toString()
        );
    }

    public SessionInfoResponse buildSessionInfo(UserSession session) {
        return buildSessionInfo(session, clock.instant());
    }

    public SessionInfoResponse buildTimingResponse(UserSession session, Instant now) {
        Instant idleExpiresAt = session.getLastActivityAt().plus(idleTimeoutMinutes, ChronoUnit.MINUTES);
        return SessionInfoResponse.ofTiming(
                idleExpiresAt.toString(),
                session.getAbsoluteExpiresAt().toString(),
                now.toString()
        );
    }

    public SessionInfoResponse buildTimingResponse(UserSession session) {
        return buildTimingResponse(session, clock.instant());
    }
}
