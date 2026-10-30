package com.taskoura.controller;

import com.taskoura.config.ClockConfig;
import com.taskoura.config.PasswordEncoderConfig;
import com.taskoura.config.SecurityConfig;
import com.taskoura.exception.GlobalExceptionHandler;
import com.taskoura.repository.OAuthIdentityRepository;
import com.taskoura.repository.OAuthLoginCodeRepository;
import com.taskoura.repository.UserProfileRepository;
import com.taskoura.repository.UserRepository;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.JwtUtil;
import com.taskoura.security.oauth.OAuthExchangeRateLimiter;
import com.taskoura.security.oauth.OAuthLinkTokenService;
import com.taskoura.service.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies that Spring Boot successfully creates the full dependency-injection chain:
 * AuthController -> AuthService -> OAuthCodeService, OAuthLinkTokenService, OAuthExchangeRateLimiter, etc.
 *
 * This directly prevents the production startup crash:
 * java.lang.NoSuchMethodException: com.taskoura.service.OAuthCodeService.<init>()
 */
@WebMvcTest(controllers = AuthController.class)
@Import({
        SecurityConfig.class,
        JwtAuthFilter.class,
        JwtUtil.class,
        ClockConfig.class,
        PasswordEncoderConfig.class,
        GlobalExceptionHandler.class,
        AuthService.class,
        OAuthCodeService.class,
        OAuthLinkTokenService.class,
        OAuthExchangeRateLimiter.class
})
@TestPropertySource(properties = {
        "jwt.secret=taskoura-super-secret-test-jwt-key-256-bits-length!!",
        "jwt.expiration-ms=86400000",
        "SERVER_PORT=8081"
})
class AuthContextStartupTest {

    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private AuthController authController;

    @Autowired
    private AuthService authService;

    @Autowired
    private OAuthCodeService oAuthCodeService;

    @Autowired
    private OAuthLinkTokenService oAuthLinkTokenService;

    @Autowired
    private OAuthExchangeRateLimiter oAuthExchangeRateLimiter;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private UserProfileRepository userProfileRepository;

    @MockitoBean
    private OAuthIdentityRepository oauthIdentityRepository;

    @MockitoBean
    private OAuthLoginCodeRepository oauthLoginCodeRepository;

    @MockitoBean
    private OtpService otpService;

    @MockitoBean
    private SessionService sessionService;

    @MockitoBean
    private EmailService emailService;

    @Test
    @DisplayName("Spring successfully instantiates AuthController, AuthService, and OAuthCodeService via constructor DI")
    void testSpringContextLoadsAuthChain() throws Exception {
        assertThat(authController).isNotNull();
        assertThat(authService).isNotNull();
        assertThat(oAuthCodeService).isNotNull();
        assertThat(oAuthLinkTokenService).isNotNull();
        assertThat(oAuthExchangeRateLimiter).isNotNull();

        assertThat(applicationContext.getBean(AuthController.class)).isSameAs(authController);
        assertThat(applicationContext.getBean(AuthService.class)).isSameAs(authService);
        assertThat(applicationContext.getBean(OAuthCodeService.class)).isSameAs(oAuthCodeService);

        // Verify public endpoint reachable
        mockMvc.perform(get("/api/auth/oauth/providers"))
                .andExpect(status().isOk());
    }
}
