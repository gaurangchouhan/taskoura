package com.taskoura.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class ProfileDtos {
    public record UpdateProfileRequest(String name) {}
    public record UserProfileResponse(UUID id, String name, String email, boolean verified, LocalDateTime createdAt) {}
}
