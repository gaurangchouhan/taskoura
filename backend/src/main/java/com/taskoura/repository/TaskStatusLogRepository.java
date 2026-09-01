package com.taskoura.repository;

import com.taskoura.entity.TaskStatusLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TaskStatusLogRepository extends JpaRepository<TaskStatusLog, UUID> {
    List<TaskStatusLog> findByTaskIdOrderByChangedAtAsc(UUID taskId);
}