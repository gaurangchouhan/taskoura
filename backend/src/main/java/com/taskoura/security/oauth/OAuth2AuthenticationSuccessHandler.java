package com.taskoura.security.oauth;

import com.taskoura.entity.OAuthIdentity;
import com.taskoura.entity.User;
import com.taskoura.entity.UserProfile;
import com.taskoura.repository.OAuthIdentityRepository;
import com.taskoura.repository.UserProfileRepository;
import com.taskoura.repository.UserRepository;
import com.taskoura.service.OAuthCodeService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Component
public class OAuth2AuthenticationSuccessHandler implements AuthenticationSuccessHandler {

    private static final Logger log = LoggerFactory.getLogger(OAuth2AuthenticationSuccessHandler.class);

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final OAuthIdentityRepository oauthIdentityRepository;
    private final OAuthCodeService oAuthCodeService;
    private final PasswordEncoder passwordEncoder;
    private final OAuthLinkTokenService oAuthLinkTokenService;
    private final String frontendUrl;

    public OAuth2AuthenticationSuccessHandler(
            UserRepository userRepository,
            UserProfileRepository userProfileRepository,
            OAuthIdentityRepository oauthIdentityRepository,
            OAuthCodeService oAuthCodeService,
            PasswordEncoder passwordEncoder,
            @Autowired(required = false) OAuthLinkTokenService oAuthLinkTokenService,
            @Value("${FRONTEND_URL:${app.frontend-url:http://localhost:5173}}") String frontendUrl
    ) {
        this.userRepository = userRepository;
        this.userProfileRepository = userProfileRepository;
        this.oauthIdentityRepository = oauthIdentityRepository;
        this.oAuthCodeService = oAuthCodeService;
        this.passwordEncoder = passwordEncoder;
        this.oAuthLinkTokenService = oAuthLinkTokenService;
        this.frontendUrl = frontendUrl != null ? frontendUrl.replaceAll("/+$", "") : "http://localhost:5173";
    }

    public OAuth2AuthenticationSuccessHandler(
            UserRepository userRepository,
            UserProfileRepository userProfileRepository,
            OAuthIdentityRepository oauthIdentityRepository,
            OAuthCodeService oAuthCodeService,
            PasswordEncoder passwordEncoder,
            String frontendUrl
    ) {
        this(userRepository, userProfileRepository, oauthIdentityRepository, oAuthCodeService, passwordEncoder, null, frontendUrl);
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        try {
            if (!(authentication instanceof OAuth2AuthenticationToken authToken)) {
                log.warn("Authentication is not an OAuth2AuthenticationToken: {}", authentication.getClass().getName());
                response.sendRedirect(frontendUrl + "/auth/callback?error=PROVIDER_ERROR");
                return;
            }

            String provider = authToken.getAuthorizedClientRegistrationId().toLowerCase();
            OAuth2User oauth2User = authToken.getPrincipal();

            // Check if this is an account linking flow
            String linkToken = CookieUtils.getCookie(request, "oauth2_link_token")
                    .map(jakarta.servlet.http.Cookie::getValue)
                    .orElse(request.getParameter("link_token"));

            if (linkToken != null && !linkToken.isBlank()) {
                CookieUtils.deleteCookie(request, response, "oauth2_link_token");
                handleAccountLinking(request, response, provider, oauth2User, linkToken.trim());
                return;
            }

            String providerUserId = extractProviderUserId(provider, oauth2User);
            String email = extractEmail(oauth2User);
            boolean emailVerified = extractEmailVerified(provider, oauth2User);
            String name = extractName(oauth2User);
            String avatarUrl = extractAvatarUrl(provider, oauth2User);
            String githubUrl = extractGithubUrl(provider, oauth2User);

            if (providerUserId == null || providerUserId.isBlank()) {
                log.warn("OAuth providerUserId is missing for provider {}", provider);
                response.sendRedirect(frontendUrl + "/auth/callback?error=PROVIDER_ERROR");
                return;
            }

            if (email == null || email.isBlank()) {
                log.info("OAuth login failed for provider {}: email is missing", provider);
                response.sendRedirect(frontendUrl + "/auth/callback?error=EMAIL_MISSING");
                return;
            }

            if (!emailVerified) {
                log.info("OAuth login failed for provider {}: email is not verified", provider);
                response.sendRedirect(frontendUrl + "/auth/callback?error=EMAIL_UNVERIFIED");
                return;
            }

            // Case (a): Identity exists
            Optional<OAuthIdentity> existingIdentity =
                    oauthIdentityRepository.findByProviderAndProviderUserId(provider, providerUserId);

            if (existingIdentity.isPresent()) {
                UUID userId = existingIdentity.get().getUserId();
                Optional<User> userOpt = userRepository.findById(userId);
                if (userOpt.isPresent()) {
                    String code = oAuthCodeService.generateAndSaveCode(userId);
                    response.sendRedirect(frontendUrl + "/auth/callback?code=" + code);
                    return;
                }
            }

            // Case (c): No identity, but a Taskoura account with the same email exists
            Optional<User> existingUser = userRepository.findByEmail(email);
            if (existingUser.isPresent()) {
                log.info("OAuth login rejected for provider {}: account exists with same email, password required", provider);
                response.sendRedirect(frontendUrl + "/auth/callback?error=ACCOUNT_EXISTS_USE_PASSWORD");
                return;
            }

            // Case (b): No identity and no user with that email -> create user, identity, and profile
            String safeName = (name != null && !name.isBlank()) ? name.trim() : email.substring(0, email.indexOf('@'));

            User newUser = User.builder()
                    .name(safeName)
                    .email(email.toLowerCase().trim())
                    .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                    .verified(true)
                    .passwordLoginEnabled(false)
                    .build();

            User savedUser = userRepository.save(newUser);

            OAuthIdentity identity = OAuthIdentity.builder()
                    .userId(savedUser.getId())
                    .provider(provider)
                    .providerUserId(providerUserId)
                    .emailAtLink(email.toLowerCase().trim())
                    .createdAt(LocalDateTime.now())
                    .build();
            oauthIdentityRepository.save(identity);

            // Prefill profile
            UserProfile profile = UserProfile.builder()
                    .user(savedUser)
                    .userId(savedUser.getId())
                    .avatarUrl(avatarUrl)
                    .githubUrl(isValidGithubUrl(githubUrl) ? githubUrl : null)
                    .build();
            userProfileRepository.save(profile);

            String code = oAuthCodeService.generateAndSaveCode(savedUser.getId());
            response.sendRedirect(frontendUrl + "/auth/callback?code=" + code);

        } catch (Exception e) {
            log.error("Unexpected error during OAuth authentication success handling", e);
            response.sendRedirect(frontendUrl + "/auth/callback?error=PROVIDER_ERROR");
        }
    }

    private void handleAccountLinking(HttpServletRequest request,
                                       HttpServletResponse response,
                                       String provider,
                                       OAuth2User oauth2User,
                                       String linkToken) throws IOException {
        if (oAuthLinkTokenService == null) {
            response.sendRedirect(frontendUrl + "/app/profile?link_error=LINK_EXPIRED");
            return;
        }

        OAuthLinkTokenService.LinkTokenData linkData = oAuthLinkTokenService.validateAndConsumeLinkToken(linkToken);
        if (linkData == null) {
            response.sendRedirect(frontendUrl + "/app/profile?link_error=LINK_EXPIRED");
            return;
        }

        String providerUserId = extractProviderUserId(provider, oauth2User);
        String email = extractEmail(oauth2User);
        boolean emailVerified = extractEmailVerified(provider, oauth2User);

        if (email == null || email.isBlank()) {
            response.sendRedirect(frontendUrl + "/app/profile?link_error=EMAIL_MISSING");
            return;
        }

        if (!emailVerified) {
            response.sendRedirect(frontendUrl + "/app/profile?link_error=EMAIL_UNVERIFIED");
            return;
        }

        Optional<OAuthIdentity> existingIdentity =
                oauthIdentityRepository.findByProviderAndProviderUserId(provider, providerUserId);

        if (existingIdentity.isPresent()) {
            if (existingIdentity.get().getUserId().equals(linkData.userId())) {
                response.sendRedirect(frontendUrl + "/app/profile?link_error=ALREADY_LINKED");
            } else {
                response.sendRedirect(frontendUrl + "/app/profile?link_error=IDENTITY_LINKED_TO_OTHER_ACCOUNT");
            }
            return;
        }

        Optional<OAuthIdentity> userProviderIdentity =
                oauthIdentityRepository.findByUserIdAndProvider(linkData.userId(), provider);
        if (userProviderIdentity.isPresent()) {
            response.sendRedirect(frontendUrl + "/app/profile?link_error=ALREADY_LINKED");
            return;
        }

        OAuthIdentity newIdentity = OAuthIdentity.builder()
                .userId(linkData.userId())
                .provider(provider)
                .providerUserId(providerUserId)
                .emailAtLink(email.toLowerCase().trim())
                .createdAt(LocalDateTime.now())
                .build();
        oauthIdentityRepository.save(newIdentity);

        response.sendRedirect(frontendUrl + "/app/profile?linked=" + provider);
    }

    private String extractProviderUserId(String provider, OAuth2User user) {
        if ("google".equalsIgnoreCase(provider)) {
            Object sub = user.getAttribute("sub");
            return sub != null ? sub.toString() : null;
        } else if ("github".equalsIgnoreCase(provider)) {
            Object id = user.getAttribute("id");
            return id != null ? id.toString() : null;
        }
        Object sub = user.getAttribute("sub");
        if (sub != null) return sub.toString();
        Object id = user.getAttribute("id");
        return id != null ? id.toString() : user.getName();
    }

    private String extractEmail(OAuth2User user) {
        Object email = user.getAttribute("email");
        return email != null ? email.toString().trim() : null;
    }

    private boolean extractEmailVerified(String provider, OAuth2User user) {
        Object verified = user.getAttribute("email_verified");
        if (verified instanceof Boolean b) {
            return b;
        }
        if (verified instanceof String s) {
            return "true".equalsIgnoreCase(s);
        }
        // In case of Google, standard OIDC field is email_verified
        // In case of GitHub, CustomOAuth2UserService sets email_verified attribute
        return false;
    }

    private String extractName(OAuth2User user) {
        Object name = user.getAttribute("name");
        if (name != null && !name.toString().isBlank()) {
            return name.toString().trim();
        }
        Object login = user.getAttribute("login");
        if (login != null && !login.toString().isBlank()) {
            return login.toString().trim();
        }
        return null;
    }

    private String extractAvatarUrl(String provider, OAuth2User user) {
        if ("google".equalsIgnoreCase(provider)) {
            Object picture = user.getAttribute("picture");
            return picture != null ? picture.toString().trim() : null;
        }
        Object avatar = user.getAttribute("avatar_url");
        if (avatar != null) return avatar.toString().trim();
        Object picture = user.getAttribute("picture");
        return picture != null ? picture.toString().trim() : null;
    }

    private String extractGithubUrl(String provider, OAuth2User user) {
        if ("github".equalsIgnoreCase(provider)) {
            Object htmlUrl = user.getAttribute("html_url");
            return htmlUrl != null ? htmlUrl.toString().trim() : null;
        }
        return null;
    }

    private boolean isValidGithubUrl(String url) {
        if (url == null || url.isBlank()) return false;
        try {
            URI uri = new URI(url.trim());
            if (!"https".equalsIgnoreCase(uri.getScheme())) return false;
            String host = uri.getHost();
            return host != null && (host.equalsIgnoreCase("github.com") || host.equalsIgnoreCase("www.github.com"));
        } catch (Exception e) {
            return false;
        }
    }
}

