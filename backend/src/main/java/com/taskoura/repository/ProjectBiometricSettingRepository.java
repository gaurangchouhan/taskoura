package com.taskoura.repository;

import com.taskoura.entity.ProjectBiometricSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProjectBiometricSettingRepository extends JpaRepository<ProjectBiometricSetting, UUID> {

    Optional<ProjectBiometricSetting> findByProjectId(UUID projectId);

    boolean existsByProjectIdAndEnabledTrue(UUID projectId);

    boolean existsByCredentialIdAndEnabledTrue(UUID credentialId);

    @Query("""
        SELECT count(s) FROM ProjectBiometricSetting s
        JOIN Project p ON s.projectId = p.id
        WHERE s.credentialId = :credentialId
          AND s.enabled = true
          AND p.deletedAt IS NULL
    """)
    long countActiveProjectsUsingCredential(@Param("credentialId") UUID credentialId);
}
