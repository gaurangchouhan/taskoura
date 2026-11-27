package com.taskoura.config;

import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.metamodel.EntityType;
import jakarta.persistence.metamodel.Metamodel;
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
import java.util.Collections;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SchemaDriftValidatorTest {

    @Mock
    private EntityManagerFactory entityManagerFactory;

    @Mock
    private DataSource dataSource;

    @Mock
    private Connection connection;

    @Mock
    private Statement statement;

    @Mock
    private ResultSet resultSet;

    @Mock
    private Metamodel metamodel;

    @Test
    @DisplayName("validateSchemaDrift: handles database exception gracefully without crashing or throwing")
    void validateSchemaDrift_dbException_doesNotCrash() throws SQLException {
        when(dataSource.getConnection()).thenThrow(new SQLException("Connection refused"));

        SchemaDriftValidator validator = new SchemaDriftValidator(entityManagerFactory, dataSource);

        assertThatCode(validator::validateSchemaDrift).doesNotThrowAnyException();
        assertThat(validator.isDriftDetected()).isFalse();
    }

    @Test
    @DisplayName("validateSchemaDrift: detects missing table and logs error without crashing")
    void validateSchemaDrift_missingTable_logsAndDoesNotCrash() throws SQLException {
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(statement);
        when(statement.executeQuery(anyString())).thenReturn(resultSet);
        // Table exists in information_schema: users
        when(resultSet.next()).thenReturn(true, false);
        when(resultSet.getString("tbl")).thenReturn("users");
        when(resultSet.getString("col")).thenReturn("id");

        when(entityManagerFactory.getMetamodel()).thenReturn(metamodel);
        EntityType entityType = mock(EntityType.class);
        when(entityType.getJavaType()).thenReturn((Class) com.taskoura.entity.Project.class);
        Set<EntityType<?>> entities = Collections.singleton(entityType);
        when(metamodel.getEntities()).thenReturn(entities);

        SchemaDriftValidator validator = new SchemaDriftValidator(entityManagerFactory, dataSource);

        assertThatCode(validator::validateSchemaDrift).doesNotThrowAnyException();
        assertThat(validator.isDriftDetected()).isTrue();
        assertThat(validator.getMissingSchemaItems()).isNotEmpty();
        assertThat(validator.getMissingSchemaItems().get(0)).contains("Missing Table: projects");
    }

    @Test
    @DisplayName("validateSchemaDrift: no drift detected when all tables and columns match")
    void validateSchemaDrift_cleanMatch_noDrift() throws SQLException {
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(statement);
        when(statement.executeQuery(anyString())).thenReturn(resultSet);
        when(resultSet.next()).thenReturn(false);

        SchemaDriftValidator validator = new SchemaDriftValidator(entityManagerFactory, dataSource);

        assertThatCode(validator::validateSchemaDrift).doesNotThrowAnyException();
        assertThat(validator.isDriftDetected()).isFalse();
    }
}
