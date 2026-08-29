package com.taskoura.dto;

public class AuthDtos {

    public record RegisterRequest(String name, String email, String password) {}
    public record LoginRequest(String email, String password) {}
    public record VerifyOtpRequest(String email, String otp) {}
    public record ResendOtpRequest(String email) {}
    public record AuthResponse(String token, String name, String email) {}
    public record MessageResponse(String message) {}
}