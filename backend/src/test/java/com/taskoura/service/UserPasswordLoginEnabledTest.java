package com.taskoura.service;

import com.taskoura.dto.AuthResponse;
import com.taskoura.dto.LoginRequest;
import com.taskoura.dto.RegisterRequest;
import com.taskoura.dto.ResetPasswordRequest;
import com.taskoura.entity.User;
import com.taskoura.exception.UnauthorizedException;
import com.taskoura.repository.UserRepository;
import com.taskoura.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserPasswordLoginEnabledTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private OtpService otpService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private SessionService sessionService;

    @Mock
    private EmailService emailService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                userRepository,
                otpService,
                passwordEncoder,
                jwtUtil,
                sessionService,
                emailService,
                null,
                null,
                null
        );
    }

    @Test
    @DisplayName("User entity defaults passwordLoginEnabled to true")
    void testUserEntityDefault() {
        User userFromBuilder = User.builder()
                .email("test@example.com")
                .name("Test User")
                .build();
        assertThat(userFromBuilder.isPasswordLoginEnabled()).isTrue();

        User userFromConstructor = new User();
        assertThat(userFromConstructor.isPasswordLoginEnabled()).isTrue();
    }

    @Test
    @DisplayName("Password registration explicitly persists passwordLoginEnabled as true")
    void testRegistration_SetsPasswordLoginEnabledTrue() {
        RegisterRequest request = new RegisterRequest("New User", "newuser@taskoura.dev", "SecurePassword123!");
        when(userRepository.existsByEmail("newuser@taskoura.dev")).thenReturn(false);
        when(passwordEncoder.encode("SecurePassword123!")).thenReturn("$2a$10$encodedHash");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        when(userRepository.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

        authService.register(request);

        User savedUser = captor.getValue();
        assertThat(savedUser.isPasswordLoginEnabled()).isTrue();
        assertThat(savedUser.getPasswordHash()).isEqualTo("$2a$10$encodedHash");
        assertThat(savedUser.isVerified()).isFalse();
        verify(otpService).generateAndSendOtp(savedUser);
    }

    @Test
    @DisplayName("Password login is rejected for OAuth-only accounts where passwordLoginEnabled is false")
    void testLogin_OAuthOnlyUser_ThrowsUnauthorized() {
        User oAuthUser = User.builder()
                .id(UUID.randomUUID())
                .name("OAuth User")
                .email("oauth@example.com")
                .passwordHash(null)
                .verified(true)
                .passwordLoginEnabled(false)
                .build();

        when(userRepository.findByEmail("oauth@example.com")).thenReturn(Optional.of(oAuthUser));

        LoginRequest request = new LoginRequest("oauth@example.com", "AttemptedPassword");

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Invalid credentials");

        verify(passwordEncoder, never()).matches(anyString(), anyString());
    }

    @Test
    @DisplayName("Password login is rejected when passwordHash is null, even if passwordLoginEnabled is somehow true")
    void testLogin_NullPasswordHash_ThrowsUnauthorized() {
        User userWithoutHash = User.builder()
                .id(UUID.randomUUID())
                .name("No Hash User")
                .email("nohash@example.com")
                .passwordHash(null)
                .verified(true)
                .passwordLoginEnabled(true)
                .build();

        when(userRepository.findByEmail("nohash@example.com")).thenReturn(Optional.of(userWithoutHash));

        LoginRequest request = new LoginRequest("nohash@example.com", "AttemptedPassword");

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Invalid credentials");

        verify(passwordEncoder, never()).matches(anyString(), anyString());
    }

    @Test
    @DisplayName("Resetting password activates passwordLoginEnabled = true and updates passwordHash")
    void testResetPassword_ActivatesPasswordLogin() {
        User oAuthUser = User.builder()
                .id(UUID.randomUUID())
                .name("OAuth User")
                .email("oauth@example.com")
                .passwordHash(null)
                .verified(true)
                .passwordLoginEnabled(false)
                .build();

        when(userRepository.findByEmail("oauth@example.com")).thenReturn(Optional.of(oAuthUser));
        when(otpService.verifyResetOtp(oAuthUser, "123456")).thenReturn(true);
        when(passwordEncoder.encode("BrandNewPassword123!")).thenReturn("$2a$10$newHashedPassword");

        ResetPasswordRequest request = new ResetPasswordRequest("oauth@example.com", "123456", "BrandNewPassword123!");
        authService.resetPassword(request);

        assertThat(oAuthUser.isPasswordLoginEnabled()).isTrue();
        assertThat(oAuthUser.getPasswordHash()).isEqualTo("$2a$10$newHashedPassword");
        verify(userRepository).save(oAuthUser);
        verify(sessionService).revokeAllUserSessions(oAuthUser.getId());
    }
}

