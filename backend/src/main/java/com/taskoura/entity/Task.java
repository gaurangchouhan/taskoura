package com.taskoura.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "tasks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Task {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to")
    private User assignedTo;

    private String title;
    private String description;
    private String category;   // Frontend, Backend, Database, Testing, Documentation
    private String priority;   // High, Medium, Low

    @Builder.Default
    private String status = "Backlog";  // Backlog, InProgress, Testing, Completed

    private LocalDate deadline;
    private LocalDateTime completedAt;
    private LocalDateTime createdAt = LocalDateTime.now();
}