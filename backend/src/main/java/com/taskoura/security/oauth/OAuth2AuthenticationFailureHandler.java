package com.taskoura.security.oauth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class OAuth2AuthenticationFailureHandler implements AuthenticationFailureHandler {

    private static final Logger log = LoggerFactory.getLogger(OAuth2AuthenticationFailureHandler.class);

    private final String frontendUrl;

    public OAuth2AuthenticationFailureHandler(
            @Value("${FRONTEND_URL:${app.frontend-url:https://taskoura.vercel.app}}") String frontendUrl
    ) {
        this.frontendUrl = frontendUrl != null ? frontendUrl.replaceAll("/+$", "") : "https://taskoura.vercel.app";
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request,
                                        HttpServletResponse response,
                                        AuthenticationException exception) throws IOException {
        String targetFrontend = resolveFrontendUrl(request, response);
        try {
            String errorCode = determineErrorCode(request, exception);
            String provider = resolveRegistrationId(request);
            String stage = resolveFailureStage(request, exception);
            String exceptionType = exception != null ? exception.getClass().getSimpleName() : "null";
            String oauthErrorCode = null;
            String oauthErrorDesc = null;
            Integer httpStatusCode = null;
            String wwwAuthenticate = null;

            if (exception instanceof OAuth2AuthenticationException oae) {
                if (oae.getError() != null) {
                    oauthErrorCode = oae.getError().getErrorCode();
                    oauthErrorDesc = oae.getError().getDescription();
                }
                if (oae.getCause() instanceof org.springframework.web.client.HttpStatusCodeException hsce) {
                    httpStatusCode = hsce.getStatusCode().value();
                    if (hsce.getResponseHeaders() != null) {
                        wwwAuthenticate = hsce.getResponseHeaders().getFirst("WWW-Authenticate");
                    }
                }
            } else if (exception != null && exception.getCause() instanceof org.springframework.web.client.HttpStatusCodeException hsce) {
                httpStatusCode = hsce.getStatusCode().value();
                if (hsce.getResponseHeaders() != null) {
                    wwwAuthenticate = hsce.getResponseHeaders().getFirst("WWW-Authenticate");
                }
            }

            log.warn("OAuth authentication failed: provider={}, stage={}, mappedCode={}, exceptionType={}, oauthErrorCode={}, oauthErrorDesc={}, httpStatus={}, wwwAuthenticate={}",
                    provider,
                    stage,
                    errorCode,
                    exceptionType,
                    oauthErrorCode,
                    oauthErrorDesc,
                    httpStatusCode != null ? httpStatusCode : "n/a",
                    wwwAuthenticate != null ? wwwAuthenticate : "none");

            String linkToken = CookieUtils.getCookie(request, "oauth2_link_token")
                    .map(jakarta.servlet.http.Cookie::getValue)
                    .orElse(request != null ? request.getParameter("link_token") : null);

            if (linkToken != null && !linkToken.isBlank()) {
                CookieUtils.deleteCookie(request, response, "oauth2_link_token");
                response.sendRedirect(targetFrontend + "/app/profile?link_error=" + errorCode);
                return;
            }

            String targetUrl = targetFrontend + "/auth/callback?error=" + errorCode;
            response.sendRedirect(targetUrl);
        } catch (Exception e) {
            log.error("Unexpected error in OAuth authentication failure handler", e);
            try {
                response.sendRedirect(targetFrontend + "/auth/callback?error=PROVIDER_ERROR");
            } catch (Exception ignored) {
            }
        }
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
        }
        return this.frontendUrl;
    }

    public String determineErrorCode(HttpServletRequest request, AuthenticationException exception) {
        // First check request parameters (e.g. provider returned error=access_denied)
        String requestError = request != null ? request.getParameter("error") : null;
        if ("access_denied".equalsIgnoreCase(requestError)) {
            return "ACCESS_DENIED";
        }

        if (exception == null) {
            return "PROVIDER_ERROR";
        }

        String message = exception.getMessage() != null ? exception.getMessage().toLowerCase() : "";

        if (exception instanceof OAuth2AuthenticationException oae) {
            String oaeCode = oae.getError() != null ? oae.getError().getErrorCode() : "";
            if ("access_denied".equalsIgnoreCase(oaeCode) || message.contains("access_denied")) {
                return "ACCESS_DENIED";
            }
            if ("authorization_request_not_found".equalsIgnoreCase(oaeCode)
                    || "invalid_state".equalsIgnoreCase(oaeCode)
                    || message.contains("state")
                    || message.contains("authorization_request_not_found")) {
                return "STATE_INVALID";
            }
            if ("PROVIDER_DISABLED".equalsIgnoreCase(oaeCode)
                    || "client_registration_not_found".equalsIgnoreCase(oaeCode)
                    || message.contains("provider_disabled")) {
                return "PROVIDER_DISABLED";
            }
            if ("EMAIL_MISSING".equalsIgnoreCase(oaeCode)) {
                return "EMAIL_MISSING";
            }
            if ("EMAIL_UNVERIFIED".equalsIgnoreCase(oaeCode)) {
                return "EMAIL_UNVERIFIED";
            }
            if ("ACCOUNT_EXISTS_USE_PASSWORD".equalsIgnoreCase(oaeCode)) {
                return "ACCOUNT_EXISTS_USE_PASSWORD";
            }
        }

        if (message.contains("access_denied")) {
            return "ACCESS_DENIED";
        }
        if (message.contains("state") || message.contains("csrf")) {
            return "STATE_INVALID";
        }
        if (message.contains("provider_disabled")) {
            return "PROVIDER_DISABLED";
        }

        return "PROVIDER_ERROR";
    }

    public String resolveRegistrationId(HttpServletRequest request) {
        if (request == null) {
            return "unknown";
        }
        String uri = request.getRequestURI();
        if (uri != null) {
            String loginPrefix = "/login/oauth2/code/";
            int idx = uri.indexOf(loginPrefix);
            if (idx != -1) {
                String sub = uri.substring(idx + loginPrefix.length());
                int slash = sub.indexOf('/');
                return (slash != -1 ? sub.substring(0, slash) : sub).trim().toLowerCase();
            }
            String authPrefix = "/oauth2/authorization/";
            int authIdx = uri.indexOf(authPrefix);
            if (authIdx != -1) {
                String sub = uri.substring(authIdx + authPrefix.length());
                int slash = sub.indexOf('/');
                return (slash != -1 ? sub.substring(0, slash) : sub).trim().toLowerCase();
            }
        }
        String param = request.getParameter("registrationId");
        if (param != null && !param.isBlank()) {
            return param.trim().toLowerCase();
        }
        return "unknown";
    }

    public String resolveFailureStage(HttpServletRequest request, AuthenticationException exception) {
        String msg = exception != null && exception.getMessage() != null ? exception.getMessage().toLowerCase() : "";
        if (msg.contains("invalid_token_response") || msg.contains("access token response") || msg.contains("token response")) {
            return "TOKEN_EXCHANGE";
        }
        if (msg.contains("userinfo") || msg.contains("user_info") || msg.contains("user info") || msg.contains("loaduser")) {
            return "USER_INFO";
        }
        if (request != null) {
            String uri = request.getRequestURI();
            if (uri != null && uri.contains("/login/oauth2/code/")) {
                if (request.getParameter("error") != null) {
                    return "AUTHORIZATION_RESPONSE";
                }
                return "TOKEN_EXCHANGE";
            }
            if (uri != null && uri.contains("/oauth2/authorization/")) {
                return "AUTHORIZATION_REQUEST";
            }
        }
        return "AUTHENTICATION";
    }
}
