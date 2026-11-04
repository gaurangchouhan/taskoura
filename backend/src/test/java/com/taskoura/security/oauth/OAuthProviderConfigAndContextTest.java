package com.taskoura.security.oauth;

import com.taskoura.config.ClockConfig;
import com.taskoura.config.PasswordEncoderConfig;
import com.taskoura.config.SecurityConfig;
import com.taskoura.controller.AuthController;
import com.taskoura.dto.AuthResponse;
import com.taskoura.dto.LoginRequest;
import com.taskoura.dto.SessionInfoResponse;
import com.taskoura.dto.OAuthDtos.OAuthProvidersResponse;
import com.taskoura.entity.User;
import com.taskoura.entity.UserSession;
import com.taskoura.exception.GlobalExceptionHandler;
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
<<<<<<< HEAD
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import com.taskoura.security.CustomUserDetailsService;
=======
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
>>>>>>> origin/main

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
        assertThat(repo.findByRegistrationId("google")).isNull();
        assertThat(repo.findByRegistrationId("github")).isNull();

        if (repo instanceof DynamicClientRegistrationRepository dynamicRepo) {
            assertThat(dynamicRepo.getConfiguredProviderKeys()).isEmpty();
        }
    }

    @Test
    @DisplayName("App boots with only Google variables: repository contains only Google")
    void testClientRegistration_OnlyGoogle() {
        ClientRegistrationRepository repo = clientConfig.clientRegistrationRepository(
                "google-client-id-123",
                "google-client-secret-xyz",
                "",
                ""
        );

        assertThat(repo).isNotNull();
        ClientRegistration google = repo.findByRegistrationId("google");
        assertThat(google).isNotNull();
        assertThat(google.getClientId()).isEqualTo("google-client-id-123");
        assertThat(google.getScopes()).containsExactlyInAnyOrder("openid", "profile", "email");
        assertThat(repo.findByRegistrationId("github")).isNull();

        if (repo instanceof DynamicClientRegistrationRepository dynamicRepo) {
            assertThat(dynamicRepo.getConfiguredProviderKeys()).containsExactly("google");
        }
    }

    @Test
    @DisplayName("App boots with both Google and GitHub variables: repository contains both")
    void testClientRegistration_BothProviders() {
        ClientRegistrationRepository repo = clientConfig.clientRegistrationRepository(
                "google-id",
                "google-secret",
                "github-id",
                "github-secret"
        );

        assertThat(repo).isNotNull();
        ClientRegistration google = repo.findByRegistrationId("google");
        assertThat(google).isNotNull();
        assertThat(google.getClientId()).isEqualTo("google-id");

        ClientRegistration github = repo.findByRegistrationId("github");
        assertThat(github).isNotNull();
        assertThat(github.getClientId()).isEqualTo("github-id");
        assertThat(github.getScopes()).containsExactlyInAnyOrder("read:user", "user:email");

        if (repo instanceof DynamicClientRegistrationRepository dynamicRepo) {
            assertThat(dynamicRepo.getConfiguredProviderKeys()).containsExactlyInAnyOrder("google", "github");
        }
    }

    @Test
    @DisplayName("Blank, whitespace, or partial credentials never reach ClientRegistration")
    void testClientRegistration_BlankOrPartialCredentialsIgnored() {
        // Only Google ID without secret, GitHub secret without ID
        ClientRegistrationRepository repo = clientConfig.clientRegistrationRepository(
                "google-id-only",
                "   ",
                "   ",
                "github-secret-only"
        );

        assertThat(repo).isNotNull();
        assertThat(repo.findByRegistrationId("google")).isNull();
        assertThat(repo.findByRegistrationId("github")).isNull();

        if (repo instanceof DynamicClientRegistrationRepository dynamicRepo) {
            assertThat(dynamicRepo.getConfiguredProviderKeys()).isEmpty();
        }
    }

    @Test
    @DisplayName("Providers endpoint lists ONLY configured providers")
    void testGetAvailableOAuthProviders() {
        UserRepository userRepo = mock(UserRepository.class);
        OtpService otpService = mock(OtpService.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        JwtUtil jwtUtil = mock(JwtUtil.class);
        SessionService sessionService = mock(SessionService.class);
<<<<<<< HEAD
        AuthenticationManager authManager = mock(AuthenticationManager.class);

        // Case 1: Empty repo
        ClientRegistrationRepository emptyRepo = clientConfig.clientRegistrationRepository("", "", "", "");
        AuthService authServiceEmpty = new AuthService(userRepo, otpService, encoder, jwtUtil, sessionService, authManager, null, null, null, emptyRepo);
=======

        // Case 1: Empty repo
        ClientRegistrationRepository emptyRepo = clientConfig.clientRegistrationRepository("", "", "", "");
        AuthService authServiceEmpty = new AuthService(userRepo, otpService, encoder, jwtUtil, sessionService, null, null, null, emptyRepo);
>>>>>>> origin/main
        OAuthProvidersResponse emptyResp = authServiceEmpty.getAvailableOAuthProviders();
        assertThat(emptyResp.providers()).isEmpty();

        // Case 2: Only Google
        ClientRegistrationRepository googleRepo = clientConfig.clientRegistrationRepository("gid", "gsecret", "", "");
<<<<<<< HEAD
        AuthService authServiceGoogle = new AuthService(userRepo, otpService, encoder, jwtUtil, sessionService, authManager, null, null, null, googleRepo);
=======
        AuthService authServiceGoogle = new AuthService(userRepo, otpService, encoder, jwtUtil, sessionService, null, null, null, googleRepo);
>>>>>>> origin/main
        OAuthProvidersResponse googleResp = authServiceGoogle.getAvailableOAuthProviders();
        assertThat(googleResp.providers()).hasSize(1);
        assertThat(googleResp.providers().get(0).key()).isEqualTo("google");
        assertThat(googleResp.providers().get(0).label()).isEqualTo("Google");
        assertThat(googleResp.providers().get(0).startUrl()).isEqualTo("/oauth2/authorization/google");

        // Case 3: Both
        ClientRegistrationRepository bothRepo = clientConfig.clientRegistrationRepository("gid", "gsecret", "ghid", "ghsecret");
<<<<<<< HEAD
        AuthService authServiceBoth = new AuthService(userRepo, otpService, encoder, jwtUtil, sessionService, authManager, null, null, null, bothRepo);
=======
        AuthService authServiceBoth = new AuthService(userRepo, otpService, encoder, jwtUtil, sessionService, null, null, null, bothRepo);
>>>>>>> origin/main
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

<<<<<<< HEAD
        CustomUserDetailsService userDetailsService = new CustomUserDetailsService(userRepo);
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(encoder);
        AuthenticationManager authManager = new ProviderManager(authProvider);

        AuthService authService = new AuthService(userRepo, otpService, encoder, jwtUtil, sessionService, authManager, null, null, null, null);
=======
        AuthService authService = new AuthService(userRepo, otpService, encoder, jwtUtil, sessionService, null, null, null, null);
>>>>>>> origin/main

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

<<<<<<< HEAD
        AuthenticationManager authManager = mock(AuthenticationManager.class);
        when(authManager.authenticate(any())).thenReturn(new UsernamePasswordAuthenticationToken("test@example.com", "password"));

        AuthService authService = new AuthService(userRepo, otpService, encoder, jwtUtil, sessionService, authManager, null, codeService, null, null);
=======
        AuthService authService = new AuthService(userRepo, otpService, encoder, jwtUtil, sessionService, null, codeService, null, null);
>>>>>>> origin/main

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
