package com.taskoura.security.oauth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class OAuthLinkValidationFilter extends OncePerRequestFilter {

    private final OAuthLinkTokenService oAuthLinkTokenService;
    private final String frontendUrl;

    @Autowired
    public OAuthLinkValidationFilter(
            @Autowired(required = false) OAuthLinkTokenService oAuthLinkTokenService,
            @Value("${FRONTEND_URL:${app.frontend-url:https://taskoura.vercel.app}}") String frontendUrl
    ) {
        this.oAuthLinkTokenService = oAuthLinkTokenService;
        this.frontendUrl = frontendUrl != null ? frontendUrl.replaceAll("/+$", "") : "https://taskoura.vercel.app";
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        String uri = request.getRequestURI();
        if (uri != null && uri.startsWith("/oauth2/authorization/")) {
            String linkToken = request.getParameter("link");
            if (linkToken == null || linkToken.isBlank()) {
                linkToken = request.getParameter("link_token");
            }

            if (linkToken != null && !linkToken.isBlank()) {
                String provider = resolveProviderFromUri(uri);
                if (oAuthLinkTokenService == null || !oAuthLinkTokenService.validateToken(linkToken.trim(), provider)) {
                    String targetFrontend = resolveFrontendUrl(request, response);
                    CookieUtils.deleteCookie(request, response, "oauth2_link_token");
                    response.sendRedirect(targetFrontend + "/app/profile?link_error=LINK_EXPIRED");
                    return;
                }

                // Valid link token: store on request attribute and set cookie for callback
                CookieUtils.addCookie(request, response, "oauth2_link_token", linkToken.trim(), 300);
                request.setAttribute("oauth2_link_token", linkToken.trim());
            }
        }

        filterChain.doFilter(request, response);
    }

    private String resolveProviderFromUri(String uri) {
        String prefix = "/oauth2/authorization/";
        int idx = uri.indexOf(prefix);
        if (idx != -1) {
            String sub = uri.substring(idx + prefix.length());
            int slash = sub.indexOf('/');
            return (slash != -1 ? sub.substring(0, slash) : sub).trim().toLowerCase();
        }
        return "";
    }

    private String resolveFrontendUrl(HttpServletRequest request, HttpServletResponse response) {
        if (request != null) {
            var cookieOpt = CookieUtils.getCookie(request, HttpCookieOAuth2AuthorizationRequestRepository.OAUTH2_FRONTEND_URL_COOKIE_NAME);
            if (cookieOpt.isPresent()) {
                String val = cookieOpt.get().getValue();
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
}

