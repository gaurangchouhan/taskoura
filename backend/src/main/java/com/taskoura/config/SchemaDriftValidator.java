package com.taskoura.config;

import jakarta.persistence.Column;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.persistence.metamodel.Attribute;
import jakarta.persistence.metamodel.EntityType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.*;

/**
 * Validates the database schema at application startup against all JPA entities.
 * If any table or column is missing, it logs ONE clear ERROR with suggested idempotent SQL
 * statements, and lets the application boot normally without crashing.
 */
@Component
public class SchemaDriftValidator {

    private static final Logger log = LoggerFactory.getLogger(SchemaDriftValidator.class);

    private final EntityManagerFactory entityManagerFactory;
    private final DataSource dataSource;
    private final List<String> missingSchemaItems = new ArrayList<>();
    private boolean driftDetected = false;

    public SchemaDriftValidator(EntityManagerFactory entityManagerFactory, DataSource dataSource) {
        this.entityManagerFactory = entityManagerFactory;
        this.dataSource = dataSource;
    }

    public boolean isDriftDetected() {
        return driftDetected;
    }

    public List<String> getMissingSchemaItems() {
        return Collections.unmodifiableList(missingSchemaItems);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void validateSchemaDrift() {
        missingSchemaItems.clear();
        driftDetected = false;

        Map<String, Set<String>> existingSchema = new HashMap<>();

        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {

            // Read existing tables and columns from information_schema
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT lower(table_name) as tbl, lower(column_name) as col " +
                    "FROM information_schema.columns " +
                    "WHERE table_schema = current_schema() OR table_schema = 'public'")) {
                while (rs.next()) {
                    String tbl = rs.getString("tbl");
                    String col = rs.getString("col");
                    if (tbl != null && col != null) {
                        existingSchema.computeIfAbsent(tbl.toLowerCase(), k -> new HashSet<>())
                                .add(col.toLowerCase());
                    }
                }
            }

            if (existingSchema.isEmpty()) {
                // If query returned no rows (e.g. non-standard schema metadata), skip check safely
                return;
            }

            // Inspect all registered JPA entities
            for (EntityType<?> entityType : entityManagerFactory.getMetamodel().getEntities()) {
                Class<?> javaType = entityType.getJavaType();
                if (javaType == null) continue;

                String tableName = resolveTableName(javaType);
                String lowerTableName = tableName.toLowerCase();

                if (!existingSchema.containsKey(lowerTableName)) {
                    missingSchemaItems.add("Missing Table: " + tableName +
                            " | Suggested SQL: CREATE TABLE IF NOT EXISTS " + tableName + " (id UUID PRIMARY KEY);");
                    continue;
                }

                Set<String> existingColumns = existingSchema.get(lowerTableName);

                // Inspect mapped attributes/columns
                for (Attribute<?, ?> attribute : entityType.getAttributes()) {
                    String columnName = resolveColumnName(javaType, attribute);
                    if (columnName != null && !columnName.isBlank()) {
                        String lowerColumnName = columnName.toLowerCase();
                        if (!existingColumns.contains(lowerColumnName)) {
                            missingSchemaItems.add("Missing Column: " + tableName + "." + columnName +
                                    " | Suggested SQL: ALTER TABLE " + tableName +
                                    " ADD COLUMN IF NOT EXISTS " + columnName + " VARCHAR(255);");
                        }
                    }
                }
            }

            if (!missingSchemaItems.isEmpty()) {
                driftDetected = true;
                StringBuilder sb = new StringBuilder();
                sb.append("\n================================================================================\n");
                sb.append("[SCHEMA DRIFT DETECTED] Missing database objects found compared to JPA entities:\n");
                for (String item : missingSchemaItems) {
                    sb.append("  - ").append(item).append("\n");
                }
                sb.append("Execute the idempotent SQL statements above in Neon PostgreSQL to synchronize schema.\n");
                sb.append("================================================================================");
                log.error(sb.toString());
            } else {
                log.info("[SchemaDriftValidator] Schema check passed: all JPA entity tables and columns are present.");
            }

        } catch (Exception e) {
            log.warn("[SchemaDriftValidator] Schema drift check skipped or encountered non-fatal error: {}", e.getMessage());
        }
    }

    private String resolveTableName(Class<?> clazz) {
        Table tableAnn = clazz.getAnnotation(Table.class);
        if (tableAnn != null && !tableAnn.name().isBlank()) {
            return tableAnn.name();
        }
        return toSnakeCase(clazz.getSimpleName());
    }

    private String resolveColumnName(Class<?> clazz, Attribute<?, ?> attribute) {
        try {
            Field field = findField(clazz, attribute.getName());
            if (field != null) {
                Column colAnn = field.getAnnotation(Column.class);
                if (colAnn != null && !colAnn.name().isBlank()) {
                    return colAnn.name();
                }
                JoinColumn joinAnn = field.getAnnotation(JoinColumn.class);
                if (joinAnn != null && !joinAnn.name().isBlank()) {
                    return joinAnn.name();
                }
            }
        } catch (Exception ignored) {
        }
        return toSnakeCase(attribute.getName());
    }

    private Field findField(Class<?> clazz, String fieldName) {
        Class<?> current = clazz;
        while (current != null && current != Object.class) {
            try {
                return current.getDeclaredField(fieldName);
            } catch (NoSuchFieldException e) {
                current = current.getSuperclass();
            }
        }
        return null;
    }

    private String toSnakeCase(String input) {
        if (input == null || input.isBlank()) return input;
        return input.replaceAll("([a-z])([A-Z]+)", "$1_$2").toLowerCase();
    }
}
