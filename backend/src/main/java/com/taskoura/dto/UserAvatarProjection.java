package com.taskoura.dto;

import java.util.UUID;

/**
 * Targeted projection for user avatar resolution that avoids loading full UserProfile
 * entities, notification preferences, or related element collections.
 */
public interface UserAvatarProjection {
    UUID getUserId();
    String getAvatarUrl();
}
