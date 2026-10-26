package com.taskoura.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.config.SecurityConfig;
import com.taskoura.dto.ProfileDtos.*;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
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
                .andExpect(jsonPath("$.verified").value(true))
                .andExpect(jsonPath("$.profile").isMap())
                .andExpect(jsonPath("$.providers").isArray());
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

    @Test
    @DisplayName("PUT /api/users/me/profile: 401 Unauthorized without auth token")
    void updateProfileDetails_unauthenticated_returns401() throws Exception {
        UpdateProfileDetailsRequest req = new UpdateProfileDetailsRequest(
                "+14155552671", "Org", "Dept", "Title", 2024,
                "https://github.com/alex", "https://linkedin.com/in/alex",
                "Bio", List.of("Java"), "UTC", NotificationPrefsDto.defaults()
        );

        mockMvc.perform(put("/api/users/me/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("PUT /api/users/me/profile: 200 OK with updated profile details")
    void updateProfileDetails_authenticated_returns200() throws Exception {
        String token = jwtUtil.generateToken("alex@example.com");
        UUID userId = UUID.randomUUID();
        UpdateProfileDetailsRequest req = new UpdateProfileDetailsRequest(
                "+14155552671", "Org", "Dept", "Title", 2024,
                "https://github.com/alex", "https://linkedin.com/in/alex",
                "Bio", List.of("Java"), "UTC", NotificationPrefsDto.defaults()
        );

        ProfileDataDto data = new ProfileDataDto(
                "+14155552671", false, "Org", "Dept", "Title", 2024,
                "https://github.com/alex", "https://linkedin.com/in/alex",
                "Bio", List.of("Java"), "UTC", null, NotificationPrefsDto.defaults()
        );

        when(userService.updateProfileDetails(eq("alex@example.com"), any(UpdateProfileDetailsRequest.class)))
                .thenReturn(new UserProfileResponse(userId, "Alex Doe", "alex@example.com", true, LocalDateTime.now(), data, Collections.emptyList()));

        mockMvc.perform(put("/api/users/me/profile")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.phone").value("+14155552671"))
                .andExpect(jsonPath("$.profile.organization").value("Org"))
                .andExpect(jsonPath("$.profile.skills[0]").value("Java"));
    }

    @Test
    @DisplayName("POST /api/users/me/avatar: 200 OK with avatarUrl")
    void uploadAvatar_authenticated_returns200() throws Exception {
        String token = jwtUtil.generateToken("alex@example.com");
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", new byte[]{1, 2, 3});

        when(userService.uploadAvatar(eq("alex@example.com"), any()))
                .thenReturn(new AvatarResponse("https://res.cloudinary.com/test/image/upload/v1/avatar.png"));

        mockMvc.perform(multipart("/api/users/me/avatar")
                        .file(file)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value("https://res.cloudinary.com/test/image/upload/v1/avatar.png"));
    }

    @Test
    @DisplayName("DELETE /api/users/me/avatar: 204 No Content")
    void deleteAvatar_authenticated_returns204() throws Exception {
        String token = jwtUtil.generateToken("alex@example.com");
        doNothing().when(userService).deleteAvatar("alex@example.com");

        mockMvc.perform(delete("/api/users/me/avatar")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }
}
