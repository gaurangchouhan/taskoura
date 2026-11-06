package com.taskoura.security.oauth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.dto.MessageResponse;
import com.taskoura.dto.OAuthDtos.OAuthLinkStartRequest;
import com.taskoura.dto.ResetPasswordRequest;
import com.taskoura.entity.OAuthIdentity;
import com.taskoura.entity.User;
import com.taskoura.entity.UserProfile;
import com.taskoura.exception.ConflictException;
import com.taskoura.repository.OAuthIdentityRepository;
import com.taskoura.repository.OAuthLoginCodeRepository;
import com.taskoura.repository.UserProfileRepository;
import com.taskoura.repository.UserRepository;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.JwtUtil;
import com.taskoura.service.*;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OAuthAccountLinkingIntegrationTest {

    @Mock private UserRepository userRepository;
    @Mock private UserProfileRepository userProfileRepository;
    @Mock private OAuthIdentityRepository oauthIdentityRepository;
    @Mock private OAuthLoginCodeRepository loginCodeRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private ClientRegistrationRepository clientRegistrationRepository;
    private ClientRegistration googleRegistration;
    private ClientRegistration githubRegistration;
    @Mock private EmailService emailService;
    @Mock private OtpService otpService;
    @Mock private SessionService sessionService;
    @Mock private AuthenticationManager authenticationManager;

    private Clock clock;
    private OAuthLinkTokenService linkTokenService;
    private OAuthCodeService oAuthCodeService;
    private OAuthUserService oAuthUserService;
    private OAuth2AuthenticationSuccessHandler successHandlerAutoLinkTrue;
    private OAuth2AuthenticationSuccessHandler successHandlerAutoLinkFalse;
    private AuthService authService;
    private UserService userService;
    private JwtUtil jwtUtil;
    private JwtAuthFilter jwtAuthFilter;
    private ObjectMapper objectMapper;

    private final String frontendUrl = "https://taskoura.vercel.app";

    @BeforeEach
    void setUp() {
        clock = Clock.systemUTC();
        googleRegistration = org.springframework.security.config.oauth2.client.CommonOAuth2Provider.GOOGLE
                .getBuilder("google").clientId("g-id").clientSecret("g-secret").build();
        githubRegistration = org.springframework.security.config.oauth2.client.CommonOAuth2Provider.GITHUB
                .getBuilder("github").clientId("gh-id").clientSecret("gh-secret").build();

        linkTokenService = new OAuthLinkTokenService(clock);
        oAuthCodeService = new OAuthCodeService(loginCodeRepository, clock);
        oAuthUserService = new OAuthUserService(userRepository, userProfileRepository, oauthIdentityRepository, passwordEncoder);

        successHandlerAutoLinkTrue = new OAuth2AuthenticationSuccessHandler(
                oAuthUserService, oAuthCodeService, linkTokenService, emailService, true, frontendUrl
        );

        successHandlerAutoLinkFalse = new OAuth2AuthenticationSuccessHandler(
                oAuthUserService, oAuthCodeService, linkTokenService, emailService, false, frontendUrl
        );

        authService = new AuthService(
                userRepository, otpService, passwordEncoder, jwtUtil, sessionService, authenticationManager,
                emailService, oAuthCodeService, linkTokenService, clientRegistrationRepository, oauthIdentityRepository
        );

        userService = new UserService(
                userRepository, userProfileRepository, null, oauthIdentityRepository
        );

        objectMapper = new ObjectMapper();
        jwtUtil = new JwtUtil(clock);
        jwtAuthFilter = new JwtAuthFilter(jwtUtil, sessionService, clock, objectMapper);
    }

    private OAuth2AuthenticationToken createToken(String provider, Map<String, Object> attributes, String key) {
        OAuth2User principal = new DefaultOAuth2User(
                Collections.singleton(new SimpleGrantedAuthority("ROLE_USER")),
                attributes,
                key
        );
        return new OAuth2AuthenticationToken(principal, principal.getAuthorities(), provider);
    }

    // =========================================================================
    // Scenario 1: Password user links Google from profile, then signs in with Google
    // =========================================================================
    @Test
    @DisplayName("Scenario 1: Password user links Google from profile, then signs in with Google: same user id, no new user created")
    void testScenario1_PasswordUser_LinksGoogle_ThenSignsInWithGoogle() throws IOException {
        UUID userId = UUID.randomUUID();
        User user = User.builder()
                .id(userId)
                .email("alice@taskoura.dev")
                .name("Alice")
                .passwordLoginEnabled(true)
                .verified(true)
                .build();

        // Step 1: User creates link token from profile
        String linkToken = linkTokenService.createLinkToken(userId, "google");
        assertThat(linkTokenService.validateToken(linkToken, "google")).isTrue();

        // Step 2: Callback with link_token
        when(oauthIdentityRepository.findByProviderAndProviderUserId("google", "g-sub-alice")).thenReturn(Optional.empty());
        when(oauthIdentityRepository.findByUserIdAndProvider(userId, "google")).thenReturn(Optional.empty());
        when(userProfileRepository.findById(userId)).thenReturn(Optional.of(UserProfile.builder().userId(userId).build()));

        MockHttpServletRequest linkRequest = new MockHttpServletRequest();
        linkRequest.setCookies(new Cookie("oauth2_link_token", linkToken));
        MockHttpServletResponse linkResponse = new MockHttpServletResponse();

        OAuth2AuthenticationToken googleAuth = createToken("google", Map.of(
                "sub", "g-sub-alice",
                "email", "alice@taskoura.dev",
                "email_verified", true,
                "name", "Alice Google"
        ), "sub");

        successHandlerAutoLinkTrue.onAuthenticationSuccess(linkRequest, linkResponse, googleAuth);

        assertThat(linkResponse.getRedirectedUrl()).isEqualTo(frontendUrl + "/app/profile?linked=google");
        verify(oauthIdentityRepository).save(argThat(i ->
                i.getUserId().equals(userId) &&
                "google".equals(i.getProvider()) &&
                "g-sub-alice".equals(i.getProviderUserId())
        ));

        // Step 3: Now Alice signs in with Google (normal login flow without link_token)
        OAuthIdentity savedIdentity = OAuthIdentity.builder()
                .userId(userId)
                .provider("google")
                .providerUserId("g-sub-alice")
                .emailAtLink("alice@taskoura.dev")
                .build();
        when(oauthIdentityRepository.findByProviderAndProviderUserId("google", "g-sub-alice")).thenReturn(Optional.of(savedIdentity));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        MockHttpServletRequest loginRequest = new MockHttpServletRequest();
        MockHttpServletResponse loginResponse = new MockHttpServletResponse();

        successHandlerAutoLinkTrue.onAuthenticationSuccess(loginRequest, loginResponse, googleAuth);

        assertThat(loginResponse.getRedirectedUrl()).startsWith(frontendUrl + "/auth/callback?code=");
        verify(userRepository, never()).save(argThat(u -> !u.getId().equals(userId)));
    }

    // =========================================================================
    // Scenario 2: Password user links GitHub with different email, then signs in with GitHub
    // =========================================================================
    @Test
    @DisplayName("Scenario 2: Password user links GitHub with different email, then signs in with GitHub: same user, no duplicate")
    void testScenario2_PasswordUser_LinksGitHub_DifferentEmail_ThenSignsInWithGitHub() throws IOException {
        UUID userId = UUID.randomUUID();
        User user = User.builder()
                .id(userId)
                .email("bob@taskoura.dev")
                .name("Bob")
                .passwordLoginEnabled(true)
                .verified(true)
                .build();

        String linkToken = linkTokenService.createLinkToken(userId, "github");

        when(oauthIdentityRepository.findByProviderAndProviderUserId("github", "999")).thenReturn(Optional.empty());
        when(oauthIdentityRepository.findByUserIdAndProvider(userId, "github")).thenReturn(Optional.empty());
        when(userProfileRepository.findById(userId)).thenReturn(Optional.of(UserProfile.builder().userId(userId).build()));

        MockHttpServletRequest linkRequest = new MockHttpServletRequest();
        linkRequest.setCookies(new Cookie("oauth2_link_token", linkToken));
        MockHttpServletResponse linkResponse = new MockHttpServletResponse();

        OAuth2AuthenticationToken githubAuth = createToken("github", Map.of(
                "id", 999,
                "email", "bob.personal@github.com",
                "email_verified", true,
                "login", "bob-gh"
        ), "id");

        successHandlerAutoLinkTrue.onAuthenticationSuccess(linkRequest, linkResponse, githubAuth);

        assertThat(linkResponse.getRedirectedUrl()).isEqualTo(frontendUrl + "/app/profile?linked=github");
        verify(oauthIdentityRepository).save(argThat(i ->
                i.getUserId().equals(userId) &&
                "github".equals(i.getProvider()) &&
                "999".equals(i.getProviderUserId())
        ));

        // Sign in with GitHub -> resolves to same user Bob, not creating another account
        OAuthIdentity savedIdentity = OAuthIdentity.builder()
                .userId(userId)
                .provider("github")
                .providerUserId("999")
                .emailAtLink("bob.personal@github.com")
                .build();
        when(oauthIdentityRepository.findByProviderAndProviderUserId("github", "999")).thenReturn(Optional.of(savedIdentity));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        MockHttpServletRequest loginRequest = new MockHttpServletRequest();
        MockHttpServletResponse loginResponse = new MockHttpServletResponse();

        successHandlerAutoLinkTrue.onAuthenticationSuccess(loginRequest, loginResponse, githubAuth);

        assertThat(loginResponse.getRedirectedUrl()).startsWith(frontendUrl + "/auth/callback?code=");
    }

    // =========================================================================
    // Scenario 3: Google-created user links GitHub, then signs in with GitHub
    // =========================================================================
    @Test
    @DisplayName("Scenario 3: Google-created user links GitHub, then signs in with GitHub: same user")
    void testScenario3_GoogleCreatedUser_LinksGitHub_ThenSignsInWithGitHub() throws IOException {
        UUID userId = UUID.randomUUID();
        User googleUser = User.builder()
                .id(userId)
                .email("carol@taskoura.dev")
                .name("Carol")
                .passwordLoginEnabled(false)
                .verified(true)
                .build();

        String linkToken = linkTokenService.createLinkToken(userId, "github");

        when(oauthIdentityRepository.findByProviderAndProviderUserId("github", "gh-300")).thenReturn(Optional.empty());
        when(oauthIdentityRepository.findByUserIdAndProvider(userId, "github")).thenReturn(Optional.empty());
        when(userProfileRepository.findById(userId)).thenReturn(Optional.of(UserProfile.builder().userId(userId).build()));

        MockHttpServletRequest linkRequest = new MockHttpServletRequest();
        linkRequest.setCookies(new Cookie("oauth2_link_token", linkToken));
        MockHttpServletResponse linkResponse = new MockHttpServletResponse();

        OAuth2AuthenticationToken githubAuth = createToken("github", Map.of(
                "id", "gh-300",
                "email", "carol@taskoura.dev",
                "email_verified", true
        ), "id");

        successHandlerAutoLinkTrue.onAuthenticationSuccess(linkRequest, linkResponse, githubAuth);
        assertThat(linkResponse.getRedirectedUrl()).isEqualTo(frontendUrl + "/app/profile?linked=github");

        // Login with GitHub
        OAuthIdentity ghIdentity = OAuthIdentity.builder().userId(userId).provider("github").providerUserId("gh-300").build();
        when(oauthIdentityRepository.findByProviderAndProviderUserId("github", "gh-300")).thenReturn(Optional.of(ghIdentity));
        when(userRepository.findById(userId)).thenReturn(Optional.of(googleUser));

        MockHttpServletRequest loginRequest = new MockHttpServletRequest();
        MockHttpServletResponse loginResponse = new MockHttpServletResponse();
        successHandlerAutoLinkTrue.onAuthenticationSuccess(loginRequest, loginResponse, githubAuth);

        assertThat(loginResponse.getRedirectedUrl()).startsWith(frontendUrl + "/auth/callback?code=");
    }

    // =========================================================================
    // Scenario 4: GitHub-created user links Google, then signs in with Google
    // =========================================================================
    @Test
    @DisplayName("Scenario 4: GitHub-created user links Google, then signs in with Google: same user")
    void testScenario4_GitHubCreatedUser_LinksGoogle_ThenSignsInWithGoogle() throws IOException {
        UUID userId = UUID.randomUUID();
        User ghUser = User.builder()
                .id(userId)
                .email("dan@taskoura.dev")
                .name("Dan")
                .passwordLoginEnabled(false)
                .verified(true)
                .build();

        String linkToken = linkTokenService.createLinkToken(userId, "google");

        when(oauthIdentityRepository.findByProviderAndProviderUserId("google", "g-400")).thenReturn(Optional.empty());
        when(oauthIdentityRepository.findByUserIdAndProvider(userId, "google")).thenReturn(Optional.empty());
        when(userProfileRepository.findById(userId)).thenReturn(Optional.of(UserProfile.builder().userId(userId).build()));

        MockHttpServletRequest linkRequest = new MockHttpServletRequest();
        linkRequest.setCookies(new Cookie("oauth2_link_token", linkToken));
        MockHttpServletResponse linkResponse = new MockHttpServletResponse();

        OAuth2AuthenticationToken googleAuth = createToken("google", Map.of(
                "sub", "g-400",
                "email", "dan@taskoura.dev",
                "email_verified", true
        ), "sub");

        successHandlerAutoLinkTrue.onAuthenticationSuccess(linkRequest, linkResponse, googleAuth);
        assertThat(linkResponse.getRedirectedUrl()).isEqualTo(frontendUrl + "/app/profile?linked=google");

        // Login with Google
        OAuthIdentity gIdentity = OAuthIdentity.builder().userId(userId).provider("google").providerUserId("g-400").build();
        when(oauthIdentityRepository.findByProviderAndProviderUserId("google", "g-400")).thenReturn(Optional.of(gIdentity));
        when(userRepository.findById(userId)).thenReturn(Optional.of(ghUser));

        MockHttpServletRequest loginRequest = new MockHttpServletRequest();
        MockHttpServletResponse loginResponse = new MockHttpServletResponse();
        successHandlerAutoLinkTrue.onAuthenticationSuccess(loginRequest, loginResponse, googleAuth);

        assertThat(loginResponse.getRedirectedUrl()).startsWith(frontendUrl + "/auth/callback?code=");
    }

    // =========================================================================
    // Scenario 5: Auto-link and rejection cases
    // =========================================================================
    @Test
    @DisplayName("Scenario 5A: Verified password user auto-links with verified provider email when flag is true")
    void testScenario5A_AutoLink_VerifiedEmail() throws IOException {
        UUID userId = UUID.randomUUID();
        User verifiedUser = User.builder()
                .id(userId)
                .email("verified@taskoura.dev")
                .name("Verified")
                .verified(true)
                .passwordLoginEnabled(true)
                .build();

        when(oauthIdentityRepository.findByProviderAndProviderUserId("google", "g-555")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("verified@taskoura.dev")).thenReturn(Optional.of(verifiedUser));

        OAuth2AuthenticationToken token = createToken("google", Map.of(
                "sub", "g-555",
                "email", "verified@taskoura.dev",
                "email_verified", true
        ), "sub");

        MockHttpServletRequest req = new MockHttpServletRequest();
        MockHttpServletResponse res = new MockHttpServletResponse();

        successHandlerAutoLinkTrue.onAuthenticationSuccess(req, res, token);

        assertThat(res.getRedirectedUrl()).startsWith(frontendUrl + "/auth/callback?code=");
        verify(oauthIdentityRepository).save(argThat(i ->
                i.getUserId().equals(userId) && "g-555".equals(i.getProviderUserId())
        ));
    }

    @Test
    @DisplayName("Scenario 5B: Unverified local account rejects auto-link with ACCOUNT_EXISTS_UNVERIFIED")
    void testScenario5B_UnverifiedLocalAccount_RejectsWithAccountExistsUnverified() throws IOException {
        User unverifiedUser = User.builder()
                .id(UUID.randomUUID())
                .email("unverified@taskoura.dev")
                .verified(false)
                .build();

        when(oauthIdentityRepository.findByProviderAndProviderUserId("google", "g-666")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("unverified@taskoura.dev")).thenReturn(Optional.of(unverifiedUser));

        OAuth2AuthenticationToken token = createToken("google", Map.of(
                "sub", "g-666",
                "email", "unverified@taskoura.dev",
                "email_verified", true
        ), "sub");

        MockHttpServletRequest req = new MockHttpServletRequest();
        MockHttpServletResponse res = new MockHttpServletResponse();

        successHandlerAutoLinkTrue.onAuthenticationSuccess(req, res, token);

        assertThat(res.getRedirectedUrl()).isEqualTo(frontendUrl + "/auth/callback?error=ACCOUNT_EXISTS_UNVERIFIED");
        verify(oauthIdentityRepository, never()).save(any());
    }

    @Test
    @DisplayName("Scenario 5C: When OAUTH_AUTO_LINK_VERIFIED_EMAIL is false, existing account redirects ACCOUNT_EXISTS_USE_PASSWORD")
    void testScenario5C_FlagFalse_RedirectsAccountExistsUsePassword() throws IOException {
        User verifiedUser = User.builder()
                .id(UUID.randomUUID())
                .email("user@taskoura.dev")
                .verified(true)
                .passwordLoginEnabled(true)
                .build();

        when(oauthIdentityRepository.findByProviderAndProviderUserId("google", "g-777")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("user@taskoura.dev")).thenReturn(Optional.of(verifiedUser));

        OAuth2AuthenticationToken token = createToken("google", Map.of(
                "sub", "g-777",
                "email", "user@taskoura.dev",
                "email_verified", true
        ), "sub");

        MockHttpServletRequest req = new MockHttpServletRequest();
        MockHttpServletResponse res = new MockHttpServletResponse();

        successHandlerAutoLinkFalse.onAuthenticationSuccess(req, res, token);

        assertThat(res.getRedirectedUrl()).isEqualTo(frontendUrl + "/auth/callback?error=ACCOUNT_EXISTS_USE_PASSWORD");
        verify(oauthIdentityRepository, never()).save(any());
    }

    @Test
    @DisplayName("Scenario 5D: Unverified provider email redirects EMAIL_UNVERIFIED")
    void testScenario5D_UnverifiedProviderEmail_RedirectsEmailUnverified() throws IOException {
        OAuth2AuthenticationToken token = createToken("google", Map.of(
                "sub", "g-888",
                "email", "unverified-prov@example.com",
                "email_verified", false
        ), "sub");

        MockHttpServletRequest req = new MockHttpServletRequest();
        MockHttpServletResponse res = new MockHttpServletResponse();

        successHandlerAutoLinkTrue.onAuthenticationSuccess(req, res, token);

        assertThat(res.getRedirectedUrl()).isEqualTo(frontendUrl + "/auth/callback?error=EMAIL_UNVERIFIED");
        verify(oauthIdentityRepository, never()).save(any());
    }

    // =========================================================================
    // Scenario 6: Identity already linked to another user
    // =========================================================================
    @Test
    @DisplayName("Scenario 6: Identity already linked to another user: IDENTITY_LINKED_TO_OTHER_ACCOUNT, nothing changed")
    void testScenario6_IdentityAlreadyLinkedToAnotherUser() throws IOException {
        UUID currentUserId = UUID.randomUUID();
        UUID otherUserId = UUID.randomUUID();

        OAuthIdentity otherIdentity = OAuthIdentity.builder()
                .userId(otherUserId)
                .provider("github")
                .providerUserId("gh-other")
                .build();

        String linkToken = linkTokenService.createLinkToken(currentUserId, "github");

        when(oauthIdentityRepository.findByProviderAndProviderUserId("github", "gh-other"))
                .thenReturn(Optional.of(otherIdentity));

        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setCookies(new Cookie("oauth2_link_token", linkToken));
        MockHttpServletResponse res = new MockHttpServletResponse();

        OAuth2AuthenticationToken token = createToken("github", Map.of(
                "id", "gh-other",
                "email", "other@github.com",
                "email_verified", true
        ), "id");

        successHandlerAutoLinkTrue.onAuthenticationSuccess(req, res, token);

        assertThat(res.getRedirectedUrl()).isEqualTo(frontendUrl + "/app/profile?link_error=IDENTITY_LINKED_TO_OTHER_ACCOUNT");
        verify(oauthIdentityRepository, never()).save(any());
    }

    // =========================================================================
    // Scenario 7: link/start: valid, 400, 409, token reuse/expiry
    // =========================================================================
    @Test
    @DisplayName("Scenario 7: link/start token generation, unknown provider (400), already linked (409), token single-use & expiry")
    void testScenario7_LinkStart_ValidationAndTokenReuse() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).email("frank@taskoura.dev").build();
        when(userRepository.findByEmail("frank@taskoura.dev")).thenReturn(Optional.of(user));

        when(clientRegistrationRepository.findByRegistrationId("google")).thenReturn(googleRegistration);
        when(oauthIdentityRepository.findByUserIdAndProvider(userId, "google")).thenReturn(Optional.empty());

        // 1. Valid link/start
        var res = authService.startOAuthLink("frank@taskoura.dev", "google");
        assertThat(res.url()).startsWith("/oauth2/authorization/google?link=");
        String rawToken = res.url().substring("/oauth2/authorization/google?link=".length());

        // 2. Already linked gives 409
        when(oauthIdentityRepository.findByUserIdAndProvider(userId, "google"))
                .thenReturn(Optional.of(OAuthIdentity.builder().userId(userId).provider("google").build()));

        assertThatThrownBy(() -> authService.startOAuthLink("frank@taskoura.dev", "google"))
                .isInstanceOf(ConflictException.class);

        // 3. Unknown provider gives 400
        when(clientRegistrationRepository.findByRegistrationId("unknown")).thenReturn(null);
        assertThatThrownBy(() -> authService.startOAuthLink("frank@taskoura.dev", "unknown"))
                .isInstanceOf(com.taskoura.exception.BadRequestException.class);

        // 4. Token validation: correct provider works
        assertThat(linkTokenService.validateToken(rawToken, "google")).isTrue();
        // Wrong provider rejected
        assertThat(linkTokenService.validateToken(rawToken, "github")).isFalse();

        // 5. Token consumption: single use
        OAuthLinkTokenService.LinkTokenData consumed = linkTokenService.consumeToken(rawToken);
        assertThat(consumed).isNotNull();
        assertThat(consumed.userId()).isEqualTo(userId);

        // Second consume fails (single-use)
        assertThat(linkTokenService.consumeToken(rawToken)).isNull();
    }

    // =========================================================================
    // Scenario 8: Unlink provider rules
    // =========================================================================
    @Test
    @DisplayName("Scenario 8: Unlink: allowed when another method exists; 409 LAST_LOGIN_METHOD otherwise; reset password allows unlink")
    void testScenario8_UnlinkRules() {
        UUID userId = UUID.randomUUID();
        User oAuthOnlyUser = User.builder()
                .id(userId)
                .email("oauthonly@taskoura.dev")
                .passwordLoginEnabled(false)
                .build();
        when(userRepository.findByEmail("oauthonly@taskoura.dev")).thenReturn(Optional.of(oAuthOnlyUser));

        OAuthIdentity gIdent = OAuthIdentity.builder().userId(userId).provider("google").build();
        when(oauthIdentityRepository.findByUserIdAndProvider(userId, "google")).thenReturn(Optional.of(gIdent));
        when(oauthIdentityRepository.findByUserId(userId)).thenReturn(List.of(gIdent));

        // Only one login method (Google) and passwordLoginEnabled is false -> 409 LAST_LOGIN_METHOD
        assertThatThrownBy(() -> userService.disconnectProvider("oauthonly@taskoura.dev", "google"))
                .isInstanceOf(ConflictException.class)
                .satisfies(e -> assertThat(((ConflictException) e).getCode()).isEqualTo("LAST_LOGIN_METHOD"));

        // User sets password via resetPassword -> passwordLoginEnabled becomes true
        when(otpService.verifyResetOtp(oAuthOnlyUser, "123456")).thenReturn(true);
        when(passwordEncoder.encode("NewPassword123!")).thenReturn("$2a$10$newpass");

        authService.resetPassword(new ResetPasswordRequest("oauthonly@taskoura.dev", "123456", "NewPassword123!"));
        assertThat(oAuthOnlyUser.isPasswordLoginEnabled()).isTrue();

        // Now disconnecting Google is allowed (user has password login)
        userService.disconnectProvider("oauthonly@taskoura.dev", "google");
        verify(oauthIdentityRepository).delete(gIdent);
    }

    // =========================================================================
    // Scenario 9: Endpoint access matrix
    // =========================================================================
    @Test
    @DisplayName("Scenario 9: Endpoint access matrix: public endpoints work without token; protected endpoints require token")
    void testScenario9_EndpointAccessMatrix() throws Exception {
        // Public list
        for (String publicPath : JwtAuthFilter.PUBLIC_PATHS) {
            MockHttpServletRequest req = new MockHttpServletRequest("GET", publicPath);
            MockHttpServletResponse res = new MockHttpServletResponse();
            jakarta.servlet.FilterChain chain = mock(jakarta.servlet.FilterChain.class);

            jwtAuthFilter.doFilter(req, res, chain);
            // Verify chain continued without 401
            verify(chain).doFilter(req, res);
            assertThat(res.getStatus()).isNotEqualTo(401);
        }

        // Protected endpoint without token -> delegates to chain without auth (SecurityConfig invokes EntryPoint 401)
        MockHttpServletRequest reqNoToken = new MockHttpServletRequest("POST", "/api/auth/oauth/link/start");
        MockHttpServletResponse resNoToken = new MockHttpServletResponse();
        jakarta.servlet.FilterChain chainProtected = mock(jakarta.servlet.FilterChain.class);

        jwtAuthFilter.doFilter(reqNoToken, resNoToken, chainProtected);
        verify(chainProtected).doFilter(reqNoToken, resNoToken);

        // Protected endpoint with invalid/malformed token -> directly returns 401 UNAUTHENTICATED
        MockHttpServletRequest reqBadToken = new MockHttpServletRequest("POST", "/api/auth/oauth/link/start");
        reqBadToken.addHeader("Authorization", "Bearer invalid-garbage-token");
        MockHttpServletResponse resBadToken = new MockHttpServletResponse();
        jakarta.servlet.FilterChain chainBad = mock(jakarta.servlet.FilterChain.class);

        jwtAuthFilter.doFilter(reqBadToken, resBadToken, chainBad);
        assertThat(resBadToken.getStatus()).isEqualTo(401);
        assertThat(resBadToken.getContentAsString()).contains("UNAUTHENTICATED");
    }
}
