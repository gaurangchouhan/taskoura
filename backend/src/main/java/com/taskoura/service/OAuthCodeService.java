package com.taskoura.service;

import com.taskoura.entity.OAuthLoginCode;
import com.taskoura.exception.ValidationException;
import com.taskoura.repository.OAuthLoginCodeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

@Service
public class OAuthCodeService {

    private final OAuthLoginCodeRepository loginCodeRepository;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    @Autowired
    public OAuthCodeService(OAuthLoginCodeRepository loginCodeRepository,
                            @Autowired(required = false) Clock clock) {
        this.loginCodeRepository = loginCodeRepository;
        this.clock = clock != null ? clock : Clock.systemUTC();
    }

    public OAuthCodeService(OAuthLoginCodeRepository loginCodeRepository) {
        this(loginCodeRepository, Clock.systemUTC());
    }

    @Transactional
    public String generateAndSaveCode(UUID userId) {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String rawCode = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        String hashedCode = hash(rawCode);
        Instant now = clock.instant();
        Instant expiresAt = now.plus(60, ChronoUnit.SECONDS);

        OAuthLoginCode codeEntity = OAuthLoginCode.builder()
                .userId(userId)
                .hashedCode(hashedCode)
                .expiresAt(expiresAt)
                .usedAt(null)
                .build();

        loginCodeRepository.save(codeEntity);
        return rawCode;
    }

    @Transactional
    public UUID consumeCode(String rawCode) {
        if (rawCode == null || rawCode.isBlank()) {
            throw new ValidationException("Invalid code", Map.of("code", "Code is required"));
        }

        String hashedCode = hash(rawCode.trim());
        OAuthLoginCode codeEntity = loginCodeRepository.findByHashedCode(hashedCode)
                .orElseThrow(() -> new ValidationException("Invalid or expired exchange code",
                        Map.of("code", "Invalid or expired exchange code")));

        Instant now = clock.instant();
        if (codeEntity.getUsedAt() != null || !now.isBefore(codeEntity.getExpiresAt())) {
            throw new ValidationException("Invalid or expired exchange code",
                    Map.of("code", "Invalid or expired exchange code"));
        }

        codeEntity.setUsedAt(now);
        loginCodeRepository.save(codeEntity);

        return codeEntity.getUserId();
    }

    public static String hash(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encodedhash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(encodedhash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 digest algorithm not available", e);
        }
    }
}

