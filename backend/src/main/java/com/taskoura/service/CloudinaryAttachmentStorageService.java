package com.taskoura.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.taskoura.exception.BadGatewayException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class CloudinaryAttachmentStorageService implements AttachmentStorageService {

    private static final Logger log = LoggerFactory.getLogger(CloudinaryAttachmentStorageService.class);
    private static final Pattern PUBLIC_ID_PATTERN = Pattern.compile("/upload/(?:v\\d+/)?([^/.]+)(?:\\.[a-zA-Z0-9]+)?");

    private final Cloudinary cloudinary;
    private final String cloudName;
    private final String apiKey;
    private final String apiSecret;

    @org.springframework.beans.factory.annotation.Autowired
    public CloudinaryAttachmentStorageService(
            @Value("${cloudinary.cloud-name:}") String cloudName,
            @Value("${cloudinary.api-key:}") String apiKey,
            @Value("${cloudinary.api-secret:}") String apiSecret
    ) {
        this.cloudName = cloudName;
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.cloudinary = new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudName,
                "api_key", apiKey,
                "api_secret", apiSecret,
                "secure", true
        ));
    }

    public CloudinaryAttachmentStorageService(Cloudinary cloudinary) {
        this.cloudinary = cloudinary;
        this.cloudName = "";
        this.apiKey = "";
        this.apiSecret = "";
    }

    @Override
    public String uploadFile(MultipartFile file) {
        try {
            Map<?, ?> uploadResult = cloudinary.uploader().upload(
                    file.getBytes(),
                    ObjectUtils.asMap("resource_type", "auto")
            );
            Object url = uploadResult.get("secure_url");
            if (url == null) {
                url = uploadResult.get("url");
            }
            if (url == null) {
                throw new BadGatewayException("Cloud storage did not return a valid file URL");
            }
            return url.toString();
        } catch (IOException e) {
            log.error("Failed to read file bytes for upload: {}", e.getMessage(), e);
            throw new BadGatewayException("Failed to read file for upload: " + e.getMessage());
        } catch (Exception e) {
            log.error("Failed to upload file to Cloudinary: {}", e.getMessage(), e);
            throw new BadGatewayException("Cloud storage upload failed: " + e.getMessage());
        }
    }

    @Override
    public byte[] downloadFile(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) {
            throw new BadGatewayException("Cannot download attachment: empty file URL");
        }

        // 1. First attempt: Direct HTTP GET from the public URL
        try {
            URL url = new URI(fileUrl).toURL();
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(15000);
            int code = conn.getResponseCode();
            if (code == 200) {
                try (InputStream in = conn.getInputStream()) {
                    return in.readAllBytes();
                }
            }
            log.warn("Direct fileUrl download returned HTTP {}, attempting authenticated Cloudinary download", code);
        } catch (Exception e) {
            log.warn("Direct fileUrl download failed ({}), attempting authenticated Cloudinary download", e.getMessage());
        }

        // 2. Second attempt: Authenticated Cloudinary asset/download API (bypasses CDN ACL/policy blocks)
        try {
            String publicId = extractPublicId(fileUrl);
            if (publicId != null && apiKey != null && !apiKey.isBlank() && apiSecret != null && !apiSecret.isBlank()) {
                String assetId = null;
                try {
                    Map<?, ?> resourceInfo = cloudinary.api().resource(publicId, ObjectUtils.emptyMap());
                    Object aid = resourceInfo.get("asset_id");
                    if (aid != null) {
                        assetId = aid.toString();
                    }
                } catch (Exception e) {
                    log.warn("Cloudinary resource query by publicId '{}' failed: {}", publicId, e.getMessage());
                }

                if (assetId != null) {
                    String endpoint = String.format("https://api.cloudinary.com/v1_1/%s/asset/download?asset_id=%s", cloudName, assetId);
                    URL dlUrl = new URI(endpoint).toURL();
                    HttpURLConnection dlConn = (HttpURLConnection) dlUrl.openConnection();
                    String basicAuth = Base64.getEncoder().encodeToString((apiKey + ":" + apiSecret).getBytes(StandardCharsets.UTF_8));
                    dlConn.setRequestProperty("Authorization", "Basic " + basicAuth);
                    dlConn.setConnectTimeout(5000);
                    dlConn.setReadTimeout(15000);
                    if (dlConn.getResponseCode() == 200) {
                        try (InputStream in = dlConn.getInputStream()) {
                            return in.readAllBytes();
                        }
                    } else {
                        log.warn("Cloudinary asset/download returned HTTP {}", dlConn.getResponseCode());
                    }
                }
            }
        } catch (Exception e) {
            log.error("Authenticated Cloudinary download failed: {}", e.getMessage(), e);
        }

        throw new BadGatewayException("Failed to download attachment from storage. Please verify file URL or storage access.");
    }

    @Override
    public void deleteFile(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) {
            return;
        }
        try {
            String publicId = extractPublicId(fileUrl);
            if (publicId != null) {
                cloudinary.uploader().destroy(publicId, ObjectUtils.emptyMap());
                log.info("Deleted previous Cloudinary asset with publicId: {}", publicId);
            }
        } catch (Exception e) {
            log.warn("Best-effort Cloudinary delete failed for fileUrl {}: {}", fileUrl, e.getMessage());
        }
    }

    private String extractPublicId(String url) {
        if (url == null) return null;
        Matcher m = PUBLIC_ID_PATTERN.matcher(url);
        if (m.find()) {
            return m.group(1);
        }
        return null;
    }
}
