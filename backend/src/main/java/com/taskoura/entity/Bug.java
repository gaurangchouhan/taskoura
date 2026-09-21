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
@Table(name = "bugs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Bug {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reported_by", nullable = false)
    private User reportedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to")
    private User assignedTo;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String severity; // Low, Medium, High, Critical

    @Builder.Default
    private String status = "Open"; // Open, Resolved

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime resolvedAt;
}
