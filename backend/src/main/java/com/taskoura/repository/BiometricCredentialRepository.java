package com.taskoura.repository;

import com.taskoura.entity.BiometricCredential;
import com.taskoura.entity.CredentialStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BiometricCredentialRepository extends JpaRepository<BiometricCredential, UUID> {

    List<BiometricCredential> findByUserIdAndStatusNot(UUID userId, CredentialStatus status);

    Optional<BiometricCredential> findByUserIdAndStatus(UUID userId, CredentialStatus status);

    Optional<BiometricCredential> findByUserIdAndDeviceIdAndStatusNot(UUID userId, UUID deviceId, CredentialStatus status);

    Optional<BiometricCredential> findByDeviceIdAndSensorSlotIdAndStatusNot(UUID deviceId, Integer sensorSlotId, CredentialStatus status);

    List<BiometricCredential> findByDeviceIdAndStatus(UUID deviceId, CredentialStatus status);

    List<BiometricCredential> findByDeviceIdAndStatusNot(UUID deviceId, CredentialStatus status);

    List<BiometricCredential> findByStatusAndUnusedSinceLessThanEqual(CredentialStatus status, java.time.Instant cutoff);

    boolean existsByDeviceIdAndSensorSlotIdAndStatusNot(UUID deviceId, Integer sensorSlotId, CredentialStatus status);
}
