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

    /**
     * Downloads file content bytes given the storage URL.
     *
     * @param fileUrl the file URL
     * @return file bytes
     */
    byte[] downloadFile(String fileUrl);

    /**
     * Deletes a file from storage provider (best-effort).
     *
     * @param fileUrl the file URL
     */
    default void deleteFile(String fileUrl) {}
}
