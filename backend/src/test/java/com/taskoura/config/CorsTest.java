package com.taskoura.config;

import com.taskoura.controller.HealthController;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.JwtUtil;
import com.taskoura.service.SessionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(HealthController.class)
@Import({SecurityConfig.class, CorsConfig.class, JwtAuthFilter.class, JwtUtil.class, ClockConfig.class})
@TestPropertySource(properties = {
    "jwt.secret=taskoura-super-secret-test-jwt-key-256-bits-length!!",
    "jwt.expiration-ms=86400000",
    "app.frontend-url=https://taskoura.vercel.app"
})
class CorsTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SessionService sessionService;

    @Test
    @DisplayName("CORS Preflight: OPTIONS request from localhost:5173 is allowed with 200 OK")
    void corsPreflight_allowedOrigin_returnsOk() throws Exception {
        mockMvc.perform(options("/api/health")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "Authorization,Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().exists("Access-Control-Allow-Methods"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    @DisplayName("CORS Preflight: OPTIONS request from production Vercel frontend is allowed with 200 OK")
    void corsPreflight_vercelProductionOrigin_returnsOk() throws Exception {
        mockMvc.perform(options("/api/health")
                        .header("Origin", "https://taskoura.vercel.app")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "Authorization,Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://taskoura.vercel.app"))
                .andExpect(header().exists("Access-Control-Allow-Methods"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    @DisplayName("CORS Preflight: OPTIONS request from Vercel preview deployment is allowed with 200 OK")
    void corsPreflight_vercelPreviewOrigin_returnsOk() throws Exception {
        mockMvc.perform(options("/api/health")
                        .header("Origin", "https://taskoura-git-feature-gaurang.vercel.app")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "Authorization,Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://taskoura-git-feature-gaurang.vercel.app"))
                .andExpect(header().exists("Access-Control-Allow-Methods"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    @DisplayName("CORS Preflight: OPTIONS request from untrusted origin does not receive allow-origin header")
    void corsPreflight_untrustedOrigin_rejected() throws Exception {
        mockMvc.perform(options("/api/health")
                        .header("Origin", "https://malicious-attacker.com")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "Authorization,Content-Type"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }
}
