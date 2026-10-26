package com.taskoura.entity;

import jakarta.persistence.*;
import lombok.*;

import org.springframework.data.domain.Persistable;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "user_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserProfile implements Persistable<UUID> {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Transient
    @Builder.Default
    private boolean isNew = true;

    @Override
    public UUID getId() {
        return userId;
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    @PostLoad
    @PostPersist
    void markNotNew() {
        this.isNew = false;
    }

    @Column(name = "phone", length = 30)
    private String phone;

    @Column(name = "phone_verified", nullable = false)
    @Builder.Default
    private boolean phoneVerified = false;

    @Column(name = "organization", length = 120)
    private String organization;

    @Column(name = "department", length = 120)
    private String department;

    @Column(name = "job_title", length = 120)
    private String jobTitle;

    @Column(name = "graduation_year")
    private Integer graduationYear;

    @Column(name = "github_url", length = 255)
    private String githubUrl;

    @Column(name = "linkedin_url", length = 255)
    private String linkedinUrl;

    @Column(name = "bio", length = 500)
    private String bio;

    @Column(name = "time_zone", length = 100)
    private String timeZone;

    @Column(name = "avatar_url", length = 1000)
    private String avatarUrl;

    // Notification Preferences
    @Column(name = "pref_task_assigned", nullable = false)
    @Builder.Default
    private boolean prefTaskAssigned = true;

    @Column(name = "pref_deadline_reminders", nullable = false)
    @Builder.Default
    private boolean prefDeadlineReminders = true;

    @Column(name = "pref_mentions", nullable = false)
    @Builder.Default
    private boolean prefMentions = true;

    @Column(name = "pref_project_invites", nullable = false)
    @Builder.Default
    private boolean prefProjectInvites = true;

    @Column(name = "pref_status_changes", nullable = false)
    @Builder.Default
    private boolean prefStatusChanges = false;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "user_profile_skills",
            joinColumns = @JoinColumn(name = "user_id")
    )
    @Column(name = "skill", length = 30, nullable = false)
    @OrderColumn(name = "skill_order")
    @Builder.Default
    private List<String> skills = new ArrayList<>();
}
