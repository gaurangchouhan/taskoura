package com.taskoura.repository;

import com.taskoura.entity.DeviceNonce;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DeviceNonceRepository extends JpaRepository<DeviceNonce, UUID> {

    boolean existsByDeviceIdAndNonce(UUID deviceId, String nonce);

    Optional<DeviceNonce> findByDeviceIdAndNonce(UUID deviceId, String nonce);

    @Modifying
    @Query("DELETE FROM DeviceNonce n WHERE n.expiresAt < :now")
    int deleteExpiredNonces(@Param("now") Instant now);
}
