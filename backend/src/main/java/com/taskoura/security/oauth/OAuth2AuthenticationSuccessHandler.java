package com.taskoura.security.oauth;

import com.taskoura.repository.OAuthIdentityRepository;
import com.taskoura.repository.UserProfileRepository;
import com.taskoura.repository.UserRepository;
import com.taskoura.service.EmailService;
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

@Component
public class OAuth2AuthenticationSuccessHandler implements AuthenticationSuccessHandler {

    private static final Logger log = LoggerFactory.getLogger(OAuth2AuthenticationSuccessHandler.class);

    private final OAuthUserService oAuthUserService;
    private final OAuthCodeService oAuthCodeService;
    private final OAuthLinkTokenService oAuthLinkTokenService;
    private final EmailService emailService;
    private final boolean autoLinkVerifiedEmail;
    private final String frontendUrl;

    @Autowired
    public OAuth2AuthenticationSuccessHandler(
            OAuthUserService oAuthUserService,
            OAuthCodeService oAuthCodeService,
            @Autowired(required = false) OAuthLinkTokenService oAuthLinkTokenService,
            @Autowired(required = false) EmailService emailService,
            @Value("${oauth.auto-link-verified-email:${OAUTH_AUTO_LINK_VERIFIED_EMAIL:true}}") boolean autoLinkVerifiedEmail,
            @Value("${FRONTEND_URL:${app.frontend-url:https://taskoura.vercel.app}}") String frontendUrl
    ) {
        this.oAuthUserService = oAuthUserService;
        this.oAuthCodeService = oAuthCodeService;
        this.oAuthLinkTokenService = oAuthLinkTokenService;
        this.emailService = emailService;
        this.autoLinkVerifiedEmail = autoLinkVerifiedEmail;
        this.frontendUrl = frontendUrl != null ? frontendUrl.replaceAll("/+$", "") : "https://taskoura.vercel.app";
    }

    public OAuth2AuthenticationSuccessHandler(
            OAuthUserService oAuthUserService,
            OAuthCodeService oAuthCodeService,
            OAuthLinkTokenService oAuthLinkTokenService,
            String frontendUrl
    ) {
        this(oAuthUserService, oAuthCodeService, oAuthLinkTokenService, null, false, frontendUrl);
    }

    public OAuth2AuthenticationSuccessHandler(
            UserRepository userRepository,
            UserProfileRepository userProfileRepository,
            OAuthIdentityRepository oauthIdentityRepository,
            OAuthCodeService oAuthCodeService,
            PasswordEncoder passwordEncoder,
            OAuthLinkTokenService oAuthLinkTokenService,
            String frontendUrl
    ) {
        this(
                new OAuthUserService(userRepository, userProfileRepository, oauthIdentityRepository, passwordEncoder),
                oAuthCodeService,
                oAuthLinkTokenService,
                frontendUrl
        );
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
        String targetFrontend = resolveFrontendUrl(request, response);
        try {
            if (!(authentication instanceof OAuth2AuthenticationToken authToken)) {
                log.warn("Authentication is not an OAuth2AuthenticationToken: {}",
                        authentication != null ? authentication.getClass().getName() : "null");
                response.sendRedirect(targetFrontend + "/auth/callback?error=PROVIDER_ERROR");
                return;
            }

            String provider = authToken.getAuthorizedClientRegistrationId().toLowerCase();
            OAuth2User oauth2User = authToken.getPrincipal();

            // Check if this is an account linking flow
            String linkToken = CookieUtils.getCookie(request, "oauth2_link_token")
                    .map(jakarta.servlet.http.Cookie::getValue)
                    .orElse(request != null ? (request.getParameter("link") != null ? request.getParameter("link") : request.getParameter("link_token")) : null);

            if (linkToken != null && !linkToken.isBlank()) {
                CookieUtils.deleteCookie(request, response, "oauth2_link_token");
                handleAccountLinking(request, response, targetFrontend, provider, oauth2User, linkToken.trim());
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
                response.sendRedirect(targetFrontend + "/auth/callback?error=PROVIDER_ERROR");
                return;
            }

            if (email == null || email.isBlank()) {
                log.info("OAuth login failed for provider {}: email is missing", provider);
                response.sendRedirect(targetFrontend + "/auth/callback?error=EMAIL_MISSING");
                return;
            }

            if (!emailVerified) {
                log.info("OAuth login failed for provider {}: email is not verified", provider);
                response.sendRedirect(targetFrontend + "/auth/callback?error=EMAIL_UNVERIFIED");
                return;
            }

            OAuthUserService.LoginResult result = oAuthUserService.processOAuthLogin(
                    provider,
                    providerUserId,
                    email,
                    name,
                    avatarUrl,
                    isValidGithubUrl(githubUrl) ? githubUrl : null,
                    emailVerified,
                    autoLinkVerifiedEmail
            );

            if (result.status() == OAuthUserService.LoginStatus.ACCOUNT_EXISTS_UNVERIFIED) {
                log.info("OAuth login rejected for provider {}: account exists with same email but is unverified", provider);
                response.sendRedirect(targetFrontend + "/auth/callback?error=ACCOUNT_EXISTS_UNVERIFIED");
                return;
            }

            if (result.status() == OAuthUserService.LoginStatus.ACCOUNT_EXISTS_USE_PASSWORD) {
                log.info("OAuth login rejected for provider {}: account exists with same email, password required", provider);
                response.sendRedirect(targetFrontend + "/auth/callback?error=ACCOUNT_EXISTS_USE_PASSWORD");
                return;
            }

            if (result.autoLinked()) {
                log.info("OAuth automatic link successful for user {} with provider {}", result.user().getEmail(), provider);
                try {
                    if (emailService != null) {
                        emailService.sendPasswordChangedEmail(result.user().getEmail(), result.user().getName());
                    }
                } catch (Exception e) {
                    log.warn("Failed to send auto-link security email: {}", e.getMessage());
                }
            }

            String code = oAuthCodeService.generateAndSaveCode(result.user().getId());
            response.sendRedirect(targetFrontend + "/auth/callback?code=" + code);

        } catch (Exception e) {
            log.error("Unexpected error during OAuth authentication success handling", e);
            response.sendRedirect(targetFrontend + "/auth/callback?error=PROVIDER_ERROR");
        }
    }

    private void handleAccountLinking(HttpServletRequest request,
                                       HttpServletResponse response,
                                       String targetFrontend,
                                       String provider,
                                       OAuth2User oauth2User,
                                       String linkToken) throws IOException {
        if (oAuthLinkTokenService == null) {
            response.sendRedirect(targetFrontend + "/app/profile?link_error=LINK_EXPIRED");
            return;
        }

        OAuthLinkTokenService.LinkTokenData linkData = oAuthLinkTokenService.validateAndConsumeLinkToken(linkToken);
        if (linkData == null) {
            response.sendRedirect(targetFrontend + "/app/profile?link_error=LINK_EXPIRED");
            return;
        }

        if (linkData.provider() != null && !linkData.provider().equalsIgnoreCase(provider)) {
            response.sendRedirect(targetFrontend + "/app/profile?link_error=LINK_EXPIRED");
            return;
        }

        String providerUserId = extractProviderUserId(provider, oauth2User);
        if (providerUserId == null || providerUserId.isBlank()) {
            response.sendRedirect(targetFrontend + "/app/profile?link_error=PROVIDER_ERROR");
            return;
        }

        String email = extractEmail(oauth2User);
        String avatarUrl = extractAvatarUrl(provider, oauth2User);
        String githubUrl = extractGithubUrl(provider, oauth2User);

        OAuthUserService.LinkStatus linkStatus = oAuthUserService.linkAccount(
                linkData.userId(),
                provider,
                providerUserId,
                email,
                avatarUrl,
                isValidGithubUrl(githubUrl) ? githubUrl : null
        );

        if (linkStatus == OAuthUserService.LinkStatus.ALREADY_LINKED) {
            response.sendRedirect(targetFrontend + "/app/profile?link_error=ALREADY_LINKED");
            return;
        } else if (linkStatus == OAuthUserService.LinkStatus.IDENTITY_LINKED_TO_OTHER_ACCOUNT) {
            response.sendRedirect(targetFrontend + "/app/profile?link_error=IDENTITY_LINKED_TO_OTHER_ACCOUNT");
            return;
        }

        try {
            if (emailService != null && email != null && !email.isBlank()) {
                emailService.sendPasswordChangedEmail(email, "Taskoura User");
            }
        } catch (Exception e) {
            log.warn("Failed to send account linking security email: {}", e.getMessage());
        }

        response.sendRedirect(targetFrontend + "/app/profile?linked=" + provider);
    }

    private String resolveFrontendUrl(HttpServletRequest request, HttpServletResponse response) {
        if (request != null) {
            var cookieOpt = CookieUtils.getCookie(request, HttpCookieOAuth2AuthorizationRequestRepository.OAUTH2_FRONTEND_URL_COOKIE_NAME);
            if (cookieOpt.isPresent()) {
                String val = cookieOpt.get().getValue();
                if (response != null) {
                    CookieUtils.deleteCookie(request, response, HttpCookieOAuth2AuthorizationRequestRepository.OAUTH2_FRONTEND_URL_COOKIE_NAME);
                }
                if (val != null && !val.isBlank()) {
                    String clean = val.trim().replaceAll("/+$", "");
                    if ((clean.startsWith("https://") && clean.contains("vercel.app"))
                            || clean.startsWith("http://localhost")
                            || clean.startsWith("http://127.0.0.1")) {
                        return clean;
                    }
                }
            }
            String trustedOrigin = HttpCookieOAuth2AuthorizationRequestRepository.extractTrustedFrontendOrigin(request);
            if (trustedOrigin != null && !trustedOrigin.isBlank()) {
                return trustedOrigin;
            }
        }
        return this.frontendUrl;
    }

    private String extractProviderUserId(String provider, OAuth2User user) {
        if ("google".equalsIgnoreCase(provider)) {
            Object sub = user.getAttribute("sub");
            return sub != null ? String.valueOf(sub) : null;
        } else if ("github".equalsIgnoreCase(provider)) {
            Object id = user.getAttribute("id");
            return id != null ? String.valueOf(id) : null;
        }
        Object name = user.getName();
        return name != null ? String.valueOf(name) : null;
    }

    private String extractEmail(OAuth2User user) {
        Object email = user.getAttribute("email");
        return email != null ? String.valueOf(email).trim().toLowerCase() : null;
    }

    private boolean extractEmailVerified(String provider, OAuth2User user) {
        Object verified = user.getAttribute("email_verified");
        if (verified instanceof Boolean b) {
            return b;
        }
        if (verified instanceof String s) {
            return "true".equalsIgnoreCase(s);
        }
        return false;
    }

    private String extractName(OAuth2User user) {
        Object name = user.getAttribute("name");
        if (name instanceof String s && !s.isBlank()) {
            return s.trim();
        }
        Object login = user.getAttribute("login");
        if (login instanceof String s && !s.isBlank()) {
            return s.trim();
        }
        return null;
    }

    private String extractAvatarUrl(String provider, OAuth2User user) {
        if ("google".equalsIgnoreCase(provider)) {
            Object picture = user.getAttribute("picture");
            return picture instanceof String s ? s : null;
        } else if ("github".equalsIgnoreCase(provider)) {
            Object avatar = user.getAttribute("avatar_url");
            return avatar instanceof String s ? s : null;
        }
        return null;
    }

    private String extractGithubUrl(String provider, OAuth2User user) {
        if ("github".equalsIgnoreCase(provider)) {
            Object htmlUrl = user.getAttribute("html_url");
            if (htmlUrl instanceof String s && !s.isBlank()) {
                return s.trim();
            }
            Object login = user.getAttribute("login");
            if (login instanceof String s && !s.isBlank()) {
                return "https://github.com/" + s.trim();
            }
        }
        return null;
    }

    private boolean isValidGithubUrl(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            return host != null && (host.equalsIgnoreCase("github.com") || host.endsWith(".github.com"));
        } catch (Exception e) {
            return false;
        }
    }
}
