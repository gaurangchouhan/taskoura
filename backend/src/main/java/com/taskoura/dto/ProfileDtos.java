package com.taskoura.dto;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

public class ProfileDtos {

    public record NotificationPrefsDto(
            boolean taskAssigned,
            boolean deadlineReminders,
            boolean mentions,
            boolean projectInvites,
            boolean statusChanges
    ) {
        public static NotificationPrefsDto defaults() {
            return new NotificationPrefsDto(true, true, true, true, false);
        }
    }

    public record ProfileDataDto(
            String phone,
            boolean phoneVerified,
            String organization,
            String department,
            String jobTitle,
            Integer graduationYear,
            String githubUrl,
            String linkedinUrl,
            String bio,
            List<String> skills,
            String timeZone,
            String avatarUrl,
            NotificationPrefsDto notificationPrefs
    ) {
        public static ProfileDataDto defaults() {
            return new ProfileDataDto(
                    null,
                    false,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    Collections.emptyList(),
                    null,
                    null,
                    NotificationPrefsDto.defaults()
            );
        }
    }

    public record UpdateProfileDetailsRequest(
            String phone,
            String organization,
            String department,
            String jobTitle,
            Integer graduationYear,
            String githubUrl,
            String linkedinUrl,
            String bio,
            List<String> skills,
            String timeZone,
            NotificationPrefsDto notificationPrefs
    ) {}

    public record AvatarResponse(String avatarUrl) {}

    public record UpdateProfileRequest(String name) {}

    public record UserProfileResponse(
            UUID id,
            String name,
            String email,
            boolean verified,
            LocalDateTime createdAt,
            ProfileDataDto profile,
            List<String> providers
    ) {
        // Backward-compatible constructor for existing tests and code
        public UserProfileResponse(UUID id, String name, String email, boolean verified, LocalDateTime createdAt) {
            this(id, name, email, verified, createdAt, ProfileDataDto.defaults(), Collections.emptyList());
        }
    }
}
