package com.taskoura.security.oauth;

import com.taskoura.entity.OAuthIdentity;
import com.taskoura.entity.OAuthLoginCode;
import com.taskoura.entity.User;
import com.taskoura.entity.UserProfile;
import com.taskoura.exception.RateLimitedException;
import com.taskoura.exception.ValidationException;
import com.taskoura.repository.OAuthIdentityRepository;
import com.taskoura.repository.OAuthLoginCodeRepository;
import com.taskoura.repository.UserProfileRepository;
import com.taskoura.repository.UserRepository;
import com.taskoura.service.OAuthCodeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OAuth2FlowTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserProfileRepository userProfileRepository;

    @Mock
    private OAuthIdentityRepository oauthIdentityRepository;

    @Mock
    private OAuthLoginCodeRepository loginCodeRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private OAuthLinkTokenService linkTokenService;

    private OAuthCodeService oAuthCodeService;
    private OAuth2AuthenticationSuccessHandler successHandler;
    private OAuth2AuthenticationFailureHandler failureHandler;
    private OAuthExchangeRateLimiter rateLimiter;

    private final String frontendUrl = "https://taskoura.vercel.app";

    @BeforeEach
    void setUp() {
        oAuthCodeService = new OAuthCodeService(loginCodeRepository, Clock.systemUTC());
        successHandler = new OAuth2AuthenticationSuccessHandler(
                userRepository,
                userProfileRepository,
                oauthIdentityRepository,
                oAuthCodeService,
                passwordEncoder,
                linkTokenService,
                frontendUrl
        );
        failureHandler = new OAuth2AuthenticationFailureHandler(frontendUrl);
        rateLimiter = new OAuthExchangeRateLimiter(Clock.systemUTC(), 3, 60);
    }

    private OAuth2AuthenticationToken createAuthToken(String registrationId, Map<String, Object> attributes, String nameAttributeKey) {
        OAuth2User user = new DefaultOAuth2User(
                Collections.singleton(new SimpleGrantedAuthority("ROLE_USER")),
                attributes,
                nameAttributeKey
        );
        return new OAuth2AuthenticationToken(user, user.getAuthorities(), registrationId);
    }

    // -------------------------------------------------------------------------
    // 1. Success Handler Tests
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Case (a): Existing OAuth identity logs in user and redirects with code")
    void testSuccessHandler_CaseA_ExistingIdentity() throws IOException {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).email("googleuser@example.com").name("Google User").build();
        OAuthIdentity identity = OAuthIdentity.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .provider("google")
                .providerUserId("g-sub-123")
                .emailAtLink("googleuser@example.com")
                .build();

        when(oauthIdentityRepository.findByProviderAndProviderUserId("google", "g-sub-123"))
                .thenReturn(Optional.of(identity));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        Map<String, Object> attrs = Map.of(
                "sub", "g-sub-123",
                "email", "googleuser@example.com",
                "email_verified", true,
                "name", "Google User"
        );
        OAuth2AuthenticationToken token = createAuthToken("google", attrs, "sub");

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        successHandler.onAuthenticationSuccess(request, response, token);

        assertThat(response.getRedirectedUrl()).startsWith("https://taskoura.vercel.app/auth/callback?code=");
        verify(loginCodeRepository, times(1)).save(any(OAuthLoginCode.class));
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    @DisplayName("Case (b): New user with no existing account creates user, identity, profile and redirects with code")
    void testSuccessHandler_CaseB_NewUserCreation() throws IOException {
        UUID newUserId = UUID.randomUUID();
        when(oauthIdentityRepository.findByProviderAndProviderUserId("github", "123456"))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmail("octocat@github.com")).thenReturn(Optional.empty());

        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId(newUserId);
            return u;
        });

        Map<String, Object> attrs = Map.of(
                "id", 123456,
                "email", "octocat@github.com",
                "email_verified", true,
                "name", "The Octocat",
                "avatar_url", "https://avatars.githubusercontent.com/u/123456",
                "html_url", "https://github.com/octocat"
        );
        OAuth2AuthenticationToken token = createAuthToken("github", attrs, "id");

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        successHandler.onAuthenticationSuccess(request, response, token);

        assertThat(response.getRedirectedUrl()).startsWith("https://taskoura.vercel.app/auth/callback?code=");

        // Verify User properties: verified=true, passwordLoginEnabled=false
        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User createdUser = userCaptor.getValue();
        assertThat(createdUser.getEmail()).isEqualTo("octocat@github.com");
        assertThat(createdUser.getName()).isEqualTo("The Octocat");
        assertThat(createdUser.isVerified()).isTrue();
        assertThat(createdUser.isPasswordLoginEnabled()).isFalse();
        assertThat(createdUser.getPasswordHash()).isNull();

        // Verify OAuthIdentity created
        ArgumentCaptor<OAuthIdentity> identityCaptor = ArgumentCaptor.forClass(OAuthIdentity.class);
        verify(oauthIdentityRepository).save(identityCaptor.capture());
        OAuthIdentity createdIdentity = identityCaptor.getValue();
        assertThat(createdIdentity.getUserId()).isEqualTo(newUserId);
        assertThat(createdIdentity.getProvider()).isEqualTo("github");
        assertThat(createdIdentity.getProviderUserId()).isEqualTo("123456");

        // Verify UserProfile created with avatarUrl and githubUrl
        ArgumentCaptor<UserProfile> profileCaptor = ArgumentCaptor.forClass(UserProfile.class);
        verify(userProfileRepository).save(profileCaptor.capture());
        UserProfile createdProfile = profileCaptor.getValue();
        assertThat(createdProfile.getAvatarUrl()).isEqualTo("https://avatars.githubusercontent.com/u/123456");
        assertThat(createdProfile.getGithubUrl()).isEqualTo("https://github.com/octocat");
    }

    @Test
    @DisplayName("Case (c): Existing Taskoura account with same email rejects linking and redirects ACCOUNT_EXISTS_USE_PASSWORD")
    void testSuccessHandler_CaseC_AccountExistsWithPassword() throws IOException {
        when(oauthIdentityRepository.findByProviderAndProviderUserId("google", "sub-999"))
                .thenReturn(Optional.empty());
        User existingUser = User.builder().id(UUID.randomUUID()).email("existing@taskoura.dev").name("Existing").build();
        when(userRepository.findByEmail("existing@taskoura.dev")).thenReturn(Optional.of(existingUser));

        Map<String, Object> attrs = Map.of(
                "sub", "sub-999",
                "email", "existing@taskoura.dev",
                "email_verified", true,
                "name", "Existing User"
        );
        OAuth2AuthenticationToken token = createAuthToken("google", attrs, "sub");

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        successHandler.onAuthenticationSuccess(request, response, token);

        assertThat(response.getRedirectedUrl()).isEqualTo("https://taskoura.vercel.app/auth/callback?error=ACCOUNT_EXISTS_USE_PASSWORD");
        verify(oauthIdentityRepository, never()).save(any());
        verify(loginCodeRepository, never()).save(any());
    }

    @Test
    @DisplayName("Missing email redirects EMAIL_MISSING")
    void testSuccessHandler_MissingEmail() throws IOException {
        Map<String, Object> attrs = Map.of(
                "sub", "sub-no-email",
                "email_verified", true,
                "name", "No Email"
        );
        OAuth2AuthenticationToken token = createAuthToken("google", attrs, "sub");

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        successHandler.onAuthenticationSuccess(request, response, token);

        assertThat(response.getRedirectedUrl()).isEqualTo("https://taskoura.vercel.app/auth/callback?error=EMAIL_MISSING");
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Unverified email redirects EMAIL_UNVERIFIED")
    void testSuccessHandler_UnverifiedEmail() throws IOException {
        Map<String, Object> attrs = Map.of(
                "sub", "sub-unverified",
                "email", "unverified@example.com",
                "email_verified", false,
                "name", "Unverified User"
        );
        OAuth2AuthenticationToken token = createAuthToken("google", attrs, "sub");

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        successHandler.onAuthenticationSuccess(request, response, token);

        assertThat(response.getRedirectedUrl()).isEqualTo("https://taskoura.vercel.app/auth/callback?error=EMAIL_UNVERIFIED");
        verify(userRepository, never()).save(any());
    }

    // -------------------------------------------------------------------------
    // 2. Failure Handler Tests
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Failure handler maps access_denied to ACCESS_DENIED")
    void testFailureHandler_AccessDenied() throws IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setParameter("error", "access_denied");
        MockHttpServletResponse response = new MockHttpServletResponse();

        OAuth2AuthenticationException ex = new OAuth2AuthenticationException(new OAuth2Error("access_denied", "User denied access", null));

        failureHandler.onAuthenticationFailure(request, response, ex);

        assertThat(response.getRedirectedUrl()).isEqualTo("https://taskoura.vercel.app/auth/callback?error=ACCESS_DENIED");
    }

    @Test
    @DisplayName("Failure handler maps invalid_state to STATE_INVALID")
    void testFailureHandler_StateInvalid() throws IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        OAuth2AuthenticationException ex = new OAuth2AuthenticationException(new OAuth2Error("invalid_state", "Invalid state token", null));

        failureHandler.onAuthenticationFailure(request, response, ex);

        assertThat(response.getRedirectedUrl()).isEqualTo("https://taskoura.vercel.app/auth/callback?error=STATE_INVALID");
    }

    @Test
    @DisplayName("Failure handler maps provider disabled to PROVIDER_DISABLED")
    void testFailureHandler_ProviderDisabled() throws IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        OAuth2AuthenticationException ex = new OAuth2AuthenticationException(new OAuth2Error("PROVIDER_DISABLED", "Provider disabled", null));

        failureHandler.onAuthenticationFailure(request, response, ex);

        assertThat(response.getRedirectedUrl()).isEqualTo("https://taskoura.vercel.app/auth/callback?error=PROVIDER_DISABLED");
    }

    @Test
    @DisplayName("Failure handler falls back to PROVIDER_ERROR for other errors")
    void testFailureHandler_ProviderError() throws IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        BadCredentialsException ex = new BadCredentialsException("Network timeout contacting auth server");

        failureHandler.onAuthenticationFailure(request, response, ex);

        assertThat(response.getRedirectedUrl()).isEqualTo("https://taskoura.vercel.app/auth/callback?error=PROVIDER_ERROR");
    }

    // -------------------------------------------------------------------------
    // 3. Single-Use Code Service Tests
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Code is single-use: second consumption throws ValidationException")
    void testCodeService_SingleUse() {
        UUID userId = UUID.randomUUID();

        ArgumentCaptor<OAuthLoginCode> captor = ArgumentCaptor.forClass(OAuthLoginCode.class);
        when(loginCodeRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        String rawCode = oAuthCodeService.generateAndSaveCode(userId);
        OAuthLoginCode saved = captor.getValue();

        when(loginCodeRepository.findByHashedCode(OAuthCodeService.hash(rawCode)))
                .thenReturn(Optional.of(saved));

        // First consume succeeds
        UUID consumed = oAuthCodeService.consumeCode(rawCode);
        assertThat(consumed).isEqualTo(userId);
        assertThat(saved.getUsedAt()).isNotNull();

        // Second consume fails because usedAt is now set
        assertThatThrownBy(() -> oAuthCodeService.consumeCode(rawCode))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    @DisplayName("Expired code throws ValidationException")
    void testCodeService_Expired() {
        UUID userId = UUID.randomUUID();
        Instant past = Instant.now().minusSeconds(10);
        String rawCode = "expired-code";

        OAuthLoginCode expiredCode = OAuthLoginCode.builder()
                .userId(userId)
                .hashedCode(OAuthCodeService.hash(rawCode))
                .expiresAt(past)
                .usedAt(null)
                .build();

        when(loginCodeRepository.findByHashedCode(OAuthCodeService.hash(rawCode)))
                .thenReturn(Optional.of(expiredCode));

        assertThatThrownBy(() -> oAuthCodeService.consumeCode(rawCode))
                .isInstanceOf(ValidationException.class);
    }

    // -------------------------------------------------------------------------
    // 4. Rate Limiter Tests
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Rate limiter throws RateLimitedException after exceeding allowed attempts")
    void testRateLimiter_ExceedsLimit() {
        String ip = "192.168.1.100";
        rateLimiter.checkRateLimit(ip);
        rateLimiter.checkRateLimit(ip);
        rateLimiter.checkRateLimit(ip);

        assertThatThrownBy(() -> rateLimiter.checkRateLimit(ip))
                .isInstanceOf(RateLimitedException.class);
    }

    // -------------------------------------------------------------------------
    // 5. Account Linking Tests
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Linking account: successfully links and redirects with ?linked=google")
    void testLinkAccount_Success() throws IOException {
        UUID userId = UUID.randomUUID();

        when(linkTokenService.validateAndConsumeLinkToken("valid-link-token"))
                .thenReturn(new OAuthLinkTokenService.LinkTokenData(userId, "google", Instant.now().plusSeconds(300)));
        when(oauthIdentityRepository.findByProviderAndProviderUserId("google", "g-999"))
                .thenReturn(Optional.empty());
        when(oauthIdentityRepository.findByUserIdAndProvider(userId, "google"))
                .thenReturn(Optional.empty());

        Map<String, Object> attrs = Map.of(
                "sub", "g-999",
                "email", "user@example.com",
                "email_verified", true,
                "name", "User"
        );
        OAuth2AuthenticationToken token = createAuthToken("google", attrs, "sub");

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new jakarta.servlet.http.Cookie("oauth2_link_token", "valid-link-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        successHandler.onAuthenticationSuccess(request, response, token);

        assertThat(response.getRedirectedUrl()).isEqualTo("https://taskoura.vercel.app/app/profile?linked=google");
        verify(oauthIdentityRepository).save(any(OAuthIdentity.class));
    }

    @Test
    @DisplayName("Linking account: already linked to another user redirects with ?link_error=IDENTITY_LINKED_TO_OTHER_ACCOUNT")
    void testLinkAccount_LinkedToOtherAccount() throws IOException {
        UUID currentUserId = UUID.randomUUID();
        UUID otherUserId = UUID.randomUUID();
        OAuthIdentity otherIdentity = OAuthIdentity.builder()
                .userId(otherUserId)
                .provider("google")
                .providerUserId("g-999")
                .build();

        when(linkTokenService.validateAndConsumeLinkToken("valid-link-token"))
                .thenReturn(new OAuthLinkTokenService.LinkTokenData(currentUserId, "google", Instant.now().plusSeconds(300)));
        when(oauthIdentityRepository.findByProviderAndProviderUserId("google", "g-999"))
                .thenReturn(Optional.of(otherIdentity));

        Map<String, Object> attrs = Map.of(
                "sub", "g-999",
                "email", "other@example.com",
                "email_verified", true,
                "name", "Other"
        );
        OAuth2AuthenticationToken token = createAuthToken("google", attrs, "sub");

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new jakarta.servlet.http.Cookie("oauth2_link_token", "valid-link-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        successHandler.onAuthenticationSuccess(request, response, token);

        assertThat(response.getRedirectedUrl()).isEqualTo("https://taskoura.vercel.app/app/profile?link_error=IDENTITY_LINKED_TO_OTHER_ACCOUNT");
        verify(oauthIdentityRepository, never()).save(any());
    }

    @Test
    @DisplayName("Linking account: expired or invalid link token redirects with ?link_error=LINK_EXPIRED")
    void testLinkAccount_ExpiredLinkToken() throws IOException {
        when(linkTokenService.validateAndConsumeLinkToken("expired-link-token")).thenReturn(null);

        Map<String, Object> attrs = Map.of(
                "sub", "g-999",
                "email", "user@example.com",
                "email_verified", true,
                "name", "User"
        );
        OAuth2AuthenticationToken token = createAuthToken("google", attrs, "sub");

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new jakarta.servlet.http.Cookie("oauth2_link_token", "expired-link-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        successHandler.onAuthenticationSuccess(request, response, token);

        assertThat(response.getRedirectedUrl()).isEqualTo("https://taskoura.vercel.app/app/profile?link_error=LINK_EXPIRED");
        verify(oauthIdentityRepository, never()).save(any());
    }

    @Test
    @DisplayName("Failure handler with link token cookie redirects to profile with ?link_error")
    void testFailureHandler_WithLinkToken() throws IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new jakarta.servlet.http.Cookie("oauth2_link_token", "link-tok"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        org.springframework.security.oauth2.core.OAuth2Error error =
                new org.springframework.security.oauth2.core.OAuth2Error("access_denied", "User denied consent", null);
        org.springframework.security.oauth2.core.OAuth2AuthenticationException ex =
                new org.springframework.security.oauth2.core.OAuth2AuthenticationException(error);

        failureHandler.onAuthenticationFailure(request, response, ex);

        assertThat(response.getRedirectedUrl()).isEqualTo("https://taskoura.vercel.app/app/profile?link_error=ACCESS_DENIED");
    }
}

