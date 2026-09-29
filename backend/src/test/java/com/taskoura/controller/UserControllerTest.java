package com.taskoura.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.config.SecurityConfig;
import com.taskoura.dto.ProfileDtos.UpdateProfileRequest;
import com.taskoura.dto.ProfileDtos.UserProfileResponse;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.GlobalExceptionHandler;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.JwtUtil;
import com.taskoura.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(UserController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
    "jwt.secret=taskoura-super-secret-test-jwt-key-256-bits-length!!",
    "jwt.expiration-ms=86400000"
})
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private UserService userService;

    @Test
    @DisplayName("GET /api/users/me: 401 Unauthorized without auth token")
    void getProfile_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/users/me: 200 OK with profile when authenticated")
    void getProfile_authenticated_returns200() throws Exception {
        String token = jwtUtil.generateToken("alex@example.com");
        UUID userId = UUID.randomUUID();
        when(userService.getProfile("alex@example.com"))
                .thenReturn(new UserProfileResponse(userId, "Alex Doe", "alex@example.com", true, LocalDateTime.now()));

        mockMvc.perform(get("/api/users/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(userId.toString()))
                .andExpect(jsonPath("$.name").value("Alex Doe"))
                .andExpect(jsonPath("$.email").value("alex@example.com"))
                .andExpect(jsonPath("$.verified").value(true));
    }

    @Test
    @DisplayName("PUT /api/users/me: 401 Unauthorized without auth token")
    void updateProfile_unauthenticated_returns401() throws Exception {
        UpdateProfileRequest request = new UpdateProfileRequest("New Name");
        mockMvc.perform(put("/api/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("PUT /api/users/me: 200 OK with updated profile when authenticated")
    void updateProfile_authenticated_returns200() throws Exception {
        String token = jwtUtil.generateToken("alex@example.com");
        UUID userId = UUID.randomUUID();
        UpdateProfileRequest request = new UpdateProfileRequest("New Name");
        when(userService.updateProfile(eq("alex@example.com"), any(UpdateProfileRequest.class)))
                .thenReturn(new UserProfileResponse(userId, "New Name", "alex@example.com", true, LocalDateTime.now()));

        mockMvc.perform(put("/api/users/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("New Name"));
    }

    @Test
    @DisplayName("PUT /api/users/me: 400 Bad Request when name is empty")
    void updateProfile_emptyName_returns400() throws Exception {
        String token = jwtUtil.generateToken("alex@example.com");
        UpdateProfileRequest request = new UpdateProfileRequest("");
        when(userService.updateProfile(eq("alex@example.com"), any(UpdateProfileRequest.class)))
                .thenThrow(new BadRequestException("Name cannot be empty"));

        mockMvc.perform(put("/api/users/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Name cannot be empty"));
    }
}
