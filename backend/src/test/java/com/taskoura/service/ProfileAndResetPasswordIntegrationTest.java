package com.taskoura.service;

import com.taskoura.dto.AuthResponse;
import com.taskoura.dto.ForgotPasswordRequest;
import com.taskoura.dto.LoginRequest;
import com.taskoura.dto.MessageResponse;
import com.taskoura.dto.ProfileDtos.UpdateProfileRequest;
import com.taskoura.dto.ProfileDtos.UserProfileResponse;
import com.taskoura.dto.ResetPasswordRequest;
import com.taskoura.entity.User;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.UnauthorizedException;
import com.taskoura.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ProfileAndResetPasswordIntegrationTest {

    @Autowired private UserService userService;
    @Autowired private AuthService authService;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @MockitoBean private JavaMailSender mailSender;

    private User verifiedUser;
    private User unverifiedUser;
    private final String rawPassword = "OldPassword123!";

    @BeforeEach
    void setUp() {
        verifiedUser = userRepository.save(User.builder()
                .name("Verified Alex")
                .email("alex-" + UUID.randomUUID() + "@example.com")
                .passwordHash(passwordEncoder.encode(rawPassword))
                .verified(true)
                .build());

        unverifiedUser = userRepository.save(User.builder()
                .name("Unverified Bob")
                .email("bob-" + UUID.randomUUID() + "@example.com")
                .passwordHash(passwordEncoder.encode(rawPassword))
                .verified(false)
                .build());
    }

    @Test
    @DisplayName("Profile: getProfile returns current user's data")
    void testGetProfile() {
        UserProfileResponse profile = userService.getProfile(verifiedUser.getEmail());
        assertThat(profile.id()).isEqualTo(verifiedUser.getId());
        assertThat(profile.name()).isEqualTo("Verified Alex");
        assertThat(profile.email()).isEqualTo(verifiedUser.getEmail());
        assertThat(profile.verified()).isTrue();
        assertThat(profile.createdAt()).isNotNull();
    }

    @Test
    @DisplayName("Profile: updateProfile updates and persists user's name")
    void testUpdateProfile() {
        UserProfileResponse updated = userService.updateProfile(verifiedUser.getEmail(), new UpdateProfileRequest("Alex Updated"));
        assertThat(updated.name()).isEqualTo("Alex Updated");

        User persisted = userRepository.findById(verifiedUser.getId()).orElseThrow();
        assertThat(persisted.getName()).isEqualTo("Alex Updated");
    }

    @Test
    @DisplayName("Forgot password: unverified account is rejected with 400")
    void testForgotPassword_unverifiedAccount_rejected() {
        assertThatThrownBy(() -> authService.forgotPassword(new ForgotPasswordRequest(unverifiedUser.getEmail())))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Account is not verified. Please verify your email first.");
    }

    @Test
    @DisplayName("Forgot password: anti-enumeration check returns identical message for registered vs non-existent email")
    void testForgotPassword_antiEnumeration() {
        MessageResponse registeredResp = authService.forgotPassword(new ForgotPasswordRequest(verifiedUser.getEmail()));
        MessageResponse nonExistentResp = authService.forgotPassword(new ForgotPasswordRequest("nonexistent-" + UUID.randomUUID() + "@example.com"));

        assertThat(registeredResp.message()).isEqualTo("If an account exists with that email, a password reset code has been sent.");
        assertThat(nonExistentResp.message()).isEqualTo(registeredResp.message());
    }

    @Test
    @DisplayName("Full reset flow: request reset OTP -> reset password -> login with new pass succeeds -> old pass rejected")
    void testFullPasswordResetFlow() {
        // 1. Request reset OTP
        authService.forgotPassword(new ForgotPasswordRequest(verifiedUser.getEmail()));

        User userAfterOtp = userRepository.findById(verifiedUser.getId()).orElseThrow();
        String generatedOtp = userAfterOtp.getResetOtpCode();
        assertThat(generatedOtp).isNotNull().hasSize(4);
        assertThat(userAfterOtp.getResetOtpExpiresAt()).isAfter(LocalDateTime.now());

        // 2. Reset password with generated OTP
        String newPassword = "NewSecretPassword123!";
        MessageResponse resetResponse = authService.resetPassword(
                new ResetPasswordRequest(verifiedUser.getEmail(), generatedOtp, newPassword)
        );
        assertThat(resetResponse.message()).isEqualTo("Password reset successfully. You can now log in with your new password.");

        // Confirm OTP fields are cleared
        User userAfterReset = userRepository.findById(verifiedUser.getId()).orElseThrow();
        assertThat(userAfterReset.getResetOtpCode()).isNull();
        assertThat(userAfterReset.getResetOtpExpiresAt()).isNull();

        // 3. Login with new password succeeds
        AuthResponse loginSuccess = authService.login(new LoginRequest(verifiedUser.getEmail(), newPassword));
        assertThat(loginSuccess.token()).isNotBlank();
        assertThat(loginSuccess.user().email()).isEqualTo(verifiedUser.getEmail());

        // 4. Login with old password fails
        assertThatThrownBy(() -> authService.login(new LoginRequest(verifiedUser.getEmail(), rawPassword)))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Invalid credentials");
    }

    @Test
    @DisplayName("Reset password: wrong or expired OTP returns 400 Bad Request")
    void testResetPassword_invalidOrExpiredOtp() {
        authService.forgotPassword(new ForgotPasswordRequest(verifiedUser.getEmail()));

        // Wrong OTP
        assertThatThrownBy(() -> authService.resetPassword(
                new ResetPasswordRequest(verifiedUser.getEmail(), "000000", "someNewPass")))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Invalid or expired reset code");

        // Expired OTP
        User user = userRepository.findById(verifiedUser.getId()).orElseThrow();
        user.setResetOtpExpiresAt(LocalDateTime.now().minusMinutes(1));
        userRepository.save(user);

        assertThatThrownBy(() -> authService.resetPassword(
                new ResetPasswordRequest(verifiedUser.getEmail(), user.getResetOtpCode(), "someNewPass")))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Invalid or expired reset code");
    }
}
