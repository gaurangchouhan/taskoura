package com.taskoura.repository;

import com.taskoura.entity.Project;
import com.taskoura.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface ProjectRepository extends JpaRepository<Project, UUID> {
    List<Project> findByOwnerId(UUID ownerId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE Project p SET p.deletedAt = :now, p.deletedBy = :actor WHERE p.id = :projectId")
    int softDeleteProject(@Param("projectId") UUID projectId, @Param("actor") User actor, @Param("now") LocalDateTime now);
}