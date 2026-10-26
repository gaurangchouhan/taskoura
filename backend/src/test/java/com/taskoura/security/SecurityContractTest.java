package com.taskoura.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.config.SecurityConfig;
import com.taskoura.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

import static org.hamcrest.Matchers.endsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.taskoura.config.ClockConfig;
import com.taskoura.service.SessionService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@WebMvcTest(controllers = SecurityContractTest.ProtectedDummyController.class)
@AutoConfigureMockMvc
@Import({
    SecurityContractTest.ProtectedDummyController.class,
    SecurityConfig.class,
    JwtAuthFilter.class,
    JwtUtil.class,
    ClockConfig.class,
    GlobalExceptionHandler.class
})
@TestPropertySource(properties = {
    "jwt.secret=taskoura-super-secret-test-jwt-key-256-bits-length!!",
    "jwt.expiration-ms=86400000"
})
class SecurityContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private SessionService sessionService;

    @RestController
    static class ProtectedDummyController {
        @GetMapping("/api/protected/resource")
        public ResponseEntity<Map<String, String>> protectedResource() {
            return ResponseEntity.ok(Map.of("message", "secret-data"));
        }

        @GetMapping("/api/health")
        public ResponseEntity<Map<String, String>> health() {
            return ResponseEntity.ok(Map.of("status", "UP"));
        }
    }

    @Test
    @DisplayName("Request without token returns 401 with UNAUTHENTICATED contract body")
    void missingToken_returns401WithContractBody() throws Exception {
        mockMvc.perform(get("/api/protected/resource"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
                .andExpect(jsonPath("$.message").value("Full authentication is required to access this resource"))
                .andExpect(jsonPath("$.path").value("/api/protected/resource"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")));
    }

    @Test
    @DisplayName("Request with invalid/garbage token returns 401 with UNAUTHENTICATED contract body")
    void invalidToken_returns401WithContractBody() throws Exception {
        mockMvc.perform(get("/api/protected/resource")
                        .header("Authorization", "Bearer invalid.malformed.token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
                .andExpect(jsonPath("$.message").value("Full authentication is required to access this resource"))
                .andExpect(jsonPath("$.path").value("/api/protected/resource"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")));
    }

    @Test
    @DisplayName("Public endpoint is accessible without token")
    void publicEndpoint_accessibleWithoutToken() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("Valid token accesses protected endpoint successfully")
    void validToken_accessesProtectedEndpoint() throws Exception {
        UUID sid = UUID.randomUUID();
        Instant now = Instant.now();
        Instant absExp = now.plusSeconds(3600);
        String token = jwtUtil.generateToken("developer@taskoura.com", sid, absExp);

        com.taskoura.entity.User user = com.taskoura.entity.User.builder()
                .id(UUID.randomUUID())
                .email("developer@taskoura.com")
                .name("Developer")
                .build();
        com.taskoura.entity.UserSession mockSession = com.taskoura.entity.UserSession.builder()
                .id(sid)
                .user(user)
                .createdAt(now)
                .lastActivityAt(now)
                .absoluteExpiresAt(absExp)
                .build();

        when(sessionService.getSession(sid)).thenReturn(Optional.of(mockSession));
        when(sessionService.validateSession(eq(mockSession), any())).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/protected/resource")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("secret-data"));
    }
}
