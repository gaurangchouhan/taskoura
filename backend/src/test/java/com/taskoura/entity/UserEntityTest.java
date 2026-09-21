package com.taskoura.entity;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure unit tests for the User entity — no Spring context required.
 * Tests that Lombok annotations and @Builder.Default work correctly.
 */
class UserEntityTest {

    @Test
    void builder_setsAllExplicitFields() {
        User user = User.builder()
                .name("Alice")
                .email("alice@example.com")
                .passwordHash("$2a$hashed")
                .build();

        assertThat(user.getName()).isEqualTo("Alice");
        assertThat(user.getEmail()).isEqualTo("alice@example.com");
        assertThat(user.getPasswordHash()).isEqualTo("$2a$hashed");
    }

    @Test
    void builder_defaultVerifiedIsFalse() {
        User user = User.builder()
                .name("Bob")
                .email("bob@example.com")
                .passwordHash("hash")
                .build();

        assertThat(user.isVerified()).isFalse();
    }

    @Test
    void builder_defaultCreatedAtIsPopulated() {
        LocalDateTime before = LocalDateTime.now().minusSeconds(1);

        User user = User.builder()
                .name("Charlie")
                .email("charlie@example.com")
                .passwordHash("hash")
                .build();

        LocalDateTime after = LocalDateTime.now().plusSeconds(1);

        assertThat(user.getCreatedAt()).isNotNull();
        assertThat(user.getCreatedAt()).isAfterOrEqualTo(before);
        assertThat(user.getCreatedAt()).isBeforeOrEqualTo(after);
    }

    @Test
    void builder_otpFieldsAreNullByDefault() {
        User user = User.builder()
                .name("Dan")
                .email("dan@example.com")
                .passwordHash("hash")
                .build();

        assertThat(user.getOtpCode()).isNull();
        assertThat(user.getOtpExpiresAt()).isNull();
    }

    @Test
    void noArgsConstructor_createsEmptyUser() {
        User user = new User();
        assertThat(user.getId()).isNull();
        assertThat(user.getEmail()).isNull();
    }

    @Test
    void setters_workCorrectly() {
        User user = new User();
        user.setName("Eve");
        user.setEmail("eve@example.com");
        user.setVerified(true);

        assertThat(user.getName()).isEqualTo("Eve");
        assertThat(user.getEmail()).isEqualTo("eve@example.com");
        assertThat(user.isVerified()).isTrue();
    }
}
