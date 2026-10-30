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
            @Value("${FRONTEND_URL:${app.frontend-url:http://localhost:5173}}") String frontendUrl
    ) {
        this.frontendUrl = frontendUrl != null ? frontendUrl.replaceAll("/+$", "") : "http://localhost:5173";
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request,
                                        HttpServletResponse response,
                                        AuthenticationException exception) throws IOException {
        String errorCode = determineErrorCode(request, exception);
        log.warn("OAuth authentication failed: mappedCode={}, exceptionType={}, message={}",
                errorCode, exception.getClass().getSimpleName(), exception.getMessage());

        String linkToken = CookieUtils.getCookie(request, "oauth2_link_token")
                .map(jakarta.servlet.http.Cookie::getValue)
                .orElse(request != null ? request.getParameter("link_token") : null);

        if (linkToken != null && !linkToken.isBlank()) {
            CookieUtils.deleteCookie(request, response, "oauth2_link_token");
            response.sendRedirect(frontendUrl + "/app/profile?link_error=" + errorCode);
            return;
        }

        String targetUrl = frontendUrl + "/auth/callback?error=" + errorCode;
        response.sendRedirect(targetUrl);
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
}

