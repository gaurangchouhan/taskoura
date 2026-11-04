package com.taskoura.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.security.oauth.CookieUtils;
import com.taskoura.security.oauth.HttpCookieOAuth2AuthorizationRequestRepository;
import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Controller
public class CustomErrorController implements ErrorController {

    private static final Logger log = LoggerFactory.getLogger(CustomErrorController.class);

    private final String frontendUrl;
    private final ObjectMapper objectMapper;

    @Autowired
    public CustomErrorController(
            @Value("${FRONTEND_URL:${app.frontend-url:https://taskoura.vercel.app}}") String frontendUrl,
            @Autowired(required = false) ObjectMapper objectMapper
    ) {
        this.frontendUrl = frontendUrl != null ? frontendUrl.replaceAll("/+$", "") : "https://taskoura.vercel.app";
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
    }

    @RequestMapping("/error")
    public void handleError(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String errorUri = (String) request.getAttribute(RequestDispatcher.ERROR_REQUEST_URI);
        if (errorUri == null) {
            errorUri = request.getRequestURI();
        }

        // Intercept any error on OAuth authorization or callback endpoints and safely redirect to frontend
        if (errorUri != null && (errorUri.startsWith("/oauth2/") || errorUri.startsWith("/login/oauth2/"))) {
            log.warn("OAuth flow error intercepted at /error for URI: {}. Redirecting to frontend callback with PROVIDER_ERROR.", errorUri);
            String targetFrontend = resolveFrontendUrl(request, response);
            response.sendRedirect(targetFrontend + "/auth/callback?error=PROVIDER_ERROR");
            return;
        }

        // For all other requests, never render an HTML Whitelabel Error Page; return clean JSON
        Integer statusCode = (Integer) request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        int status = statusCode != null ? statusCode : response.getStatus();
        if (status < 400 || status > 599) {
            status = HttpServletResponse.SC_INTERNAL_SERVER_ERROR;
        }

        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", status);
        body.put("error", HttpStatus.resolve(status) != null ? HttpStatus.resolve(status).getReasonPhrase() : "Error");
        body.put("message", "An unexpected error occurred");
        body.put("timestamp", Instant.now().toString());
        body.put("path", errorUri != null ? errorUri : "/error");

        response.getWriter().write(objectMapper.writeValueAsString(body));
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
}
