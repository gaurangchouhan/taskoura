package com.taskoura.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.oauth.CustomOAuth2AuthorizationRequestResolver;
import com.taskoura.security.oauth.CustomOAuth2UserService;
import com.taskoura.security.oauth.HttpCookieOAuth2AuthorizationRequestRepository;
import com.taskoura.security.oauth.OAuth2AuthenticationFailureHandler;
import com.taskoura.security.oauth.OAuth2AuthenticationSuccessHandler;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Configuration
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final ObjectMapper objectMapper;
    private final CorsConfigurationSource corsConfigurationSource;

    public SecurityConfig(
            JwtAuthFilter jwtAuthFilter,
            @Autowired(required = false) ObjectMapper objectMapper,
            @Autowired(required = false) CorsConfigurationSource corsConfigurationSource) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
        this.corsConfigurationSource = corsConfigurationSource != null
                ? corsConfigurationSource
                : new CorsConfig().corsConfigurationSource();
    }

    @Bean
    public AuthenticationEntryPoint authenticationEntryPoint() {
        return (request, response, authException) -> {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("status", HttpStatus.UNAUTHORIZED.value());
            body.put("error", HttpStatus.UNAUTHORIZED.getReasonPhrase());
            body.put("code", "UNAUTHENTICATED");
            body.put("message", "Full authentication is required to access this resource");
            body.put("timestamp", Instant.now().toString());
            body.put("path", request.getRequestURI());

            response.getWriter().write(objectMapper.writeValueAsString(body));
        };
    }

    @Bean
    public AccessDeniedHandler accessDeniedHandler() {
        return (request, response, accessDeniedException) -> {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("status", HttpStatus.FORBIDDEN.value());
            body.put("error", HttpStatus.FORBIDDEN.getReasonPhrase());
            body.put("code", "FORBIDDEN");
            body.put("message", "Access is denied");
            body.put("timestamp", Instant.now().toString());
            body.put("path", request.getRequestURI());

            response.getWriter().write(objectMapper.writeValueAsString(body));
        };
    }

    @Bean
    @Order(1)
    public SecurityFilterChain oauthSecurityFilterChain(
            HttpSecurity http,
            @Autowired(required = false) ClientRegistrationRepository clientRegistrationRepository,
            @Autowired(required = false) OAuth2AuthenticationSuccessHandler successHandler,
            @Autowired(required = false) OAuth2AuthenticationFailureHandler failureHandler,
            @Autowired(required = false) HttpCookieOAuth2AuthorizationRequestRepository cookieAuthorizationRequestRepository,
            @Autowired(required = false) CustomOAuth2UserService customOAuth2UserService
    ) throws Exception {
        http
            .securityMatcher("/oauth2/**", "/login/oauth2/**")
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth -> auth
                .anyRequest().permitAll()
            );

        if (clientRegistrationRepository != null) {
            http.oauth2Login(oauth2 -> {
                oauth2.clientRegistrationRepository(clientRegistrationRepository);
                oauth2.authorizationEndpoint(auth -> {
                    auth.baseUri("/oauth2/authorization");
                    if (cookieAuthorizationRequestRepository != null) {
                        auth.authorizationRequestRepository(cookieAuthorizationRequestRepository);
                    }
                    auth.authorizationRequestResolver(new CustomOAuth2AuthorizationRequestResolver(clientRegistrationRepository));
                });
                oauth2.redirectionEndpoint(redirection -> redirection
                    .baseUri("/login/oauth2/code/*")
                );
                if (customOAuth2UserService != null) {
                    oauth2.userInfoEndpoint(userInfo -> userInfo
                        .userService(customOAuth2UserService)
                    );
                }
                if (successHandler != null) {
                    oauth2.successHandler(successHandler);
                }
                if (failureHandler != null) {
                    oauth2.failureHandler(failureHandler);
                }
            });
        }

        return http.build();
    }

    @Bean
    @Order(2)
    public SecurityFilterChain apiSecurityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers(
                    "/api/health",
                    "/api/attachments/*/download",
                    "/api/auth/register",
                    "/api/auth/verify-otp",
                    "/api/auth/resend-otp",
                    "/api/auth/login",
                    "/api/auth/forgot-password",
                    "/api/auth/reset-password",
                    "/api/auth/oauth/providers",
                    "/api/auth/oauth/exchange"
                ).permitAll()
                .anyRequest().authenticated()
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(authenticationEntryPoint())
                .accessDeniedHandler(accessDeniedHandler())
            )
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
