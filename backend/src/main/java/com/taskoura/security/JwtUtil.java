package com.taskoura.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.time.Clock;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration-ms}")
    private long expirationMs;

    private final Clock clock;

    public JwtUtil(@Autowired(required = false) Clock clock) {
        this.clock = clock != null ? clock : Clock.systemUTC();
    }

    private SecretKey getKey() {
        return Keys.hmacShaKeyFor(secret.getBytes());
    }

    /**
     * Legacy token generator (kept for backward compatibility).
     */
    public String generateToken(String email) {
        Instant now = clock.instant();
        return Jwts.builder()
                .subject(email)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusMillis(expirationMs)))
                .signWith(getKey())
                .compact();
    }

    /**
     * Session-aware token generator including sid and explicit absolute expiration.
     */
    public String generateToken(String email, UUID sid, Instant absoluteExpiresAt) {
        Instant now = clock.instant();
        return Jwts.builder()
                .subject(email)
                .claim("sid", sid.toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(absoluteExpiresAt))
                .signWith(getKey())
                .compact();
    }

    public String extractEmail(String token) {
        return parseClaims(token).getSubject();
    }

    public Optional<UUID> extractSid(String token) {
        try {
            Claims claims = parseClaimsAllowingExpired(token);
            String sidStr = claims.get("sid", String.class);
            if (sidStr != null && !sidStr.isBlank()) {
                return Optional.of(UUID.fromString(sidStr));
            }
            return Optional.empty();
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public boolean isTokenValid(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public boolean validateToken(String token) {
        return isTokenValid(token);
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(getKey())
                .clock(() -> Date.from(clock.instant()))
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public Claims parseClaimsAllowingExpired(String token) throws JwtException {
        try {
            return parseClaims(token);
        } catch (ExpiredJwtException ex) {
            return ex.getClaims();
        }
    }
}