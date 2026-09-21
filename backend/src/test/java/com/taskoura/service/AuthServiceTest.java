package com.taskoura.service;

import com.taskoura.dto.AuthResponse;
import com.taskoura.dto.LoginRequest;
import com.taskoura.dto.MessageResponse;
import com.taskoura.dto.RegisterRequest;
import com.taskoura.dto.ResendOtpRequest;
import com.taskoura.dto.VerifyOtpRequest;
import com.taskoura.entity.User;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.ConflictException;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.exception.UnauthorizedException;
import com.taskoura.repository.UserRepository;
import com.taskoura.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private OtpService otpService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtil jwtUtil;

    @InjectMocks
    private AuthService authService;

    private User sampleUser;

    @BeforeEach
    void setUp() {
        sampleUser = User.builder()
                .id(UUID.randomUUID())
                .name("Alex Doe")
                .email("alex@example.com")
                .passwordHash("encoded_hash")
                .verified(false)
                .build();
    }

    @Test
    @DisplayName("register: creates unverified user and sends OTP")
    void register_success() {
        RegisterRequest request = new RegisterRequest("Alex Doe", "alex@example.com", "Password123!");
        when(userRepository.existsByEmail("alex@example.com")).thenReturn(false);
        when(passwordEncoder.encode("Password123!")).thenReturn("encoded_hash");
        when(userRepository.save(any(User.class))).thenReturn(sampleUser);

        MessageResponse response = authService.register(request);

        assertThat(response.message()).contains("OTP sent to email");
        verify(userRepository).save(any(User.class));
        verify(otpService).generateAndSendOtp(sampleUser);
    }

    @Test
    @DisplayName("register: duplicate email throws ConflictException")
    void register_duplicateEmail_throwsConflict() {
        RegisterRequest request = new RegisterRequest("Alex Doe", "alex@example.com", "Password123!");
        when(userRepository.existsByEmail("alex@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Email already registered");

        verify(userRepository, never()).save(any());
        verify(otpService, never()).generateAndSendOtp(any());
    }

    @Test
    @DisplayName("verifyOtp: valid OTP marks user verified")
    void verifyOtp_success() {
        VerifyOtpRequest request = new VerifyOtpRequest("alex@example.com", "1234");
        when(userRepository.findByEmail("alex@example.com")).thenReturn(Optional.of(sampleUser));
        when(otpService.verifyOtp(sampleUser, "1234")).thenReturn(true);

        MessageResponse response = authService.verifyOtp(request);

        assertThat(response.message()).contains("Account verified");
        verify(otpService).verifyOtp(sampleUser, "1234");
    }

    @Test
    @DisplayName("verifyOtp: invalid or expired OTP throws BadRequestException")
    void verifyOtp_invalidOtp_throwsBadRequest() {
        VerifyOtpRequest request = new VerifyOtpRequest("alex@example.com", "9999");
        when(userRepository.findByEmail("alex@example.com")).thenReturn(Optional.of(sampleUser));
        when(otpService.verifyOtp(sampleUser, "9999")).thenReturn(false);

        assertThatThrownBy(() -> authService.verifyOtp(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Invalid or expired OTP");
    }

    @Test
    @DisplayName("verifyOtp: user not found throws NotFoundException")
    void verifyOtp_userNotFound_throwsNotFound() {
        VerifyOtpRequest request = new VerifyOtpRequest("nonexistent@example.com", "1234");
        when(userRepository.findByEmail("nonexistent@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.verifyOtp(request))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("User not found");
    }

    @Test
    @DisplayName("resendOtp: successfully sends new OTP for unverified user")
    void resendOtp_success() {
        ResendOtpRequest request = new ResendOtpRequest("alex@example.com");
        sampleUser.setVerified(false);
        when(userRepository.findByEmail("alex@example.com")).thenReturn(Optional.of(sampleUser));

        MessageResponse response = authService.resendOtp(request);

        assertThat(response.message()).isEqualTo("OTP resent");
        verify(otpService).generateAndSendOtp(sampleUser);
    }

    @Test
    @DisplayName("resendOtp: already verified user throws ConflictException")
    void resendOtp_alreadyVerified_throwsConflict() {
        ResendOtpRequest request = new ResendOtpRequest("alex@example.com");
        sampleUser.setVerified(true);
        when(userRepository.findByEmail("alex@example.com")).thenReturn(Optional.of(sampleUser));

        assertThatThrownBy(() -> authService.resendOtp(request))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Account already verified");

        verify(otpService, never()).generateAndSendOtp(any());
    }

    @Test
    @DisplayName("login: valid credentials and verified user returns JWT")
    void login_success() {
        LoginRequest request = new LoginRequest("alex@example.com", "Password123!");
        sampleUser.setVerified(true);
        when(userRepository.findByEmail("alex@example.com")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("Password123!", "encoded_hash")).thenReturn(true);
        when(jwtUtil.generateToken("alex@example.com")).thenReturn("mock-jwt-token");

        AuthResponse response = authService.login(request);

        assertThat(response.token()).isEqualTo("mock-jwt-token");
        assertThat(response.user().email()).isEqualTo("alex@example.com");
        assertThat(response.user().name()).isEqualTo("Alex Doe");
    }

    @Test
    @DisplayName("login: unknown email throws UnauthorizedException")
    void login_userNotFound_throwsUnauthorized() {
        LoginRequest request = new LoginRequest("unknown@example.com", "Password123!");
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Invalid credentials");
    }

    @Test
    @DisplayName("login: incorrect password throws UnauthorizedException")
    void login_wrongPassword_throwsUnauthorized() {
        LoginRequest request = new LoginRequest("alex@example.com", "WrongPassword");
        when(userRepository.findByEmail("alex@example.com")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("WrongPassword", "encoded_hash")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Invalid credentials");
    }

    @Test
    @DisplayName("login: unverified user throws ForbiddenException")
    void login_unverified_throwsForbidden() {
        LoginRequest request = new LoginRequest("alex@example.com", "Password123!");
        sampleUser.setVerified(false);
        when(userRepository.findByEmail("alex@example.com")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("Password123!", "encoded_hash")).thenReturn(true);

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Please verify your email before logging in");
    }
}
