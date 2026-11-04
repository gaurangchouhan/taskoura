package com.taskoura.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.config.SecurityConfig;
import com.taskoura.dto.AuthResponse;
import com.taskoura.dto.OAuthDtos.OAuthExchangeRequest;
import com.taskoura.dto.OAuthDtos.OAuthProviderInfo;
import com.taskoura.dto.OAuthDtos.OAuthProvidersResponse;
import com.taskoura.dto.SessionInfoResponse;
import com.taskoura.dto.UserResponse;
import com.taskoura.exception.GlobalExceptionHandler;
import com.taskoura.exception.ValidationException;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.JwtUtil;
import com.taskoura.security.oauth.OAuthExchangeRateLimiter;
import com.taskoura.service.AuthService;
import com.taskoura.service.SessionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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
class OAuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private SessionService sessionService;

    @MockitoBean
    private OAuthExchangeRateLimiter oAuthExchangeRateLimiter;

    @Test
    @DisplayName("GET /api/auth/oauth/providers returns empty list when no providers are configured")
    void testGetProviders_Empty() throws Exception {
        when(authService.getAvailableOAuthProviders())
                .thenReturn(new OAuthProvidersResponse(Collections.emptyList()));

        mockMvc.perform(get("/api/auth/oauth/providers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.providers").isArray())
                .andExpect(jsonPath("$.providers").isEmpty());
    }

    @Test
    @DisplayName("GET /api/auth/oauth/providers returns configured providers with startUrl")
    void testGetProviders_Configured() throws Exception {
        OAuthProviderInfo google = new OAuthProviderInfo("google", "Google", "/oauth2/authorization/google");
        OAuthProviderInfo github = new OAuthProviderInfo("github", "GitHub", "/oauth2/authorization/github");

        when(authService.getAvailableOAuthProviders())
                .thenReturn(new OAuthProvidersResponse(List.of(google, github)));

        mockMvc.perform(get("/api/auth/oauth/providers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.providers.length()").value(2))
                .andExpect(jsonPath("$.providers[0].key").value("google"))
                .andExpect(jsonPath("$.providers[0].label").value("Google"))
                .andExpect(jsonPath("$.providers[0].startUrl").value("/oauth2/authorization/google"))
                .andExpect(jsonPath("$.providers[1].key").value("github"))
                .andExpect(jsonPath("$.providers[1].label").value("GitHub"))
                .andExpect(jsonPath("$.providers[1].startUrl").value("/oauth2/authorization/github"));
    }

    @Test
    @DisplayName("POST /api/auth/oauth/exchange with valid code returns AuthResponse")
    void testExchangeOAuthCode_Success() throws Exception {
        UUID userId = UUID.randomUUID();
        UserResponse user = new UserResponse(userId, "OAuth User", "oauth@example.com");
        SessionInfoResponse sessionInfo = new SessionInfoResponse(3600, 300, Instant.now().plusSeconds(3600).toString(), Instant.now().plusSeconds(86400).toString(), Instant.now().toString());
        AuthResponse response = new AuthResponse("mock.jwt.token", user, sessionInfo);

        when(authService.exchangeOAuthCode(anyString(), any()))
                .thenReturn(response);

        OAuthExchangeRequest request = new OAuthExchangeRequest("valid-raw-code-123");

        mockMvc.perform(post("/api/auth/oauth/exchange")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("mock.jwt.token"))
                .andExpect(jsonPath("$.user.email").value("oauth@example.com"))
                .andExpect(jsonPath("$.session.idleTimeoutSeconds").value(3600));
    }

    @Test
    @DisplayName("POST /api/auth/oauth/exchange with invalid/used code throws 400 VALIDATION_FAILED")
    void testExchangeOAuthCode_InvalidCode() throws Exception {
        when(authService.exchangeOAuthCode(anyString(), any()))
                .thenThrow(new ValidationException("Invalid or expired exchange code",
                        Map.of("code", "Invalid or expired exchange code")));

        OAuthExchangeRequest request = new OAuthExchangeRequest("invalid-or-used-code");

        mockMvc.perform(post("/api/auth/oauth/exchange")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.message").value("Invalid or expired exchange code"));
    }
}
