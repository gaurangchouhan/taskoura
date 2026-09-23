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
import java.util.Map;

@Service
public class CloudinaryAttachmentStorageService implements AttachmentStorageService {

    private static final Logger log = LoggerFactory.getLogger(CloudinaryAttachmentStorageService.class);

    private final Cloudinary cloudinary;

    @org.springframework.beans.factory.annotation.Autowired
    public CloudinaryAttachmentStorageService(
            @Value("${cloudinary.cloud-name:}") String cloudName,
            @Value("${cloudinary.api-key:}") String apiKey,
            @Value("${cloudinary.api-secret:}") String apiSecret
    ) {
        this.cloudinary = new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudName,
                "api_key", apiKey,
                "api_secret", apiSecret,
                "secure", true
        ));
    }

    public CloudinaryAttachmentStorageService(Cloudinary cloudinary) {
        this.cloudinary = cloudinary;
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
}
