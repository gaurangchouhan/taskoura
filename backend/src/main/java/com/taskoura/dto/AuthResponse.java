package com.taskoura.dto;

public record AuthResponse(String token, UserResponse user, SessionInfoResponse session) {
    public AuthResponse(String token, UserResponse user) {
        this(token, user, null);
    }
}
