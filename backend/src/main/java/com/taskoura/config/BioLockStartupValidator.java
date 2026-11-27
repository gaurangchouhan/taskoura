package com.taskoura.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.*;

@Component
public class BioLockStartupValidator {

    private static final Logger log = LoggerFactory.getLogger(BioLockStartupValidator.class);

    private final BiolockProperties biolockProperties;
    private final DataSource dataSource;
    private boolean schemaValid = true;
    private final List<String> missingItems = new ArrayList<>();

    public BioLockStartupValidator(BiolockProperties biolockProperties, DataSource dataSource) {
        this.biolockProperties = biolockProperties;
        this.dataSource = dataSource;
    }

    public boolean isSchemaValid() {
        return schemaValid;
    }

    public List<String> getMissingItems() {
        return Collections.unmodifiableList(missingItems);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void validateBioLockSchema() {
        if (!biolockProperties.isEnabled()) {
            return;
        }

        missingItems.clear();
        Set<String> existingTables = new HashSet<>();
        Map<String, Set<String>> tableColumns = new HashMap<>();

        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {

            // Query existing tables
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT LOWER(table_name) AS tname FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')")) {
                while (rs.next()) {
                    String tname = rs.getString("tname");
                    if (tname != null) {
                        existingTables.add(tname.toLowerCase());
                    }
                }
            } catch (Exception e) {
                log.warn("[Taskoura BioLock] Could not query information_schema.tables: {}", e.getMessage());
            }

            // Query existing columns
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT LOWER(table_name) AS tname, LOWER(column_name) AS cname FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog', 'information_schema')")) {
                while (rs.next()) {
                    String tname = rs.getString("tname");
                    String cname = rs.getString("cname");
                    if (tname != null && cname != null) {
                        tableColumns.computeIfAbsent(tname.toLowerCase(), k -> new HashSet<>()).add(cname.toLowerCase());
                    }
                }
            } catch (Exception e) {
                log.warn("[Taskoura BioLock] Could not query information_schema.columns: {}", e.getMessage());
            }

            // Check required BioLock tables
            List<String> requiredTables = List.of(
                    "biolock_devices",
                    "biometric_credentials",
                    "project_biometric_settings",
                    "biolock_jobs",
                    "device_nonces",
                    "document_access_requests",
                    "biolock_audit_events"
            );

            for (String table : requiredTables) {
                if (!existingTables.contains(table)) {
                    missingItems.add("table:" + table);
                }
            }

            // Check required column on attachments
            Set<String> attachmentCols = tableColumns.getOrDefault("attachments", Collections.emptySet());
            if (!attachmentCols.contains("restricted")) {
                missingItems.add("column:attachments.restricted");
            }

            if (!missingItems.isEmpty()) {
                schemaValid = false;
                log.error("[Taskoura BioLock] Startup schema validation failed! Missing database tables/columns: {}. Please execute migration script: backend/docs/migrations/biolock.sql on your database.", missingItems);
            } else {
                schemaValid = true;
                log.info("[Taskoura BioLock] Startup schema validation passed. All BioLock tables and columns are present.");
            }

        } catch (Exception e) {
            log.error("[Taskoura BioLock] Error during startup schema validation: {}. BioLock initialization aborted without crashing.", e.getMessage());
            schemaValid = false;
        }
    }
}
