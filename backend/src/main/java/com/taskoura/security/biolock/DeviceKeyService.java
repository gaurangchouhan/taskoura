package com.taskoura.security.biolock;

import com.taskoura.config.BiolockProperties;
import com.taskoura.exception.ServiceUnavailableException;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class DeviceKeyService {

    private static final String HMAC_SHA256 = "HmacSHA256";
    private static final String SHA256 = "SHA-256";

    private final BiolockProperties biolockProperties;

    public DeviceKeyService(BiolockProperties biolockProperties) {
        this.biolockProperties = biolockProperties;
    }

    public boolean isMasterKeyValid() {
        String masterKey = biolockProperties.getDeviceMasterKey();
        if (masterKey == null || masterKey.isBlank()) {
            return false;
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(masterKey.trim());
            return decoded != null && decoded.length == 32;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    public byte[] getMasterKeyBytes() {
        String masterKey = biolockProperties.getDeviceMasterKey();
        if (masterKey == null || masterKey.isBlank()) {
            throw new ServiceUnavailableException("BIOLOCK_NOT_CONFIGURED", "DEVICE_MASTER_KEY is not configured on the server");
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(masterKey.trim());
            if (decoded.length != 32) {
                throw new ServiceUnavailableException("BIOLOCK_NOT_CONFIGURED", "DEVICE_MASTER_KEY must be exactly 32 bytes when decoded");
            }
            return decoded;
        } catch (IllegalArgumentException e) {
            throw new ServiceUnavailableException("BIOLOCK_NOT_CONFIGURED", "DEVICE_MASTER_KEY must be a valid base64 string");
        }
    }

    public byte[] deriveDeviceKeyBytes(UUID deviceId, int keyVersion) {
        byte[] masterKey = getMasterKeyBytes();
        String message = deviceId.toString() + ":" + keyVersion;
        return hmacSha256(masterKey, message.getBytes(StandardCharsets.UTF_8));
    }

    public String deriveDeviceKeyHex(UUID deviceId, int keyVersion) {
        return HexFormat.of().formatHex(deriveDeviceKeyBytes(deviceId, keyVersion));
    }

    public String calculateBodySha256Hex(byte[] body) {
        try {
            MessageDigest digest = MessageDigest.getInstance(SHA256);
            byte[] hash = digest.digest(body != null ? body : new byte[0]);
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }

    public String buildSignaturePayload(String method, String path, String timestamp, String nonce, String bodySha256Hex) {
        return method.toUpperCase() + "\n" + path + "\n" + timestamp + "\n" + nonce + "\n" + bodySha256Hex;
    }

    public String calculateRequestSignature(String deviceKeyHex, String method, String path, String timestamp, String nonce, byte[] body) {
        String bodySha256 = calculateBodySha256Hex(body);
        String payload = buildSignaturePayload(method, path, timestamp, nonce, bodySha256);
        byte[] keyBytes = HexFormat.of().parseHex(deviceKeyHex);
        byte[] signature = hmacSha256(keyBytes, payload.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(signature);
    }

    public String calculateSignatureHex(String deviceKeyHex, String method, String path, String timestamp, String nonce, byte[] body) {
        return calculateRequestSignature(deviceKeyHex, method, path, timestamp, nonce, body);
    }

    public boolean verifyRequestSignature(String deviceKeyHex, String method, String path, String timestamp, String nonce, byte[] body, String providedSignatureHex) {
        if (deviceKeyHex == null || providedSignatureHex == null) {
            return false;
        }
        try {
            String expected = calculateRequestSignature(deviceKeyHex, method, path, timestamp, nonce, body);
            return MessageDigest.isEqual(
                    expected.toLowerCase().getBytes(StandardCharsets.UTF_8),
                    providedSignatureHex.toLowerCase().getBytes(StandardCharsets.UTF_8)
            );
        } catch (Exception e) {
            return false;
        }
    }

    public boolean verifySignature(String deviceKeyHex, String method, String path, String timestamp, String nonce, byte[] body, String providedSignatureHex) {
        return verifyRequestSignature(deviceKeyHex, method, path, timestamp, nonce, body, providedSignatureHex);
    }

    public String calculateProofHex(String deviceKeyHex, UUID jobId, String challenge, String outcome, Integer slot) {
        String slotStr = slot != null ? slot.toString() : "";
        String payload = jobId.toString() + "|" + challenge + "|" + outcome + "|" + slotStr;
        byte[] keyBytes = HexFormat.of().parseHex(deviceKeyHex);
        byte[] proofBytes = hmacSha256(keyBytes, payload.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(proofBytes);
    }

    public boolean verifyProof(String deviceKeyHex, UUID jobId, String challenge, String outcome, Integer slot, String providedProofHex) {
        if (deviceKeyHex == null || providedProofHex == null) {
            return false;
        }
        try {
            String expected = calculateProofHex(deviceKeyHex, jobId, challenge, outcome, slot);
            return MessageDigest.isEqual(
                    expected.toLowerCase().getBytes(StandardCharsets.UTF_8),
                    providedProofHex.toLowerCase().getBytes(StandardCharsets.UTF_8)
            );
        } catch (Exception e) {
            return false;
        }
    }

    public String generateChallenge() {
        byte[] bytes = new byte[32];
        new java.security.SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private byte[] hmacSha256(byte[] key, byte[] data) {
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            SecretKeySpec secretKeySpec = new SecretKeySpec(key, HMAC_SHA256);
            mac.init(secretKeySpec);
            return mac.doFinal(data);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to calculate HMAC-SHA256", e);
        }
    }
}
