package com.taskoura.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.config.SecurityConfig;
import com.taskoura.dto.AuthResponse;
import com.taskoura.dto.LoginRequest;
import com.taskoura.dto.MessageResponse;
import com.taskoura.dto.RegisterRequest;
import com.taskoura.dto.ResendOtpRequest;
import com.taskoura.dto.UserResponse;
import com.taskoura.dto.VerifyOtpRequest;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.ConflictException;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.exception.GlobalExceptionHandler;
import com.taskoura.exception.UnauthorizedException;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.JwtUtil;
import com.taskoura.service.AuthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
    "jwt.secret=taskoura-super-secret-test-jwt-key-256-bits-length!!",
    "jwt.expiration-ms=86400000"
})
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private AuthService authService;

    @Test
    @DisplayName("POST /api/auth/register: 201 Created on valid registration")
    void register_success() throws Exception {
        RegisterRequest request = new RegisterRequest("Alex Doe", "alex@example.com", "Password123!");
        when(authService.register(any())).thenReturn(
                new MessageResponse("OTP sent to email. Please verify to activate your account.")
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").value("OTP sent to email. Please verify to activate your account."));
    }

    @Test
    @DisplayName("POST /api/auth/register: 409 Conflict on duplicate email")
    void register_duplicateEmail_returns409() throws Exception {
        RegisterRequest request = new RegisterRequest("Alex Doe", "alex@example.com", "Password123!");
        when(authService.register(any())).thenThrow(new ConflictException("Email already registered"));

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("Email already registered"));
    }

    @Test
    @DisplayName("POST /api/auth/verify-otp: 200 OK on valid OTP")
    void verifyOtp_success() throws Exception {
        VerifyOtpRequest request = new VerifyOtpRequest("alex@example.com", "1234");
        when(authService.verifyOtp(any())).thenReturn(
                new MessageResponse("Account verified. You can now log in.")
        );

        mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Account verified. You can now log in."));
    }

    @Test
    @DisplayName("POST /api/auth/verify-otp: 400 Bad Request on wrong or expired OTP")
    void verifyOtp_wrongOtp_returns400() throws Exception {
        VerifyOtpRequest request = new VerifyOtpRequest("alex@example.com", "9999");
        when(authService.verifyOtp(any())).thenThrow(new BadRequestException("Invalid or expired OTP"));

        mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Invalid or expired OTP"));
    }

    @Test
    @DisplayName("POST /api/auth/resend-otp: 200 OK")
    void resendOtp_success() throws Exception {
        ResendOtpRequest request = new ResendOtpRequest("alex@example.com");
        when(authService.resendOtp(any())).thenReturn(new MessageResponse("OTP resent"));

        mockMvc.perform(post("/api/auth/resend-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("OTP resent"));
    }

    @Test
    @DisplayName("POST /api/auth/login: 200 OK with JWT token and user details")
    void login_success() throws Exception {
        LoginRequest request = new LoginRequest("alex@example.com", "Password123!");
        UserResponse userResponse = new UserResponse(UUID.randomUUID(), "Alex Doe", "alex@example.com");
        when(authService.login(any())).thenReturn(new AuthResponse("mock.jwt.token", userResponse));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("mock.jwt.token"))
                .andExpect(jsonPath("$.user.email").value("alex@example.com"))
                .andExpect(jsonPath("$.user.name").value("Alex Doe"));
    }

    @Test
    @DisplayName("POST /api/auth/login: 401 Unauthorized on wrong credentials")
    void login_wrongPassword_returns401() throws Exception {
        LoginRequest request = new LoginRequest("alex@example.com", "WrongPassword");
        when(authService.login(any())).thenThrow(new UnauthorizedException("Invalid credentials"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Invalid credentials"));
    }

    @Test
    @DisplayName("POST /api/auth/login: 403 Forbidden when account is unverified")
    void login_unverified_returns403() throws Exception {
        LoginRequest request = new LoginRequest("alex@example.com", "Password123!");
        when(authService.login(any())).thenThrow(new ForbiddenException("Please verify your email before logging in"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.message").value("Please verify your email before logging in"));
    }

    @Test
    @DisplayName("Protected endpoint: 401 when no Authorization header is provided")
    void protectedEndpoint_noToken_returns401() throws Exception {
        mockMvc.perform(get("/api/projects"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Protected endpoint: 401 when garbage/invalid token is provided")
    void protectedEndpoint_garbageToken_returns401() throws Exception {
        mockMvc.perform(get("/api/projects")
                        .header("Authorization", "Bearer invalid.garbage.jwt.token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Protected endpoint: authenticated when valid JWT token is provided")
    void protectedEndpoint_validToken_passesSecurity() throws Exception {
        String validToken = jwtUtil.generateToken("alex@example.com");

        // The request passes Spring Security authentication and reaches the dispatcher (which returns 404 because ProjectController is not in this @WebMvcTest slice)
        mockMvc.perform(get("/api/projects")
                        .header("Authorization", "Bearer " + validToken))
                .andExpect(status().isNotFound());
    }
}
