package com.taskoura.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Validates the safe 4-step schema migration for existing PostgreSQL production databases
 * containing existing user rows.
 */
class SchemaMigrationVerificationTest {

    private Connection connection;

    @BeforeEach
    void setUp() throws SQLException {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:migration_test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH");
        dataSource.setUsername("sa");
        dataSource.setPassword("");

        connection = dataSource.getConnection();

        // 1. Create legacy users table (WITHOUT password_login_enabled) mimicking pre-OAuth schema
        try (Statement stmt = connection.createStatement()) {
            stmt.execute("DROP TABLE IF EXISTS users");
            stmt.execute("""
                CREATE TABLE users (
                    id UUID PRIMARY KEY,
                    name VARCHAR(255),
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255),
                    verified BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """);

            // 2. Populate existing users:
            // - 2 existing password users
            // - 1 user with null password
            stmt.execute(String.format(
                    "INSERT INTO users (id, name, email, password_hash, verified) VALUES ('%s', 'Ada Lovelace', 'ada@taskoura.dev', '$2a$10$hashAda', true)",
                    UUID.randomUUID()
            ));
            stmt.execute(String.format(
                    "INSERT INTO users (id, name, email, password_hash, verified) VALUES ('%s', 'Grace Hopper', 'grace@taskoura.dev', '$2a$10$hashGrace', true)",
                    UUID.randomUUID()
            ));
            stmt.execute(String.format(
                    "INSERT INTO users (id, name, email, password_hash, verified) VALUES ('%s', 'OAuth User', 'oauth@taskoura.dev', NULL, true)",
                    UUID.randomUUID()
            ));
        }
    }

    @AfterEach
    void tearDown() throws SQLException {
        if (connection != null && !connection.isClosed()) {
            try (Statement stmt = connection.createStatement()) {
                stmt.execute("DROP TABLE IF EXISTS users");
            }
            connection.close();
        }
    }

    @Test
    @DisplayName("Naive ALTER TABLE with NOT NULL fails on non-empty table (reproducing Render failure)")
    void testNaiveAlterFails() throws SQLException {
        try (Statement stmt = connection.createStatement()) {
            // In SQL / PostgreSQL, adding a NOT NULL column without a default to an existing populated table fails
            assertThatThrownBy(() -> stmt.execute("ALTER TABLE users ADD COLUMN password_login_enabled BOOLEAN NOT NULL"))
                    .isInstanceOf(SQLException.class);
        }
    }

    @Test
    @DisplayName("Safe 4-step migration succeeds, backfills existing users correctly, sets default, and enforces NOT NULL")
    void testSafeFourStepMigration() throws SQLException {
        try (Statement stmt = connection.createStatement()) {
            // Step 1: Add column as nullable first
            stmt.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_login_enabled BOOLEAN");

            // Step 2: Backfill existing records
            stmt.execute("UPDATE users SET password_login_enabled = (password_hash IS NOT NULL AND password_hash <> '') WHERE password_login_enabled IS NULL");

            // Step 3: Establish default for future rows
            stmt.execute("ALTER TABLE users ALTER COLUMN password_login_enabled SET DEFAULT TRUE");

            // Step 4: Apply NOT NULL constraint safely
            stmt.execute("ALTER TABLE users ALTER COLUMN password_login_enabled SET NOT NULL");
        }

        // Verify Step 2 results
        try (PreparedStatement ps = connection.prepareStatement("SELECT email, password_login_enabled FROM users ORDER BY email")) {
            try (ResultSet rs = ps.executeQuery()) {
                // ada@taskoura.dev -> true
                assertThat(rs.next()).isTrue();
                assertThat(rs.getString("email")).isEqualTo("ada@taskoura.dev");
                assertThat(rs.getBoolean("password_login_enabled")).isTrue();

                // grace@taskoura.dev -> true
                assertThat(rs.next()).isTrue();
                assertThat(rs.getString("email")).isEqualTo("grace@taskoura.dev");
                assertThat(rs.getBoolean("password_login_enabled")).isTrue();

                // oauth@taskoura.dev -> false
                assertThat(rs.next()).isTrue();
                assertThat(rs.getString("email")).isEqualTo("oauth@taskoura.dev");
                assertThat(rs.getBoolean("password_login_enabled")).isFalse();

                assertThat(rs.next()).isFalse();
            }
        }

        // Verify Step 3: Newly inserted rows receive DEFAULT true
        UUID newUserId = UUID.randomUUID();
        try (Statement stmt = connection.createStatement()) {
            stmt.execute(String.format(
                    "INSERT INTO users (id, name, email, password_hash, verified) VALUES ('%s', 'New Registrant', 'new@taskoura.dev', '$2a$10$newHash', false)",
                    newUserId
            ));
        }

        try (PreparedStatement ps = connection.prepareStatement("SELECT password_login_enabled FROM users WHERE id = ?")) {
            ps.setObject(1, newUserId);
            try (ResultSet rs = ps.executeQuery()) {
                assertThat(rs.next()).isTrue();
                assertThat(rs.getBoolean("password_login_enabled")).isTrue();
            }
        }

        // Verify Step 4: NULL constraint is enforced
        try (Statement stmt = connection.createStatement()) {
            assertThatThrownBy(() -> stmt.execute(String.format(
                    "INSERT INTO users (id, name, email, password_hash, password_login_enabled) VALUES ('%s', 'Null User', 'null@taskoura.dev', '$2a$10$hash', NULL)",
                    UUID.randomUUID()
            ))).isInstanceOf(SQLException.class);
        }
    }
}
