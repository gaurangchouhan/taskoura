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
     * Downloads file content stream given the storage URL without buffering in memory.
     *
     * @param fileUrl the file URL
     * @return input stream of the file content
     */
    default java.io.InputStream downloadFileStream(String fileUrl) {
        return new java.io.ByteArrayInputStream(downloadFile(fileUrl));
    }

    /**
     * Moves an asset to authenticated/restricted delivery mode.
     */
    default String moveToAuthenticatedDelivery(String fileUrl) {
        return fileUrl;
    }

    /**
     * Moves an asset to public delivery mode.
     */
    default String moveToPublicDelivery(String fileUrl) {
        return fileUrl;
    }

    /**
     * Deletes a file from storage provider (best-effort).
     *
     * @param fileUrl the file URL
     */
    default void deleteFile(String fileUrl) {}
}
