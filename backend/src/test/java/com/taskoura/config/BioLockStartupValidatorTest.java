package com.taskoura.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BioLockStartupValidatorTest {

    @Mock
    private DataSource dataSource;

    @Mock
    private Connection connection;

    @Mock
    private Statement statement;

    @Mock
    private ResultSet tablesResultSet;

    @Mock
    private ResultSet columnsResultSet;

    private BiolockProperties properties;
    private BioLockStartupValidator validator;

    @BeforeEach
    void setUp() {
        properties = new BiolockProperties();
        validator = new BioLockStartupValidator(properties, dataSource);
    }

    @Test
    @DisplayName("Self-check skips validation when BIOLOCK_ENABLED is false")
    void skipsValidationWhenDisabled() {
        properties.setEnabled(false);
        validator.validateBioLockSchema();

        verifyNoInteractions(dataSource);
        assertThat(validator.isSchemaValid()).isTrue();
    }

    @Test
    @DisplayName("Self-check succeeds when all BioLock tables and columns exist")
    void succeedsWhenAllSchemaElementsPresent() throws Exception {
        properties.setEnabled(true);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(statement);

        when(statement.executeQuery(contains("information_schema.tables"))).thenReturn(tablesResultSet);
        when(tablesResultSet.next()).thenReturn(
                true, true, true, true, true, true, true, true, false
        );
        when(tablesResultSet.getString("tname")).thenReturn(
                "biolock_devices",
                "biometric_credentials",
                "project_biometric_settings",
                "biolock_jobs",
                "device_nonces",
                "document_access_requests",
                "biolock_audit_events",
                "attachments"
        );

        when(statement.executeQuery(contains("information_schema.columns"))).thenReturn(columnsResultSet);
        when(columnsResultSet.next()).thenReturn(true, false);
        when(columnsResultSet.getString("tname")).thenReturn("attachments");
        when(columnsResultSet.getString("cname")).thenReturn("restricted");

        validator.validateBioLockSchema();

        assertThat(validator.isSchemaValid()).isTrue();
        assertThat(validator.getMissingItems()).isEmpty();
    }

    @Test
    @DisplayName("Self-check logs error and does not crash when columns or tables are missing")
    void logsErrorWithoutCrashingWhenMissingSchema() throws Exception {
        properties.setEnabled(true);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(statement);

        when(statement.executeQuery(contains("information_schema.tables"))).thenReturn(tablesResultSet);
        when(tablesResultSet.next()).thenReturn(true, false);
        when(tablesResultSet.getString("tname")).thenReturn("users");

        when(statement.executeQuery(contains("information_schema.columns"))).thenReturn(columnsResultSet);
        when(columnsResultSet.next()).thenReturn(false);

        // Must not throw exception
        validator.validateBioLockSchema();

        assertThat(validator.isSchemaValid()).isFalse();
        assertThat(validator.getMissingItems()).isNotEmpty();
        assertThat(validator.getMissingItems()).contains("table:biolock_devices");
        assertThat(validator.getMissingItems()).contains("column:attachments.restricted");
    }

    @Test
    @DisplayName("Self-check handles database connection error without crashing the application")
    void handlesDatabaseErrorWithoutCrashing() throws Exception {
        properties.setEnabled(true);
        when(dataSource.getConnection()).thenThrow(new SQLException("Neon DB temporarily unreachable"));

        // Must not crash
        validator.validateBioLockSchema();

        assertThat(validator.isSchemaValid()).isFalse();
    }
}
