package com.taskoura.security.oauth;

import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OAuthLinkTokenService {

    public record LinkTokenData(UUID userId, String provider, Instant expiresAt) {}

    private final Clock clock;
    private final Map<String, LinkTokenData> tokenStore = new ConcurrentHashMap<>();

    public OAuthLinkTokenService() {
        this(Clock.systemUTC());
    }

    public OAuthLinkTokenService(Clock clock) {
        this.clock = clock != null ? clock : Clock.systemUTC();
    }

    public String createLinkToken(UUID userId, String provider) {
        String token = UUID.randomUUID().toString();
        Instant expiresAt = clock.instant().plusSeconds(300); // 5 minutes validity
        tokenStore.put(token, new LinkTokenData(userId, provider.toLowerCase(), expiresAt));
        return token;
    }

    public LinkTokenData validateAndConsumeLinkToken(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        LinkTokenData data = tokenStore.remove(token.trim());
        if (data == null) {
            return null;
        }
        if (clock.instant().isAfter(data.expiresAt())) {
            return null;
        }
        return data;
    }

    public void clear() {
        tokenStore.clear();
    }
}

