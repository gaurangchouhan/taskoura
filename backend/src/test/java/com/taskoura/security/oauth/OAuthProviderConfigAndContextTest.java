package com.taskoura.security.oauth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.config.CorsConfig;
import com.taskoura.config.SecurityConfig;
import com.taskoura.controller.AuthController;
import com.taskoura.dto.AuthResponse;
import com.taskoura.dto.LoginRequest;
import com.taskoura.dto.SessionInfoResponse;
import com.taskoura.dto.OAuthDtos.OAuthProvidersResponse;
import com.taskoura.entity.User;
import com.taskoura.entity.UserSession;
import com.taskoura.exception.UnauthorizedException;
import com.taskoura.repository.OAuthIdentityRepository;
import com.taskoura.repository.OAuthLoginCodeRepository;
import com.taskoura.repository.UserProfileRepository;
import com.taskoura.repository.UserRepository;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.JwtUtil;
import com.taskoura.service.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import com.taskoura.security.CustomUserDetailsService;

import java.time.Clock;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

public class OAuthProviderConfigAndContextTest {

    private final OAuth2ClientConfig clientConfig = new OAuth2ClientConfig();

    @Test
    @DisplayName("App boots with no OAuth variables: repository contains 0 registrations")
    void testClientRegistration_NoVariables() {
        ClientRegistrationRepository repo = clientConfig.clientRegistrationRepository("", "", "", "");

        assertThat(repo).isNotNull();
        assertThat(repo).isInstanceOf(DynamicClientRegistrationRepository.class);

        DynamicClientRegistrationRepository dynamicRepo = (DynamicClientRegistrationRepository) repo;
        assertThat(dynamicRepo.getConfiguredProviderKeys()).isEmpty();
        assertThat(dynamicRepo.findByRegistrationId("google")).isNull();
        assertThat(dynamicRepo.findByRegistrationId("github")).isNull();

        // Verify SecurityConfig can be instantiated without crashing
        JwtAuthFilter jwtAuthFilter = mock(JwtAuthFilter.class);
        SecurityConfig securityConfig = new SecurityConfig(jwtAuthFilter, new ObjectMapper(), new CorsConfig().corsConfigurationSource(), "http://localhost:5173");
        assertThat(securityConfig).isNotNull();
    }

    @Test
    @DisplayName("App boots with only Google variables: repository contains only Google")
    void testClientRegistration_OnlyGoogle() {
        ClientRegistrationRepository repo = clientConfig.clientRegistrationRepository("google-client-id-123", "google-client-secret-xyz", "", "");

        assertThat(repo).isNotNull();
        assertThat(repo).isInstanceOf(DynamicClientRegistrationRepository.class);

        DynamicClientRegistrationRepository dynamicRepo = (DynamicClientRegistrationRepository) repo;
        assertThat(dynamicRepo.getConfiguredProviderKeys()).containsExactly("google");
        ClientRegistration google = dynamicRepo.findByRegistrationId("google");
        assertThat(google).isNotNull();
        assertThat(google.getRegistrationId()).isEqualTo("google");
        assertThat(google.getClientId()).isEqualTo("google-client-id-123");
        assertThat(google.getClientSecret()).isEqualTo("google-client-secret-xyz");

        ClientRegistration github = dynamicRepo.findByRegistrationId("github");
        assertThat(github).isNull();
    }

    @Test
    @DisplayName("App boots with both Google and GitHub variables: repository contains both")
    void testClientRegistration_BothProviders() {
        ClientRegistrationRepository repo = clientConfig.clientRegistrationRepository(
                "google-id", "google-secret",
                "github-id", "github-secret"
        );

        assertThat(repo).isNotNull();
        assertThat(repo).isInstanceOf(DynamicClientRegistrationRepository.class);

        DynamicClientRegistrationRepository dynamicRepo = (DynamicClientRegistrationRepository) repo;
        assertThat(dynamicRepo.getConfiguredProviderKeys()).containsExactlyInAnyOrder("google", "github");
        ClientRegistration google = dynamicRepo.findByRegistrationId("google");
        ClientRegistration github = dynamicRepo.findByRegistrationId("github");

        assertThat(google).isNotNull();
        assertThat(google.getRegistrationId()).isEqualTo("google");
        assertThat(google.getClientId()).isEqualTo("google-id");
        assertThat(google.getClientSecret()).isEqualTo("google-secret");
        assertThat(google.getClientAuthenticationMethod()).isEqualTo(org.springframework.security.oauth2.core.ClientAuthenticationMethod.CLIENT_SECRET_BASIC);
        assertThat(google.getAuthorizationGrantType()).isEqualTo(org.springframework.security.oauth2.core.AuthorizationGrantType.AUTHORIZATION_CODE);
        assertThat(google.getRedirectUri()).isEqualTo("{baseUrl}/login/oauth2/code/{registrationId}");
        assertThat(google.getScopes()).containsExactlyInAnyOrder("openid", "profile", "email");
        assertThat(google.getProviderDetails().getAuthorizationUri()).isEqualTo("https://accounts.google.com/o/oauth2/v2/auth");
        assertThat(google.getProviderDetails().getTokenUri()).isEqualTo("https://www.googleapis.com/oauth2/v4/token");

        assertThat(github).isNotNull();
        assertThat(github.getRegistrationId()).isEqualTo("github");
        assertThat(github.getClientId()).isEqualTo("github-id");
        assertThat(github.getClientSecret()).isEqualTo("github-secret");
        assertThat(github.getClientAuthenticationMethod()).isEqualTo(org.springframework.security.oauth2.core.ClientAuthenticationMethod.CLIENT_SECRET_BASIC);
        assertThat(github.getAuthorizationGrantType()).isEqualTo(org.springframework.security.oauth2.core.AuthorizationGrantType.AUTHORIZATION_CODE);
        assertThat(github.getRedirectUri()).isEqualTo("{baseUrl}/login/oauth2/code/{registrationId}");
        assertThat(github.getScopes()).containsExactlyInAnyOrder("read:user", "user:email");
        assertThat(github.getProviderDetails().getAuthorizationUri()).isEqualTo("https://github.com/login/oauth/authorize");
        assertThat(github.getProviderDetails().getTokenUri()).isEqualTo("https://github.com/login/oauth/access_token");
    }

    @Test
    @DisplayName("Blank, whitespace, or partial credentials never reach ClientRegistration")
    void testClientRegistration_BlankOrPartialCredentialsIgnored() {
        ClientRegistrationRepository repo = clientConfig.clientRegistrationRepository(
                "google-id-only", "",
                "", "github-secret-only"
        );

        DynamicClientRegistrationRepository dynamicRepo = (DynamicClientRegistrationRepository) repo;
        assertThat(dynamicRepo.getConfiguredProviderKeys()).isEmpty();
    }

    @Test
    @DisplayName("GET /api/auth/oauth/providers returns only configured providers")
    void testGetProvidersEndpointOutput() {
        UserRepository userRepo = mock(UserRepository.class);
        OtpService otpService = mock(OtpService.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        JwtUtil jwtUtil = mock(JwtUtil.class);
        SessionService sessionService = mock(SessionService.class);
        AuthenticationManager authManager = mock(AuthenticationManager.class);

        // Case 1: Empty repo
        ClientRegistrationRepository emptyRepo = clientConfig.clientRegistrationRepository("", "", "", "");
        AuthService authServiceEmpty = new AuthService(userRepo, otpService, encoder, jwtUtil, sessionService, authManager, null, null, null, emptyRepo);
        OAuthProvidersResponse emptyResp = authServiceEmpty.getAvailableOAuthProviders();
        assertThat(emptyResp.providers()).isEmpty();

        // Case 2: Only Google
        ClientRegistrationRepository googleRepo = clientConfig.clientRegistrationRepository("gid", "gsecret", "", "");
        AuthService authServiceGoogle = new AuthService(userRepo, otpService, encoder, jwtUtil, sessionService, authManager, null, null, null, googleRepo);
        OAuthProvidersResponse googleResp = authServiceGoogle.getAvailableOAuthProviders();
        assertThat(googleResp.providers()).hasSize(1);
        assertThat(googleResp.providers().get(0).key()).isEqualTo("google");
        assertThat(googleResp.providers().get(0).label()).isEqualTo("Google");
        assertThat(googleResp.providers().get(0).startUrl()).isEqualTo("/oauth2/authorization/google");

        // Case 3: Both
        ClientRegistrationRepository bothRepo = clientConfig.clientRegistrationRepository("gid", "gsecret", "ghid", "ghsecret");
        AuthService authServiceBoth = new AuthService(userRepo, otpService, encoder, jwtUtil, sessionService, authManager, null, null, null, bothRepo);
        OAuthProvidersResponse bothResp = authServiceBoth.getAvailableOAuthProviders();
        assertThat(bothResp.providers()).hasSize(2);
        assertThat(bothResp.providers().stream().map(p -> p.key()).toList()).containsExactly("google", "github");
    }

    @Test
    @DisplayName("Password login is refused for OAuth-only accounts (password_login_enabled = false)")
    void testPasswordLoginRefusedForOAuthOnlyAccounts() {
        UserRepository userRepo = mock(UserRepository.class);
        OtpService otpService = mock(OtpService.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        JwtUtil jwtUtil = mock(JwtUtil.class);
        SessionService sessionService = mock(SessionService.class);

        CustomUserDetailsService userDetailsService = new CustomUserDetailsService(userRepo);
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(encoder);
        AuthenticationManager authManager = new ProviderManager(authProvider);

        AuthService authService = new AuthService(userRepo, otpService, encoder, jwtUtil, sessionService, authManager, null, null, null, null);

        User oauthUser = User.builder()
                .id(UUID.randomUUID())
                .name("OAuth User")
                .email("oauth@example.com")
                .passwordHash("$2a$10$unusablehashvaluehere")
                .passwordLoginEnabled(false)
                .verified(true)
                .build();

        when(userRepo.findByEmail("oauth@example.com")).thenReturn(Optional.of(oauthUser));

        assertThatThrownBy(() -> authService.login(new LoginRequest("oauth@example.com", "SomePassword123!")))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Invalid credentials");
    }

    @Test
    @DisplayName("Exchange response and normal login response share the exact same AuthResponse shape")
    void testExchangeAndLoginResponseShapeEqual() {
        UserRepository userRepo = mock(UserRepository.class);
        OtpService otpService = mock(OtpService.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        JwtUtil jwtUtil = mock(JwtUtil.class);
        SessionService sessionService = mock(SessionService.class);
        OAuthCodeService codeService = mock(OAuthCodeService.class);

        UUID userId = UUID.randomUUID();
        User user = User.builder()
                .id(userId)
                .name("Test User")
                .email("test@example.com")
                .passwordHash("hashed")
                .passwordLoginEnabled(true)
                .verified(true)
                .build();

        when(userRepo.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        when(encoder.matches("password", "hashed")).thenReturn(true);

        UserSession mockSession = UserSession.builder()
                .id(UUID.randomUUID())
                .user(user)
                .createdAt(java.time.Instant.now())
                .lastActivityAt(java.time.Instant.now())
                .absoluteExpiresAt(java.time.Instant.now().plusSeconds(3600))
                .build();

        when(sessionService.createSession(eq(user), any())).thenReturn(mockSession);
        when(jwtUtil.generateToken(eq("test@example.com"), eq(mockSession.getId()), any()))
                .thenReturn("mock-jwt-token");

        SessionInfoResponse mockSessionInfo =
                new SessionInfoResponse(60, 0, "exp", "absExp", "serverTime");
        when(sessionService.buildSessionInfo(mockSession)).thenReturn(mockSessionInfo);

        when(codeService.consumeCode("valid-code")).thenReturn(userId);

        AuthenticationManager authManager = mock(AuthenticationManager.class);
        when(authManager.authenticate(any())).thenReturn(new UsernamePasswordAuthenticationToken("test@example.com", "password"));

        AuthService authService = new AuthService(userRepo, otpService, encoder, jwtUtil, sessionService, authManager, null, codeService, null, null);

        // 1. Regular password login
        AuthResponse loginResp = authService.login(new LoginRequest("test@example.com", "password"));

        // 2. OAuth code exchange
        AuthResponse exchangeResp = authService.exchangeOAuthCode("valid-code", null);

        // Both shapes must match exactly
        assertThat(loginResp.token()).isEqualTo(exchangeResp.token());
        assertThat(loginResp.user().id()).isEqualTo(exchangeResp.user().id());
        assertThat(loginResp.user().name()).isEqualTo(exchangeResp.user().name());
        assertThat(loginResp.user().email()).isEqualTo(exchangeResp.user().email());
        assertThat(loginResp.session().serverTime()).isEqualTo(exchangeResp.session().serverTime());
    }
}
