package com.taskoura.service;

import com.taskoura.dto.ProfileDtos.UpdateProfileRequest;
import com.taskoura.dto.ProfileDtos.UserProfileResponse;
import com.taskoura.entity.User;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    private User sampleUser;
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        sampleUser = User.builder()
                .id(userId)
                .name("Old Name")
                .email("test@example.com")
                .verified(true)
                .createdAt(LocalDateTime.now().minusDays(1))
                .build();
    }

    @Test
    @DisplayName("getProfile: returns profile of existing user")
    void getProfile_success() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(sampleUser));

        UserProfileResponse response = userService.getProfile("test@example.com");

        assertThat(response.id()).isEqualTo(userId);
        assertThat(response.name()).isEqualTo("Old Name");
        assertThat(response.email()).isEqualTo("test@example.com");
        assertThat(response.verified()).isTrue();
        assertThat(response.createdAt()).isNotNull();
    }

    @Test
    @DisplayName("getProfile: non-existent user throws NotFoundException")
    void getProfile_notFound() {
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getProfile("unknown@example.com"))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("User not found");
    }

    @Test
    @DisplayName("updateProfile: successfully updates user's name")
    void updateProfile_success() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(sampleUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UpdateProfileRequest request = new UpdateProfileRequest("New Name");
        UserProfileResponse response = userService.updateProfile("test@example.com", request);

        assertThat(response.name()).isEqualTo("New Name");
        assertThat(sampleUser.getName()).isEqualTo("New Name");
        verify(userRepository).save(sampleUser);
    }

    @Test
    @DisplayName("updateProfile: blank name throws BadRequestException")
    void updateProfile_blankName_throwsBadRequest() {
        UpdateProfileRequest emptyName = new UpdateProfileRequest("   ");
        assertThatThrownBy(() -> userService.updateProfile("test@example.com", emptyName))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Name cannot be empty");

        UpdateProfileRequest nullName = new UpdateProfileRequest(null);
        assertThatThrownBy(() -> userService.updateProfile("test@example.com", nullName))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Name cannot be empty");
    }

    @Test
    @DisplayName("updateProfile: non-existent user throws NotFoundException")
    void updateProfile_userNotFound_throwsNotFound() {
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        UpdateProfileRequest request = new UpdateProfileRequest("New Name");
        assertThatThrownBy(() -> userService.updateProfile("unknown@example.com", request))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("User not found");
    }
}
