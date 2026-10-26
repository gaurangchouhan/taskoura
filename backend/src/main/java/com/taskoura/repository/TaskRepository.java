package com.taskoura.repository;

import com.taskoura.entity.Task;
import com.taskoura.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface TaskRepository extends JpaRepository<Task, UUID> {
    List<Task> findByProjectId(UUID projectId);
    List<Task> findByParentTaskId(UUID parentTaskId);
    List<Task> findByParentTaskIdOrderByCreatedAtAsc(UUID parentTaskId);
    int countByParentTaskId(UUID parentTaskId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE Task t SET t.deletedAt = :now, t.deletedBy = :actor WHERE t.project.id = :projectId AND t.deletedAt IS NULL")
    int softDeleteAllByProjectId(@Param("projectId") UUID projectId, @Param("actor") User actor, @Param("now") LocalDateTime now);
}