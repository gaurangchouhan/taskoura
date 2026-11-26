package com.taskoura.service;

import com.taskoura.entity.BiolockAuditEvent;
import com.taskoura.repository.BiolockAuditEventRepository;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

@Service
public class BioLockAuditService {

    private final BiolockAuditEventRepository auditEventRepository;
    private final Clock clock;

    public BioLockAuditService(BiolockAuditEventRepository auditEventRepository, Clock clock) {
        this.auditEventRepository = auditEventRepository;
        this.clock = clock;
    }

    public void logEvent(
            String type,
            UUID actorUserId,
            UUID deviceId,
            UUID projectId,
            UUID requestId,
            UUID jobId,
            String detail
    ) {
        Instant now = clock.instant();
        BiolockAuditEvent event = BiolockAuditEvent.builder()
                .type(type)
                .actorUserId(actorUserId)
                .deviceId(deviceId)
                .projectId(projectId)
                .requestId(requestId)
                .jobId(jobId)
                .detail(detail)
                .createdAt(now)
                .build();
        auditEventRepository.save(event);
    }
}
