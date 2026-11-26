package com.taskoura.repository;

import com.taskoura.entity.BiolockDevice;
import com.taskoura.entity.DeviceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BiolockDeviceRepository extends JpaRepository<BiolockDevice, UUID> {

    Optional<BiolockDevice> findByIdAndStatus(UUID id, DeviceStatus status);

    Optional<BiolockDevice> findByOwnerUserIdAndStatus(UUID ownerUserId, DeviceStatus status);

    List<BiolockDevice> findByOwnerUserIdOrderByCreatedAtDesc(UUID ownerUserId);

    boolean existsByOwnerUserIdAndStatus(UUID ownerUserId, DeviceStatus status);
}
