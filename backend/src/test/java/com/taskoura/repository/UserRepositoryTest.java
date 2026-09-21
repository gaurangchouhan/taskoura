package com.taskoura.repository;

import com.taskoura.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * JPA slice tests for UserRepository.
 *
 * @DataJpaTest boots only the JPA layer (no web layer, no services).
 * Requires a running PostgreSQL instance with the "taskoura" database
 * (matches application.properties defaults).
 *
 * NOTE: These tests run against the local dev PostgreSQL database.
 *       They will roll back after each test (Spring's default for @DataJpaTest).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class UserRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private UserRepository userRepository;

    private User savedUser;

    @BeforeEach
    void setUp() {
        savedUser = User.builder()
                .name("Alice Test")
                .email("alice-repo-test@example.com")
                .passwordHash("$2a$10$somehashedpassword")
                .verified(true)
                .build();
        savedUser = entityManager.persistAndFlush(savedUser);
        entityManager.clear(); // detach so queries hit the DB
    }

    // ------------------------------------------------------------------ //
    //  Happy path
    // ------------------------------------------------------------------ //

    @Test
    void findByEmail_existingEmail_returnsUser() {
        Optional<User> found = userRepository.findByEmail("alice-repo-test@example.com");

        assertThat(found).isPresent();
        assertThat(found.get().getName()).isEqualTo("Alice Test");
        assertThat(found.get().isVerified()).isTrue();
    }

    @Test
    void existsByEmail_existingEmail_returnsTrue() {
        boolean exists = userRepository.existsByEmail("alice-repo-test@example.com");
        assertThat(exists).isTrue();
    }

    @Test
    void save_persistsAllFields() {
        User user = User.builder()
                .name("Bob Persisted")
                .email("bob-persist@example.com")
                .passwordHash("$2a$10$anotherhash")
                .otpCode("1234")
                .build();

        User saved = userRepository.save(user);
        entityManager.flush();
        entityManager.clear();

        User reloaded = entityManager.find(User.class, saved.getId());
        assertThat(reloaded).isNotNull();
        assertThat(reloaded.getId()).isNotNull();
        assertThat(reloaded.getName()).isEqualTo("Bob Persisted");
        assertThat(reloaded.getEmail()).isEqualTo("bob-persist@example.com");
        assertThat(reloaded.getOtpCode()).isEqualTo("1234");
        assertThat(reloaded.isVerified()).isFalse();           // @Builder.Default
        assertThat(reloaded.getCreatedAt()).isNotNull();       // @Builder.Default
    }

    // ------------------------------------------------------------------ //
    //  Not-found cases
    // ------------------------------------------------------------------ //

    @Test
    void findByEmail_unknownEmail_returnsEmpty() {
        Optional<User> found = userRepository.findByEmail("nobody@nowhere.com");
        assertThat(found).isEmpty();
    }

    @Test
    void existsByEmail_unknownEmail_returnsFalse() {
        boolean exists = userRepository.existsByEmail("ghost@example.com");
        assertThat(exists).isFalse();
    }

    // ------------------------------------------------------------------ //
    //  Duplicate / conflict
    // ------------------------------------------------------------------ //

    @Test
    void save_duplicateEmail_throwsException() {
        User duplicate = User.builder()
                .name("Alice Duplicate")
                .email("alice-repo-test@example.com")   // same email as savedUser
                .passwordHash("$2a$10$differenthash")
                .build();

        // Persisting a duplicate unique-constrained email must throw
        org.junit.jupiter.api.Assertions.assertThrows(
                Exception.class,
                () -> {
                    entityManager.persistAndFlush(duplicate);
                }
        );
    }
}
