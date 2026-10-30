package com.taskoura.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "oauth_login_codes",
        indexes = {
                @Index(name = "idx_oauth_login_codes_hashed", columnList = "hashed_code")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OAuthLoginCode {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "hashed_code", nullable = false, unique = true, length = 128)
    private String hashedCode;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;
}

