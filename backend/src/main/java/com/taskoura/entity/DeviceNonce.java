package com.taskoura.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "device_nonces", uniqueConstraints = {
        @UniqueConstraint(name = "uk_device_nonces_device_nonce", columnNames = {"device_id", "nonce"})
}, indexes = {
        @Index(name = "idx_device_nonces_expires", columnList = "expires_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeviceNonce {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "device_id", nullable = false)
    private UUID deviceId;

    @Column(nullable = false, length = 64)
    private String nonce;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    public DeviceNonce(UUID deviceId, String nonce, Instant expiresAt) {
        this.deviceId = deviceId;
        this.nonce = nonce;
        this.expiresAt = expiresAt;
    }
}
