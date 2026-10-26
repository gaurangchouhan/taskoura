package com.taskoura.exception;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.test.context.TestPropertySource;

import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = GlobalExceptionHandlerTest.TestErrorController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({
    GlobalExceptionHandlerTest.TestErrorController.class,
    com.taskoura.config.SecurityConfig.class,
    com.taskoura.security.JwtAuthFilter.class,
    com.taskoura.security.JwtUtil.class,
    GlobalExceptionHandler.class
})
@TestPropertySource(properties = {
    "jwt.secret=taskoura-super-secret-test-jwt-key-256-bits-length!!",
    "jwt.expiration-ms=86400000"
})
class GlobalExceptionHandlerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    record ValidationDummy(@NotBlank(message = "Title is required") String title) {}

    @RestController
    static class TestErrorController {

        @GetMapping("/api/test/validation-error")
        public void throwBadRequest() {
            throw new BadRequestException("Invalid payload");
        }

        @PostMapping("/api/test/validation-body")
        public void validateBody(@Valid @RequestBody ValidationDummy body) {
            // No-op
        }

        @GetMapping("/api/test/unauthenticated")
        public void throwUnauthorized() {
            throw new UnauthorizedException("Authentication token is missing or invalid");
        }

        @GetMapping("/api/test/forbidden")
        public void throwForbidden() {
            throw new ForbiddenException("Access denied for this resource");
        }

        @GetMapping("/api/test/not-found")
        public void throwNotFound() {
            throw new NotFoundException("Task not found");
        }

        @GetMapping("/api/test/conflict")
        public void throwConflict() {
            throw new ConflictException("Project with name already exists");
        }

        @GetMapping("/api/test/illegal-state")
        public void throwIllegalState() {
            throw new IllegalStateException("Task is already in Completed state");
        }

        @GetMapping("/api/test/rate-limited")
        public void throwRateLimited() {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many requests, try again later");
        }

        @GetMapping("/api/test/ai-unavailable")
        public void throwBadGateway() {
            throw new BadGatewayException("AI service unavailable, try again");
        }

        @GetMapping("/api/test/otp-attempts-exceeded")
        public void throwOtpAttemptsExceeded() {
            throw new OtpAttemptsExceededException("Too many attempts. Request a new code.");
        }

        @GetMapping("/api/test/rate-limited-cooldown")
        public void throwRateLimitedCooldown() {
            throw new RateLimitedException("Please wait before requesting another code.", 25);
        }

        @GetMapping("/api/test/email-delivery-failed")
        public void throwEmailDeliveryFailed() {
            throw new EmailDeliveryException("We could not send the email. Please try again.");
        }

        @GetMapping("/api/test/internal-error")
        public void throwUnexpected() {
            throw new RuntimeException("Null pointer in secret DB query");
        }
    }

    @Test
    @DisplayName("Validation error via MethodArgumentNotValid produces contract shape with fieldErrors and VALIDATION_FAILED code")
    void testValidationBody_producesFieldErrors() throws Exception {
        ValidationDummy invalid = new ValidationDummy("");

        mockMvc.perform(post("/api/test/validation-body")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.message").value("Title is required"))
                .andExpect(jsonPath("$.path").value("/api/test/validation-body"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")))
                .andExpect(jsonPath("$.fieldErrors.title").value("Title is required"));
    }

    @Test
    @DisplayName("UnauthorizedException produces 401 UNAUTHENTICATED contract body")
    void testUnauthorized_producesContractBody() throws Exception {
        mockMvc.perform(get("/api/test/unauthenticated"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
                .andExpect(jsonPath("$.message").value("Authentication token is missing or invalid"))
                .andExpect(jsonPath("$.path").value("/api/test/unauthenticated"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")));
    }

    @Test
    @DisplayName("ForbiddenException produces 403 FORBIDDEN contract body")
    void testForbidden_producesContractBody() throws Exception {
        mockMvc.perform(get("/api/test/forbidden"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.error").value("Forbidden"))
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("Access denied for this resource"))
                .andExpect(jsonPath("$.path").value("/api/test/forbidden"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")));
    }

    @Test
    @DisplayName("NotFoundException produces 404 NOT_FOUND contract body")
    void testNotFound_producesContractBody() throws Exception {
        mockMvc.perform(get("/api/test/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Task not found"))
                .andExpect(jsonPath("$.path").value("/api/test/not-found"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")));
    }

    @Test
    @DisplayName("ConflictException produces 409 CONFLICT contract body")
    void testConflict_producesContractBody() throws Exception {
        mockMvc.perform(get("/api/test/conflict"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.code").value("CONFLICT"))
                .andExpect(jsonPath("$.message").value("Project with name already exists"))
                .andExpect(jsonPath("$.path").value("/api/test/conflict"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")));
    }

    @Test
    @DisplayName("IllegalStateException produces 409 CONFLICT preserving existing mapping")
    void testIllegalState_producesContractBody() throws Exception {
        mockMvc.perform(get("/api/test/illegal-state"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.code").value("CONFLICT"))
                .andExpect(jsonPath("$.message").value("Task is already in Completed state"))
                .andExpect(jsonPath("$.path").value("/api/test/illegal-state"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")));
    }

    @Test
    @DisplayName("429 Too Many Requests produces RATE_LIMITED code")
    void testRateLimited_producesContractBody() throws Exception {
        mockMvc.perform(get("/api/test/rate-limited"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"))
                .andExpect(jsonPath("$.message").value("Too many requests, try again later"))
                .andExpect(jsonPath("$.path").value("/api/test/rate-limited"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")));
    }

    @Test
    @DisplayName("BadGatewayException produces 502 AI_UNAVAILABLE contract body")
    void testAiUnavailable_producesContractBody() throws Exception {
        mockMvc.perform(get("/api/test/ai-unavailable"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.status").value(502))
                .andExpect(jsonPath("$.error").value("Bad Gateway"))
                .andExpect(jsonPath("$.code").value("AI_UNAVAILABLE"))
                .andExpect(jsonPath("$.message").value("AI service unavailable, try again"))
                .andExpect(jsonPath("$.path").value("/api/test/ai-unavailable"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")));
    }

    @Test
    @DisplayName("OtpAttemptsExceededException produces 400 OTP_ATTEMPTS_EXCEEDED contract body")
    void testOtpAttemptsExceeded_producesContractBody() throws Exception {
        mockMvc.perform(get("/api/test/otp-attempts-exceeded"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.code").value("OTP_ATTEMPTS_EXCEEDED"))
                .andExpect(jsonPath("$.message").value("Too many attempts. Request a new code."))
                .andExpect(jsonPath("$.path").value("/api/test/otp-attempts-exceeded"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")));
    }

    @Test
    @DisplayName("RateLimitedException produces 429 RATE_LIMITED contract body with retryAfterSeconds")
    void testRateLimited_producesContractBodyWithRetryAfter() throws Exception {
        mockMvc.perform(get("/api/test/rate-limited-cooldown"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.error").value("Too Many Requests"))
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"))
                .andExpect(jsonPath("$.message").value("Please wait before requesting another code."))
                .andExpect(jsonPath("$.retryAfterSeconds").value(25))
                .andExpect(jsonPath("$.path").value("/api/test/rate-limited-cooldown"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")));
    }

    @Test
    @DisplayName("EmailDeliveryException produces 502 EMAIL_DELIVERY_FAILED contract body")
    void testEmailDeliveryFailed_producesContractBody() throws Exception {
        mockMvc.perform(get("/api/test/email-delivery-failed"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.status").value(502))
                .andExpect(jsonPath("$.error").value("Bad Gateway"))
                .andExpect(jsonPath("$.code").value("EMAIL_DELIVERY_FAILED"))
                .andExpect(jsonPath("$.message").value("We could not send the email. Please try again."))
                .andExpect(jsonPath("$.path").value("/api/test/email-delivery-failed"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")));
    }

    @Test
    @DisplayName("Unexpected exception produces 500 INTERNAL with generic message and no stack trace in response")
    void testUnexpected_producesInternalWithoutStackTrace() throws Exception {
        mockMvc.perform(get("/api/test/internal-error"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.error").value("Internal Server Error"))
                .andExpect(jsonPath("$.code").value("INTERNAL"))
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"))
                .andExpect(jsonPath("$.message").value(not("Null pointer in secret DB query")))
                .andExpect(jsonPath("$.stackTrace").doesNotExist())
                .andExpect(jsonPath("$.trace").doesNotExist())
                .andExpect(jsonPath("$.path").value("/api/test/internal-error"))
                .andExpect(jsonPath("$.timestamp").value(endsWith("Z")));
    }
}
