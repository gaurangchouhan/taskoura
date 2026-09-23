package com.taskoura.repository;

import com.taskoura.entity.Bug;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BugRepository extends JpaRepository<Bug, UUID> {
    List<Bug> findByTaskId(UUID taskId);
    List<Bug> findByTaskIdOrderByCreatedAtAsc(UUID taskId);
    List<Bug> findByTaskProjectId(UUID projectId);
}
