package com.taskoura.security.oauth;

import com.taskoura.exception.RateLimitedException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class OAuthLinkRateLimiter {

    private final Clock clock;
    private final int maxAttempts;
    private final int windowSeconds;
    private final Map<String, Deque<Instant>> attempts = new ConcurrentHashMap<>();

    @Autowired
    public OAuthLinkRateLimiter(@Autowired(required = false) Clock clock) {
        this(clock != null ? clock : Clock.systemUTC(), 10, 60);
    }

    public OAuthLinkRateLimiter() {
        this(Clock.systemUTC(), 10, 60);
    }

    public OAuthLinkRateLimiter(Clock clock, int maxAttempts, int windowSeconds) {
        this.clock = clock != null ? clock : Clock.systemUTC();
        this.maxAttempts = maxAttempts;
        this.windowSeconds = windowSeconds;
    }

    public void checkRateLimit(String key) {
        if (key == null || key.isBlank()) {
            key = "unknown";
        }

        Instant now = clock.instant();
        Instant windowStart = now.minusSeconds(windowSeconds);

        Deque<Instant> timestamps = attempts.computeIfAbsent(key, k -> new ArrayDeque<>());

        synchronized (timestamps) {
            while (!timestamps.isEmpty() && timestamps.peekFirst().isBefore(windowStart)) {
                timestamps.pollFirst();
            }

            if (timestamps.size() >= maxAttempts) {
                Instant oldest = timestamps.peekFirst();
                long secondsUntilOldestExpires = oldest != null
                        ? Math.max(1, (oldest.plusSeconds(windowSeconds).getEpochSecond() - now.getEpochSecond()))
                        : windowSeconds;
                throw new RateLimitedException("Too many account linking requests. Please wait before trying again.", (int) secondsUntilOldestExpires);
            }

            timestamps.addLast(now);
        }
    }

    public void clear() {
        attempts.clear();
    }
}

