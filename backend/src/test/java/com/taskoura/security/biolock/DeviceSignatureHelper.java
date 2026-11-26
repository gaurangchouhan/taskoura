package com.taskoura.security.biolock;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Utility test helper for generating device request signatures and proofs.
 */
public class DeviceSignatureHelper {

    private static final String HMAC_SHA256 = "HmacSHA256";

    public static String generateNonce() {
        byte[] bytes = new byte[16];
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    public static String calculateBodySha256(byte[] body) {
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            byte[] hash = sha.digest(body != null ? body : new byte[0]);
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public static String calculateSignature(String deviceKeyHex, String method, String path, String timestamp, String nonce, byte[] body) {
        try {
            String bodyHash = calculateBodySha256(body);
            String payload = method.toUpperCase() + "\n" + path + "\n" + timestamp + "\n" + nonce + "\n" + bodyHash;
            Mac mac = Mac.getInstance(HMAC_SHA256);
            mac.init(new SecretKeySpec(HexFormat.of().parseHex(deviceKeyHex), HMAC_SHA256));
            byte[] sigBytes = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(sigBytes);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public static String calculateProof(String deviceKeyHex, UUID jobId, String challenge, String outcome, Integer slot) {
        try {
            String slotStr = slot != null ? slot.toString() : "";
            String payload = jobId.toString() + "|" + challenge + "|" + outcome + "|" + slotStr;
            Mac mac = Mac.getInstance(HMAC_SHA256);
            mac.init(new SecretKeySpec(HexFormat.of().parseHex(deviceKeyHex), HMAC_SHA256));
            byte[] proofBytes = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(proofBytes);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public static String formatCurl(String baseUrl, UUID deviceId, String deviceKeyHex, String method, String path, String body) {
        String timestamp = String.valueOf(System.currentTimeMillis() / 1000);
        String nonce = generateNonce();
        byte[] bodyBytes = body != null ? body.getBytes(StandardCharsets.UTF_8) : new byte[0];
        String signature = calculateSignature(deviceKeyHex, method, path, timestamp, nonce, bodyBytes);

        StringBuilder sb = new StringBuilder();
        sb.append("curl -X ").append(method.toUpperCase()).append(" \"").append(baseUrl).append(path).append("\" \\\n");
        if (body != null && !body.isBlank()) {
            sb.append("  -H \"Content-Type: application/json\" \\\n");
        }
        sb.append("  -H \"X-Device-Id: ").append(deviceId).append("\" \\\n");
        sb.append("  -H \"X-Timestamp: ").append(timestamp).append("\" \\\n");
        sb.append("  -H \"X-Nonce: ").append(nonce).append("\" \\\n");
        sb.append("  -H \"X-Signature: ").append(signature).append("\"");
        if (body != null && !body.isBlank()) {
            sb.append(" \\\n  -d '").append(body).append("'");
        }
        return sb.toString();
    }
}
