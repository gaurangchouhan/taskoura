package com.taskoura.security.oauth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;

import java.net.URI;

@Component
public class HttpCookieOAuth2AuthorizationRequestRepository implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

    public static final String OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME = "oauth2_auth_request";
    public static final String OAUTH2_FRONTEND_URL_COOKIE_NAME = "oauth2_frontend_url";
    private static final int COOKIE_EXPIRE_SECONDS = 180;

    @Override
    public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
        return CookieUtils.getCookie(request, OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME)
                .map(cookie -> CookieUtils.deserialize(cookie, OAuth2AuthorizationRequest.class))
                .orElse(null);
    }

    @Override
    public void saveAuthorizationRequest(OAuth2AuthorizationRequest authorizationRequest,
                                         HttpServletRequest request,
                                         HttpServletResponse response) {
        if (authorizationRequest == null) {
            CookieUtils.deleteCookie(request, response, OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME);
            CookieUtils.deleteCookie(request, response, OAUTH2_FRONTEND_URL_COOKIE_NAME);
            return;
        }
        String linkToken = request.getParameter("link_token");
        if (linkToken != null && !linkToken.isBlank()) {
            CookieUtils.addCookie(request, response, "oauth2_link_token", linkToken.trim(), COOKIE_EXPIRE_SECONDS);
        }

        String trustedFrontend = extractTrustedFrontendOrigin(request);
        if (trustedFrontend != null) {
            CookieUtils.addCookie(request, response, OAUTH2_FRONTEND_URL_COOKIE_NAME, trustedFrontend, COOKIE_EXPIRE_SECONDS);
        }

        CookieUtils.addCookie(request, response, OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME,
                CookieUtils.serialize(authorizationRequest), COOKIE_EXPIRE_SECONDS);
    }

    @Override
    public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request,
                                                                 HttpServletResponse response) {
        OAuth2AuthorizationRequest original = this.loadAuthorizationRequest(request);
        CookieUtils.deleteCookie(request, response, OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME);
        return original;
    }

    public static String extractTrustedFrontendOrigin(HttpServletRequest request) {
        if (request == null) return null;
        String candidate = request.getParameter("redirect_uri");
        if (candidate == null || candidate.isBlank()) {
            candidate = request.getParameter("frontend_url");
        }
        if (candidate == null || candidate.isBlank()) {
            candidate = request.getHeader("Origin");
        }
        if (candidate == null || candidate.isBlank()) {
            candidate = request.getHeader("Referer");
        }
        if (candidate != null && !candidate.isBlank()) {
            try {
                URI uri = URI.create(candidate.trim());
                String scheme = uri.getScheme();
                String host = uri.getHost();
                int port = uri.getPort();
                if (host != null && (host.equals("taskoura.vercel.app")
                        || host.endsWith(".vercel.app")
                        || host.equals("localhost")
                        || host.equals("127.0.0.1"))) {
                    StringBuilder origin = new StringBuilder();
                    origin.append(scheme != null ? scheme : "https").append("://").append(host);
                    if (port != -1 && port != 80 && port != 443) {
                        origin.append(":").append(port);
                    }
                    return origin.toString();
                }
            } catch (Exception ignored) {
            }
        }
        return null;
    }
}
