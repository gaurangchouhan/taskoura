package com.taskoura.security;

import com.taskoura.dto.AuthResponse;
import com.taskoura.dto.LoginRequest;
import com.taskoura.entity.User;
import com.taskoura.entity.UserSession;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.exception.UnauthorizedException;
import com.taskoura.repository.UserRepository;
import com.taskoura.service.AuthService;
import com.taskoura.service.SessionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthenticationManagerFlowTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private SessionService sessionService;

    @Mock
    private JwtUtil jwtUtil;

    private PasswordEncoder passwordEncoder;
    private CustomUserDetailsService userDetailsService;
    private DaoAuthenticationProvider daoAuthenticationProvider;
    private AuthenticationManager authenticationManager;
    private AuthService authService;

    private User sampleUser;
    private final String rawPassword = "CorrectPassword123!";

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder();
        userDetailsService = new CustomUserDetailsService(userRepository);

        daoAuthenticationProvider = new DaoAuthenticationProvider();
        daoAuthenticationProvider.setUserDetailsService(userDetailsService);
        daoAuthenticationProvider.setPasswordEncoder(passwordEncoder);

        // ProviderManager without parent to ensure no delegator loop can ever occur
        authenticationManager = new ProviderManager(daoAuthenticationProvider);

        authService = new AuthService(
                userRepository,
                null,
                passwordEncoder,
                jwtUtil,
                sessionService,
                authenticationManager,
                null,
                null,
                null,
                null
        );

        sampleUser = User.builder()
                .id(UUID.randomUUID())
                .name("Gaurang Developer")
                .email("gaurang@taskoura.dev")
                .passwordHash(passwordEncoder.encode(rawPassword))
                .passwordLoginEnabled(true)
                .verified(true)
                .build();
    }

    @Test
    @DisplayName("UserDetailsService: loads user by email successfully")
    void userDetailsService_loadsUserSuccessfully() {
        when(userRepository.findByEmail("gaurang@taskoura.dev")).thenReturn(Optional.of(sampleUser));

        UserDetails userDetails = userDetailsService.loadUserByUsername("gaurang@taskoura.dev");

        assertThat(userDetails.getUsername()).isEqualTo("gaurang@taskoura.dev");
        assertThat(passwordEncoder.matches(rawPassword, userDetails.getPassword())).isTrue();
        assertThat(userDetails.getAuthorities()).extracting("authority").containsExactly("ROLE_USER");
    }

    @Test
    @DisplayName("UserDetailsService: rejects OAuth-only user (passwordLoginEnabled = false)")
    void userDetailsService_rejectsOAuthOnlyUser() {
        sampleUser.setPasswordLoginEnabled(false);
        when(userRepository.findByEmail("gaurang@taskoura.dev")).thenReturn(Optional.of(sampleUser));

        assertThatThrownBy(() -> userDetailsService.loadUserByUsername("gaurang@taskoura.dev"))
                .isInstanceOf(UsernameNotFoundException.class)
                .hasMessageContaining("Password login disabled");
    }

    @Test
    @DisplayName("UserDetailsService: throws UsernameNotFoundException for non-existent email")
    void userDetailsService_userNotFound() {
        when(userRepository.findByEmail("unknown@taskoura.dev")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userDetailsService.loadUserByUsername("unknown@taskoura.dev"))
                .isInstanceOf(UsernameNotFoundException.class);
    }

    @Test
    @DisplayName("AuthenticationManager: successfully authenticates valid credentials via DaoAuthenticationProvider")
    void authenticationManager_authenticatesSuccessfully() {
        when(userRepository.findByEmail("gaurang@taskoura.dev")).thenReturn(Optional.of(sampleUser));

        Authentication result = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken("gaurang@taskoura.dev", rawPassword)
        );

        assertThat(result.isAuthenticated()).isTrue();
        assertThat(result.getName()).isEqualTo("gaurang@taskoura.dev");
    }

    @Test
    @DisplayName("AuthenticationManager: throws BadCredentialsException on wrong password without recursion")
    void authenticationManager_wrongPassword_throwsBadCredentialsWithoutRecursion() {
        when(userRepository.findByEmail("gaurang@taskoura.dev")).thenReturn(Optional.of(sampleUser));

        assertThatThrownBy(() -> authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken("gaurang@taskoura.dev", "WrongPassword!")
        )).isInstanceOf(BadCredentialsException.class);
    }

    @Test
    @DisplayName("AuthenticationManager: throws BadCredentialsException on unknown email without recursion")
    void authenticationManager_unknownUser_throwsBadCredentialsWithoutRecursion() {
        when(userRepository.findByEmail("nobody@taskoura.dev")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken("nobody@taskoura.dev", "AnyPassword!")
        )).isInstanceOf(BadCredentialsException.class);
    }

    @Test
    @DisplayName("AuthService.login: full flow using AuthenticationManager produces AuthResponse")
    void authServiceLogin_successFlow() {
        when(userRepository.findByEmail("gaurang@taskoura.dev")).thenReturn(Optional.of(sampleUser));

        UserSession mockSession = UserSession.builder()
                .id(UUID.randomUUID())
                .user(sampleUser)
                .createdAt(Instant.now())
                .lastActivityAt(Instant.now())
                .absoluteExpiresAt(Instant.now().plusSeconds(3600))
                .build();

        when(sessionService.createSession(eq(sampleUser), any())).thenReturn(mockSession);
        when(jwtUtil.generateToken(eq("gaurang@taskoura.dev"), eq(mockSession.getId()), any()))
                .thenReturn("valid-signed-jwt");
        when(sessionService.buildSessionInfo(eq(mockSession))).thenReturn(
                new com.taskoura.dto.SessionInfoResponse(1800, 120, "2026-10-25T12:00:00Z", "2026-10-25T18:00:00Z", "2026-10-25T11:30:00Z")
        );

        AuthResponse response = authService.login(new LoginRequest("gaurang@taskoura.dev", rawPassword));

        assertThat(response.token()).isEqualTo("valid-signed-jwt");
        assertThat(response.user().email()).isEqualTo("gaurang@taskoura.dev");
        assertThat(response.user().name()).isEqualTo("Gaurang Developer");
    }

    @Test
    @DisplayName("AuthService.login: throws UnauthorizedException on incorrect password")
    void authServiceLogin_wrongPassword_throwsUnauthorized() {
        when(userRepository.findByEmail("gaurang@taskoura.dev")).thenReturn(Optional.of(sampleUser));

        assertThatThrownBy(() -> authService.login(new LoginRequest("gaurang@taskoura.dev", "BadPassword!")))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Invalid credentials");
    }

    @Test
    @DisplayName("AuthService.login: throws ForbiddenException if user is not verified")
    void authServiceLogin_unverifiedUser_throwsForbidden() {
        sampleUser.setVerified(false);
        when(userRepository.findByEmail("gaurang@taskoura.dev")).thenReturn(Optional.of(sampleUser));

        assertThatThrownBy(() -> authService.login(new LoginRequest("gaurang@taskoura.dev", rawPassword)))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Please verify your email before logging in");
    }
}

