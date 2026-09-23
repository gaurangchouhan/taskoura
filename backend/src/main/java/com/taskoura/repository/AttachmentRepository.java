package com.taskoura.repository;

import com.taskoura.entity.Attachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AttachmentRepository extends JpaRepository<Attachment, UUID> {
    List<Attachment> findByTaskIdOrderByUploadedAtAsc(UUID taskId);
    List<Attachment> findByTaskId(UUID taskId);
}
