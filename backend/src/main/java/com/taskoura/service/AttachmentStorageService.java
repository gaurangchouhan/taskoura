package com.taskoura.service;

import org.springframework.web.multipart.MultipartFile;

public interface AttachmentStorageService {

    /**
     * Uploads the file to storage provider and returns the accessible public URL.
     *
     * @param file the multipart file to upload
     * @return file URL
     */
    String uploadFile(MultipartFile file);
}
