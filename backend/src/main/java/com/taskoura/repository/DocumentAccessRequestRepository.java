package com.taskoura.repository;

import com.taskoura.entity.AccessRequestStatus;
import com.taskoura.entity.DocumentAccessRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DocumentAccessRequestRepository extends JpaRepository<DocumentAccessRequest, UUID> {

    @Query("""
        SELECT r FROM DocumentAccessRequest r
        WHERE r.attachmentId = :attachmentId
          AND r.requesterId = :requesterId
          AND r.status = com.taskoura.entity.AccessRequestStatus.PENDING
          AND r.expiresAt > :now
    """)
    Optional<DocumentAccessRequest> findOpenRequest(@Param("attachmentId") UUID attachmentId,
                                                   @Param("requesterId") UUID requesterId,
                                                   @Param("now") Instant now);

    @Query("""
        SELECT r FROM DocumentAccessRequest r
        WHERE r.attachmentId = :attachmentId
          AND r.requesterId = :requesterId
          AND r.status = com.taskoura.entity.AccessRequestStatus.APPROVED
          AND r.accessExpiresAt > :now
    """)
    Optional<DocumentAccessRequest> findActiveGrant(@Param("attachmentId") UUID attachmentId,
                                                   @Param("requesterId") UUID requesterId,
                                                   @Param("now") Instant now);

    @Query("""
        SELECT r FROM DocumentAccessRequest r
        WHERE r.status = com.taskoura.entity.AccessRequestStatus.PENDING
          AND r.expiresAt <= :now
    """)
    List<DocumentAccessRequest> findExpiredRequests(@Param("now") Instant now);

    @Query("""
        SELECT count(r) FROM DocumentAccessRequest r
        WHERE r.attachmentId = :attachmentId
          AND r.requesterId = :requesterId
          AND r.requestedAt >= :since
    """)
    long countRequestsSince(@Param("attachmentId") UUID attachmentId,
                            @Param("requesterId") UUID requesterId,
                            @Param("since") Instant since);

    @Query("""
        SELECT count(r) FROM DocumentAccessRequest r
        WHERE r.attachmentId = :attachmentId
          AND r.requesterId = :requesterId
          AND r.leaderEmailStatus = com.taskoura.entity.LeaderEmailStatus.SENT
          AND r.leaderEmailSentAt >= :since
    """)
    long countSentEmailsSince(@Param("attachmentId") UUID attachmentId,
                              @Param("requesterId") UUID requesterId,
                              @Param("since") Instant since);

    List<DocumentAccessRequest> findByLeaderIdAndStatus(UUID leaderId, AccessRequestStatus status);

    List<DocumentAccessRequest> findByAttachmentIdOrderByRequestedAtDesc(UUID attachmentId);

    Optional<DocumentAccessRequest> findTopByAttachmentIdAndRequesterIdOrderByRequestedAtDesc(UUID attachmentId, UUID requesterId);

    List<DocumentAccessRequest> findByLeaderEmailStatusAndLeaderEmailAttemptsLessThan(com.taskoura.entity.LeaderEmailStatus status, int maxAttempts);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @Query("""
        UPDATE DocumentAccessRequest r
        SET r.status = com.taskoura.entity.AccessRequestStatus.REVOKED
        WHERE r.projectId = :projectId
          AND r.status IN (com.taskoura.entity.AccessRequestStatus.PENDING, com.taskoura.entity.AccessRequestStatus.APPROVED)
    """)
    int revokeOpenRequestsForProject(@Param("projectId") UUID projectId);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @Query("""
        UPDATE DocumentAccessRequest r
        SET r.status = com.taskoura.entity.AccessRequestStatus.REVOKED
        WHERE r.attachmentId = :attachmentId
          AND r.status IN (com.taskoura.entity.AccessRequestStatus.PENDING, com.taskoura.entity.AccessRequestStatus.APPROVED)
    """)
    int revokeOpenRequestsForAttachment(@Param("attachmentId") UUID attachmentId);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @Query("""
        UPDATE DocumentAccessRequest r
        SET r.status = com.taskoura.entity.AccessRequestStatus.REVOKED
        WHERE r.projectId = :projectId
          AND r.requesterId = :requesterId
          AND r.status IN (com.taskoura.entity.AccessRequestStatus.PENDING, com.taskoura.entity.AccessRequestStatus.APPROVED)
    """)
    int revokeOpenRequestsForProjectAndUser(@Param("projectId") UUID projectId, @Param("requesterId") UUID requesterId);
}
