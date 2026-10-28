package com.taskoura.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Production-ready CORS configuration for Taskoura backend.
 * Configured specifically to support:
 * - Frontend deployed on Vercel (production custom domain, *.vercel.app preview URLs)
 * - Local development environments (localhost, 127.0.0.1 on any port)
 * - Custom origins passed via environment variables (FRONTEND_URL, CORS_ALLOWED_ORIGINS)
 */
@Configuration
public class CorsConfig {

    private final String frontendUrl;
    private final String allowedOrigins;
    private final String allowedOriginPatterns;

    public CorsConfig(
            @Value("${app.frontend-url:${FRONTEND_URL:http://localhost:5173}}") String frontendUrl,
            @Value("${cors.allowed-origins:}") String allowedOrigins,
            @Value("${cors.allowed-origin-patterns:https://*.vercel.app,http://localhost:[*],http://127.0.0.1:[*]}") String allowedOriginPatterns) {
        this.frontendUrl = frontendUrl;
        this.allowedOrigins = allowedOrigins;
        this.allowedOriginPatterns = allowedOriginPatterns;
    }

    /**
     * Default constructor for fallback instantiation when standalone.
     */
    public CorsConfig() {
        this("http://localhost:5173", "", "https://*.vercel.app,http://localhost:[*],http://127.0.0.1:[*]");
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        List<String> patterns = new ArrayList<>();

        // Add pattern-based origins (e.g., https://*.vercel.app, http://localhost:[*])
        if (StringUtils.hasText(allowedOriginPatterns)) {
            Arrays.stream(allowedOriginPatterns.split(","))
                    .map(String::trim)
                    .filter(StringUtils::hasText)
                    .forEach(pattern -> {
                        if (!patterns.contains(pattern)) {
                            patterns.add(pattern);
                        }
                    });
        }

        // Add explicit frontend URL from env (e.g. FRONTEND_URL=https://taskoura.vercel.app)
        if (StringUtils.hasText(frontendUrl)) {
            String trimmedFrontend = frontendUrl.trim().replaceAll("/+$", "");
            if (StringUtils.hasText(trimmedFrontend) && !patterns.contains(trimmedFrontend)) {
                patterns.add(trimmedFrontend);
            }
        }

        // Add any additional comma-separated origins from CORS_ALLOWED_ORIGINS
        if (StringUtils.hasText(allowedOrigins)) {
            Arrays.stream(allowedOrigins.split(","))
                    .map(String::trim)
                    .map(origin -> origin.replaceAll("/+$", ""))
                    .filter(StringUtils::hasText)
                    .forEach(origin -> {
                        if (!patterns.contains(origin)) {
                            patterns.add(origin);
                        }
                    });
        }

        // Fallback default patterns if none configured
        if (patterns.isEmpty()) {
            patterns.add("http://localhost:[*]");
            patterns.add("http://127.0.0.1:[*]");
            patterns.add("https://*.vercel.app");
        }

        config.setAllowedOriginPatterns(patterns);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization", "Content-Disposition", "X-Total-Count"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
