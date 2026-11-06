package com.taskoura.security.oauth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OAuthLinkTokenService {

    public record LinkTokenData(UUID userId, String provider, Instant expiresAt) {}

    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, LinkTokenData> tokenStore = new ConcurrentHashMap<>();

    @Autowired
    public OAuthLinkTokenService(@Autowired(required = false) Clock clock) {
        this.clock = clock != null ? clock : Clock.systemUTC();
    }

    public OAuthLinkTokenService() {
        this(Clock.systemUTC());
    }

    public String createLinkToken(UUID userId, String provider) {
        if (userId == null || provider == null || provider.isBlank()) {
            throw new IllegalArgumentException("User ID and provider are required to create a link token");
        }
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String token = HexFormat.of().formatHex(bytes);

        Instant expiresAt = clock.instant().plusSeconds(300); // 5 minutes validity
        String hashed = hashToken(token);
        tokenStore.put(hashed, new LinkTokenData(userId, provider.toLowerCase().trim(), expiresAt));
        return token;
    }

    public boolean validateToken(String token, String expectedProvider) {
        if (token == null || token.isBlank() || expectedProvider == null || expectedProvider.isBlank()) {
            return false;
        }
        String hashed = hashToken(token.trim());
        LinkTokenData data = tokenStore.get(hashed);
        if (data == null) {
            return false;
        }
        if (clock.instant().isAfter(data.expiresAt())) {
            tokenStore.remove(hashed);
            return false;
        }
        return data.provider().equalsIgnoreCase(expectedProvider.trim());
    }

    public LinkTokenData consumeToken(String token) {
        return validateAndConsumeLinkToken(token);
    }

    public LinkTokenData validateAndConsumeLinkToken(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        String hashed = hashToken(token.trim());
        LinkTokenData data = tokenStore.remove(hashed);
        if (data == null) {
            return null;
        }
        if (clock.instant().isAfter(data.expiresAt())) {
            return null;
        }
        return data;
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }

    public void clear() {
        tokenStore.clear();
    }
}
