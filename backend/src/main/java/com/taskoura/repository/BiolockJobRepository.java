package com.taskoura.repository;

import com.taskoura.entity.BiolockJob;
import com.taskoura.entity.JobStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BiolockJobRepository extends JpaRepository<BiolockJob, UUID> {

    Optional<BiolockJob> findByAccessRequestId(UUID accessRequestId);

    List<BiolockJob> findByDeviceIdAndStatus(UUID deviceId, JobStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        SELECT j FROM BiolockJob j
        WHERE j.deviceId = :deviceId
          AND (j.status = com.taskoura.entity.JobStatus.QUEUED
               OR (j.status = com.taskoura.entity.JobStatus.CLAIMED AND j.leaseUntil < :now))
          AND j.expiresAt > :now
        ORDER BY j.createdAt ASC
    """)
    List<BiolockJob> findNextClaimableJobsWithLock(@Param("deviceId") UUID deviceId, @Param("now") Instant now);

    @Query("""
        SELECT j FROM BiolockJob j
        WHERE j.status IN (com.taskoura.entity.JobStatus.QUEUED, com.taskoura.entity.JobStatus.CLAIMED)
          AND j.expiresAt <= :now
    """)
    List<BiolockJob> findExpiredJobs(@Param("now") Instant now);
}
