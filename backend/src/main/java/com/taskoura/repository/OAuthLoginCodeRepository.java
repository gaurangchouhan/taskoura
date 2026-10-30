package com.taskoura.repository;

import com.taskoura.entity.OAuthLoginCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OAuthLoginCodeRepository extends JpaRepository<OAuthLoginCode, UUID> {

    Optional<OAuthLoginCode> findByHashedCode(String hashedCode);

    void deleteByExpiresAtBefore(Instant now);
}

