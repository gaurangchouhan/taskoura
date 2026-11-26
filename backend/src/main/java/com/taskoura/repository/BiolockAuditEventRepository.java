package com.taskoura.repository;

import com.taskoura.entity.BiolockAuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BiolockAuditEventRepository extends JpaRepository<BiolockAuditEvent, UUID> {

    List<BiolockAuditEvent> findByProjectIdOrderByCreatedAtDesc(UUID projectId);

    List<BiolockAuditEvent> findByDeviceIdOrderByCreatedAtDesc(UUID deviceId);

    List<BiolockAuditEvent> findByRequestIdOrderByCreatedAtDesc(UUID requestId);
}
