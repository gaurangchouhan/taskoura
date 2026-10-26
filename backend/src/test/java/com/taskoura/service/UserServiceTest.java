package com.taskoura.service;

import com.taskoura.dto.ProfileDtos.*;
import com.taskoura.entity.User;
import com.taskoura.entity.UserProfile;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.exception.ValidationException;
import com.taskoura.repository.UserProfileRepository;
import com.taskoura.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.time.LocalDateTime;
import java.util.List;
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

    @Mock
    private UserProfileRepository userProfileRepository;

    @Mock
    private AttachmentStorageService attachmentStorageService;

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
    @DisplayName("getProfile: returns profile of existing user with defaults when no profile row")
    void getProfile_defaults() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(sampleUser));
        when(userProfileRepository.findById(userId)).thenReturn(Optional.empty());

        UserProfileResponse response = userService.getProfile("test@example.com");

        assertThat(response.id()).isEqualTo(userId);
        assertThat(response.name()).isEqualTo("Old Name");
        assertThat(response.email()).isEqualTo("test@example.com");
        assertThat(response.verified()).isTrue();
        assertThat(response.createdAt()).isNotNull();
        assertThat(response.profile()).isNotNull();
        assertThat(response.profile().phone()).isNull();
        assertThat(response.profile().phoneVerified()).isFalse();
        assertThat(response.profile().organization()).isNull();
        assertThat(response.profile().skills()).isEmpty();
        assertThat(response.profile().notificationPrefs().taskAssigned()).isTrue();
        assertThat(response.profile().notificationPrefs().statusChanges()).isFalse();
        assertThat(response.providers()).isEmpty();
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
        when(userProfileRepository.findById(userId)).thenReturn(Optional.empty());

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
    @DisplayName("updateProfileDetails: full replacement and success")
    void updateProfileDetails_success() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(sampleUser));
        when(userProfileRepository.findById(userId)).thenReturn(Optional.empty());
        when(userProfileRepository.save(any(UserProfile.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UpdateProfileDetailsRequest request = new UpdateProfileDetailsRequest(
                "+14155552671",
                "Taskoura Corp",
                "Engineering",
                "Lead Architect",
                2024,
                "https://github.com/alexdoe",
                "https://linkedin.com/in/alexdoe",
                "Building cool software",
                List.of("Java", "Spring Boot", "TypeScript"),
                "Asia/Kolkata",
                new NotificationPrefsDto(true, false, true, false, true)
        );

        when(userProfileRepository.findById(userId)).thenAnswer(inv -> Optional.of(
                UserProfile.builder()
                        .userId(userId)
                        .user(sampleUser)
                        .phone("+14155552671")
                        .organization("Taskoura Corp")
                        .department("Engineering")
                        .jobTitle("Lead Architect")
                        .graduationYear(2024)
                        .githubUrl("https://github.com/alexdoe")
                        .linkedinUrl("https://linkedin.com/in/alexdoe")
                        .bio("Building cool software")
                        .skills(List.of("Java", "Spring Boot", "TypeScript"))
                        .timeZone("Asia/Kolkata")
                        .prefTaskAssigned(true)
                        .prefDeadlineReminders(false)
                        .prefMentions(true)
                        .prefProjectInvites(false)
                        .prefStatusChanges(true)
                        .build()
        ));

        UserProfileResponse response = userService.updateProfileDetails("test@example.com", request);

        assertThat(response.profile().phone()).isEqualTo("+14155552671");
        assertThat(response.profile().organization()).isEqualTo("Taskoura Corp");
        assertThat(response.profile().skills()).containsExactly("Java", "Spring Boot", "TypeScript");
        assertThat(response.profile().timeZone()).isEqualTo("Asia/Kolkata");
        assertThat(response.profile().notificationPrefs().statusChanges()).isTrue();
    }

    @Test
    @DisplayName("updateProfileDetails: validation failure on invalid phone format")
    void updateProfileDetails_invalidPhone_throwsValidationException() {
        UpdateProfileDetailsRequest req = new UpdateProfileDetailsRequest(
                "invalid-phone", null, null, null, null, null, null, null, null, null, null
        );

        assertThatThrownBy(() -> userService.updateProfileDetails("test@example.com", req))
                .isInstanceOf(ValidationException.class)
                .satisfies(e -> {
                    ValidationException ve = (ValidationException) e;
                    assertThat(ve.getFieldErrors()).containsKey("phone");
                });
    }

    @Test
    @DisplayName("updateProfileDetails: validation failure on non-https GitHub url")
    void updateProfileDetails_invalidGithub_throwsValidationException() {
        UpdateProfileDetailsRequest req = new UpdateProfileDetailsRequest(
                null, null, null, null, null, "http://github.com/alex", null, null, null, null, null
        );

        assertThatThrownBy(() -> userService.updateProfileDetails("test@example.com", req))
                .isInstanceOf(ValidationException.class)
                .satisfies(e -> {
                    ValidationException ve = (ValidationException) e;
                    assertThat(ve.getFieldErrors()).containsKey("githubUrl");
                });
    }

    @Test
    @DisplayName("updateProfileDetails: validation failure on non-github host")
    void updateProfileDetails_invalidGithubHost_throwsValidationException() {
        UpdateProfileDetailsRequest req = new UpdateProfileDetailsRequest(
                null, null, null, null, null, "https://gitlab.com/alex", null, null, null, null, null
        );

        assertThatThrownBy(() -> userService.updateProfileDetails("test@example.com", req))
                .isInstanceOf(ValidationException.class)
                .satisfies(e -> {
                    ValidationException ve = (ValidationException) e;
                    assertThat(ve.getFieldErrors()).containsKey("githubUrl");
                });
    }

    @Test
    @DisplayName("updateProfileDetails: validation failure on invalid timeZone")
    void updateProfileDetails_invalidTimeZone_throwsValidationException() {
        UpdateProfileDetailsRequest req = new UpdateProfileDetailsRequest(
                null, null, null, null, null, null, null, null, null, "Invalid/TimeZone_ABC", null
        );

        assertThatThrownBy(() -> userService.updateProfileDetails("test@example.com", req))
                .isInstanceOf(ValidationException.class)
                .satisfies(e -> {
                    ValidationException ve = (ValidationException) e;
                    assertThat(ve.getFieldErrors()).containsKey("timeZone");
                });
    }

    @Test
    @DisplayName("uploadAvatar: rejects files larger than 2MB")
    void uploadAvatar_sizeExceeded_throwsValidationException() {
        byte[] large = new byte[3 * 1024 * 1024];
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", large);

        assertThatThrownBy(() -> userService.uploadAvatar("test@example.com", file))
                .isInstanceOf(ValidationException.class)
                .satisfies(e -> {
                    ValidationException ve = (ValidationException) e;
                    assertThat(ve.getFieldErrors()).containsKey("file");
                });
    }

    @Test
    @DisplayName("uploadAvatar: rejects unsupported file formats")
    void uploadAvatar_invalidFormat_throwsValidationException() {
        MockMultipartFile file = new MockMultipartFile("file", "avatar.pdf", "application/pdf", new byte[]{1, 2, 3});

        assertThatThrownBy(() -> userService.uploadAvatar("test@example.com", file))
                .isInstanceOf(ValidationException.class)
                .satisfies(e -> {
                    ValidationException ve = (ValidationException) e;
                    assertThat(ve.getFieldErrors()).containsKey("file");
                });
    }

    @Test
    @DisplayName("uploadAvatar: replaces existing avatar and deletes old image")
    void uploadAvatar_replacesPrevious() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(sampleUser));
        UserProfile existing = UserProfile.builder()
                .userId(userId)
                .user(sampleUser)
                .avatarUrl("https://res.cloudinary.com/test/image/upload/v1/old.png")
                .build();
        when(userProfileRepository.findById(userId)).thenReturn(Optional.of(existing));
        when(attachmentStorageService.uploadFile(any())).thenReturn("https://res.cloudinary.com/test/image/upload/v1/new.png");

        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", new byte[]{1, 2, 3});
        AvatarResponse response = userService.uploadAvatar("test@example.com", file);

        assertThat(response.avatarUrl()).isEqualTo("https://res.cloudinary.com/test/image/upload/v1/new.png");
        verify(attachmentStorageService).deleteFile("https://res.cloudinary.com/test/image/upload/v1/old.png");
        verify(userProfileRepository).save(existing);
        assertThat(existing.getAvatarUrl()).isEqualTo("https://res.cloudinary.com/test/image/upload/v1/new.png");
    }

    @Test
    @DisplayName("deleteAvatar: deletes existing avatar and resets to null")
    void deleteAvatar_success() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(sampleUser));
        UserProfile existing = UserProfile.builder()
                .userId(userId)
                .user(sampleUser)
                .avatarUrl("https://res.cloudinary.com/test/image/upload/v1/avatar.png")
                .build();
        when(userProfileRepository.findById(userId)).thenReturn(Optional.of(existing));

        userService.deleteAvatar("test@example.com");

        verify(attachmentStorageService).deleteFile("https://res.cloudinary.com/test/image/upload/v1/avatar.png");
        verify(userProfileRepository).save(existing);
        assertThat(existing.getAvatarUrl()).isNull();
    }
}
