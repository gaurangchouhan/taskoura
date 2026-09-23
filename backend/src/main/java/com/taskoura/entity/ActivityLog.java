package com.taskoura.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "activity_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ActivityLog {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** e.g. "TASK_CREATED", "TASK_STATUS_CHANGED", "MEMBER_INVITED", "COMMENT_ADDED" */
    @Column(name = "action_type", nullable = false)
    private String actionType;

    @Column(nullable = false)
    private String description;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
