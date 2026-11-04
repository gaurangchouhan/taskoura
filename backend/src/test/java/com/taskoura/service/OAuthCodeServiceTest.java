package com.taskoura.service;

import com.taskoura.entity.OAuthLoginCode;
import com.taskoura.exception.ValidationException;
import com.taskoura.repository.OAuthLoginCodeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OAuthCodeServiceTest {

    @Mock
    private OAuthLoginCodeRepository loginCodeRepository;

    private Clock fixedClock;
    private Instant fixedInstant;
    private OAuthCodeService oAuthCodeService;

    @BeforeEach
    void setUp() {
        fixedInstant = Instant.parse("2026-10-30T12:00:00Z");
        fixedClock = Clock.fixed(fixedInstant, ZoneId.of("UTC"));
        // Test primary constructor injection with Clock
        oAuthCodeService = new OAuthCodeService(loginCodeRepository, fixedClock);
    }

    @Test
    @DisplayName("Single-arg constructor initializes with system UTC clock when clock is omitted")
    void testSingleArgConstructor() {
        OAuthCodeService service = new OAuthCodeService(loginCodeRepository);
        assertThat(service).isNotNull();

        UUID userId = UUID.randomUUID();
        when(loginCodeRepository.save(any(OAuthLoginCode.class))).thenAnswer(inv -> inv.getArgument(0));

        String code = service.generateAndSaveCode(userId);
        assertThat(code).isNotBlank();
        verify(loginCodeRepository, times(1)).save(any(OAuthLoginCode.class));
    }

    @Test
    @DisplayName("generateAndSaveCode creates raw URL-safe code and saves hashed version with 60s expiration")
    void testGenerateAndSaveCode() {
        UUID userId = UUID.randomUUID();
        ArgumentCaptor<OAuthLoginCode> captor = ArgumentCaptor.forClass(OAuthLoginCode.class);

        String rawCode = oAuthCodeService.generateAndSaveCode(userId);

        assertThat(rawCode).isNotBlank();
        assertThat(rawCode).doesNotContain("="); // URL-safe without padding

        verify(loginCodeRepository).save(captor.capture());
        OAuthLoginCode saved = captor.getValue();

        assertThat(saved.getUserId()).isEqualTo(userId);
        assertThat(saved.getHashedCode()).isEqualTo(OAuthCodeService.hash(rawCode));
        assertThat(saved.getExpiresAt()).isEqualTo(fixedInstant.plusSeconds(60));
        assertThat(saved.getUsedAt()).isNull();
    }

    @Test
    @DisplayName("consumeCode succeeds on first use and marks code as used")
    void testConsumeCode_Success() {
        UUID userId = UUID.randomUUID();
        String rawCode = "test-raw-code-1234567890";
        String hashed = OAuthCodeService.hash(rawCode);

        OAuthLoginCode loginCode = OAuthLoginCode.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .hashedCode(hashed)
                .expiresAt(fixedInstant.plusSeconds(30))
                .usedAt(null)
                .build();

        when(loginCodeRepository.findByHashedCode(hashed)).thenReturn(Optional.of(loginCode));

        UUID consumedUserId = oAuthCodeService.consumeCode(rawCode);

        assertThat(consumedUserId).isEqualTo(userId);
        assertThat(loginCode.getUsedAt()).isEqualTo(fixedInstant);
        verify(loginCodeRepository).save(loginCode);
    }

    @Test
    @DisplayName("consumeCode throws ValidationException when code is already used (single-use constraint)")
    void testConsumeCode_AlreadyUsed() {
        UUID userId = UUID.randomUUID();
        String rawCode = "used-code";
        String hashed = OAuthCodeService.hash(rawCode);

        OAuthLoginCode usedCode = OAuthLoginCode.builder()
                .userId(userId)
                .hashedCode(hashed)
                .expiresAt(fixedInstant.plusSeconds(30))
                .usedAt(fixedInstant.minusSeconds(10))
                .build();

        when(loginCodeRepository.findByHashedCode(hashed)).thenReturn(Optional.of(usedCode));

        assertThatThrownBy(() -> oAuthCodeService.consumeCode(rawCode))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("Invalid or expired exchange code");

        verify(loginCodeRepository, never()).save(any());
    }

    @Test
    @DisplayName("consumeCode throws ValidationException when code is expired (past 60s)")
    void testConsumeCode_Expired() {
        UUID userId = UUID.randomUUID();
        String rawCode = "expired-code";
        String hashed = OAuthCodeService.hash(rawCode);

        OAuthLoginCode expiredCode = OAuthLoginCode.builder()
                .userId(userId)
                .hashedCode(hashed)
                .expiresAt(fixedInstant.minusSeconds(1)) // Expired 1s ago
                .usedAt(null)
                .build();

        when(loginCodeRepository.findByHashedCode(hashed)).thenReturn(Optional.of(expiredCode));

        assertThatThrownBy(() -> oAuthCodeService.consumeCode(rawCode))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("Invalid or expired exchange code");

        verify(loginCodeRepository, never()).save(any());
    }

    @Test
    @DisplayName("consumeCode throws ValidationException when code is not found in database")
    void testConsumeCode_NotFound() {
        String rawCode = "non-existent-code";
        String hashed = OAuthCodeService.hash(rawCode);

        when(loginCodeRepository.findByHashedCode(hashed)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> oAuthCodeService.consumeCode(rawCode))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("Invalid or expired exchange code");
    }

    @Test
    @DisplayName("consumeCode throws ValidationException for blank or null input")
    void testConsumeCode_NullOrBlank() {
        assertThatThrownBy(() -> oAuthCodeService.consumeCode(null))
                .isInstanceOf(ValidationException.class);

        assertThatThrownBy(() -> oAuthCodeService.consumeCode("   "))
                .isInstanceOf(ValidationException.class);
    }
}

