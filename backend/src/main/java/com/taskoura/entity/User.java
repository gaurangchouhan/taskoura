package com.taskoura.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue
    private UUID id;

    private String name;

    @Column(unique = true, nullable = false)
    private String email;

    private String passwordHash;

    @Builder.Default
    @Column(name = "password_login_enabled", nullable = false, columnDefinition = "boolean default true")
    private boolean passwordLoginEnabled = true;

    @Builder.Default
    private boolean verified = false;

    private String otpCode;

    private LocalDateTime otpExpiresAt;

    @Builder.Default
    @Column(name = "otp_attempts", nullable = false, columnDefinition = "integer default 0")
    private int otpAttempts = 0;

    @Column(name = "otp_last_sent_at")
    private LocalDateTime otpLastSentAt;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    private String resetOtpCode;

    private LocalDateTime resetOtpExpiresAt;

    @Builder.Default
    @Column(name = "reset_otp_attempts", nullable = false, columnDefinition = "integer default 0")
    private int resetOtpAttempts = 0;

    @Column(name = "reset_otp_last_sent_at")
    private LocalDateTime resetOtpLastSentAt;
}