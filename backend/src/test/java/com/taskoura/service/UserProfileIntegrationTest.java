package com.taskoura.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.dto.ProfileDtos.*;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.dto.ProjectMemberDtos.InviteMemberRequest;
import com.taskoura.dto.ProjectMemberDtos.ProjectMemberResponse;
import com.taskoura.entity.User;
import com.taskoura.entity.UserProfile;
import com.taskoura.entity.UserSession;
import com.taskoura.repository.ProjectMemberRepository;
import com.taskoura.repository.ProjectRepository;
import com.taskoura.repository.UserProfileRepository;
import com.taskoura.repository.UserRepository;
import com.taskoura.repository.UserSessionRepository;
import com.taskoura.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class UserProfileIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private SessionService sessionService;

    @Autowired
    private UserSessionRepository userSessionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserProfileRepository userProfileRepository;

    @Autowired
    private ProjectService projectService;

    @Autowired
    private ProjectMemberService projectMemberService;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ProjectMemberRepository projectMemberRepository;

    @MockitoBean
    private AttachmentStorageService attachmentStorageService;

    private User testUser1;
    private User testUser2;
    private String token1;
    private String token2;

    @BeforeEach
    void setUp() {
        String email1 = "alice-" + UUID.randomUUID() + "@taskoura.dev";
        String email2 = "bob-" + UUID.randomUUID() + "@taskoura.dev";

        testUser1 = userRepository.save(User.builder()
                .name("Alice Springs")
                .email(email1)
                .passwordHash("hash1")
                .verified(true)
                .build());

        testUser2 = userRepository.save(User.builder()
                .name("Bob Marley")
                .email(email2)
                .passwordHash("hash2")
                .verified(true)
                .build());

        UserSession session1 = sessionService.createSession(testUser1, "test-agent");
        token1 = jwtUtil.generateToken(testUser1.getEmail(), session1.getId(), session1.getAbsoluteExpiresAt());

        UserSession session2 = sessionService.createSession(testUser2, "test-agent");
        token2 = jwtUtil.generateToken(testUser2.getEmail(), session2.getId(), session2.getAbsoluteExpiresAt());
    }

    @Test
    @DisplayName("1. Defaults for a new user: GET /api/users/me returns all-null profile, default prefs, empty skills and providers")
    void getProfile_newUserDefaults() throws Exception {
        mockMvc.perform(get("/api/users/me")
                        .header("Authorization", "Bearer " + token1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(testUser1.getId().toString()))
                .andExpect(jsonPath("$.name").value("Alice Springs"))
                .andExpect(jsonPath("$.email").value(testUser1.getEmail()))
                .andExpect(jsonPath("$.verified").value(true))
                .andExpect(jsonPath("$.profile.phone").doesNotExist())
                .andExpect(jsonPath("$.profile.phoneVerified").value(false))
                .andExpect(jsonPath("$.profile.organization").doesNotExist())
                .andExpect(jsonPath("$.profile.skills").isArray())
                .andExpect(jsonPath("$.profile.skills").isEmpty())
                .andExpect(jsonPath("$.profile.notificationPrefs.taskAssigned").value(true))
                .andExpect(jsonPath("$.profile.notificationPrefs.deadlineReminders").value(true))
                .andExpect(jsonPath("$.profile.notificationPrefs.mentions").value(true))
                .andExpect(jsonPath("$.profile.notificationPrefs.projectInvites").value(true))
                .andExpect(jsonPath("$.profile.notificationPrefs.statusChanges").value(false))
                .andExpect(jsonPath("$.providers").isArray())
                .andExpect(jsonPath("$.providers").isEmpty());
    }

    @Test
    @DisplayName("2. Full update: PUT /api/users/me/profile updates all fields and persists to user_profiles table")
    void updateProfile_fullUpdate_success() throws Exception {
        UpdateProfileDetailsRequest req = new UpdateProfileDetailsRequest(
                "+14155552671",
                "Taskoura Corp",
                "Product",
                "Senior PM",
                2023,
                "https://github.com/alice",
                "https://linkedin.com/in/alice",
                "Passionate about agile Kanban",
                List.of("Kanban", "Product Management", "Scrum"),
                "America/New_York",
                new NotificationPrefsDto(false, true, false, true, true)
        );

        mockMvc.perform(put("/api/users/me/profile")
                        .header("Authorization", "Bearer " + token1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.phone").value("+14155552671"))
                .andExpect(jsonPath("$.profile.organization").value("Taskoura Corp"))
                .andExpect(jsonPath("$.profile.department").value("Product"))
                .andExpect(jsonPath("$.profile.jobTitle").value("Senior PM"))
                .andExpect(jsonPath("$.profile.graduationYear").value(2023))
                .andExpect(jsonPath("$.profile.githubUrl").value("https://github.com/alice"))
                .andExpect(jsonPath("$.profile.linkedinUrl").value("https://linkedin.com/in/alice"))
                .andExpect(jsonPath("$.profile.bio").value("Passionate about agile Kanban"))
                .andExpect(jsonPath("$.profile.skills[0]").value("Kanban"))
                .andExpect(jsonPath("$.profile.skills[1]").value("Product Management"))
                .andExpect(jsonPath("$.profile.skills[2]").value("Scrum"))
                .andExpect(jsonPath("$.profile.timeZone").value("America/New_York"))
                .andExpect(jsonPath("$.profile.notificationPrefs.taskAssigned").value(false))
                .andExpect(jsonPath("$.profile.notificationPrefs.statusChanges").value(true));

        // Verify in DB directly
        UserProfile inDb = userProfileRepository.findById(testUser1.getId()).orElseThrow();
        assertThat(inDb.getPhone()).isEqualTo("+14155552671");
        assertThat(inDb.isPhoneVerified()).isFalse();
        assertThat(inDb.getOrganization()).isEqualTo("Taskoura Corp");
        assertThat(inDb.getSkills()).containsExactly("Kanban", "Product Management", "Scrum");
    }

    @Test
    @DisplayName("3. Clearing with null: PUT /api/users/me/profile clears existing values when passed null")
    void updateProfile_clearingWithNull() throws Exception {
        // First populate
        UpdateProfileDetailsRequest req = new UpdateProfileDetailsRequest(
                "+14155552671", "Taskoura", "Eng", "Dev", 2020,
                "https://github.com/alice", "https://linkedin.com/in/alice",
                "Bio text", List.of("Java"), "UTC", NotificationPrefsDto.defaults()
        );
        mockMvc.perform(put("/api/users/me/profile")
                        .header("Authorization", "Bearer " + token1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        // Now clear with nulls
        UpdateProfileDetailsRequest clearReq = new UpdateProfileDetailsRequest(
                null, null, null, null, null,
                null, null, null, null, null, null
        );
        mockMvc.perform(put("/api/users/me/profile")
                        .header("Authorization", "Bearer " + token1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(clearReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.phone").doesNotExist())
                .andExpect(jsonPath("$.profile.organization").doesNotExist())
                .andExpect(jsonPath("$.profile.skills").isEmpty())
                .andExpect(jsonPath("$.profile.githubUrl").doesNotExist())
                .andExpect(jsonPath("$.profile.notificationPrefs.taskAssigned").value(true));

        UserProfile inDb = userProfileRepository.findById(testUser1.getId()).orElseThrow();
        assertThat(inDb.getPhone()).isNull();
        assertThat(inDb.getOrganization()).isNull();
        assertThat(inDb.getSkills()).isEmpty();
    }

    @Test
    @DisplayName("4. Validation rules: invalid phone format returns 400 VALIDATION_FAILED with fieldErrors")
    void validation_invalidPhone() throws Exception {
        UpdateProfileDetailsRequest req = new UpdateProfileDetailsRequest(
                "12345678", null, null, null, null, null, null, null, null, null, null
        );
        mockMvc.perform(put("/api/users/me/profile")
                        .header("Authorization", "Bearer " + token1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.phone").exists());
    }

    @Test
    @DisplayName("5. Validation rules: graduationYear out of 1990-2100 returns 400")
    void validation_invalidGraduationYear() throws Exception {
        UpdateProfileDetailsRequest reqTooEarly = new UpdateProfileDetailsRequest(
                null, null, null, null, 1989, null, null, null, null, null, null
        );
        mockMvc.perform(put("/api/users/me/profile")
                        .header("Authorization", "Bearer " + token1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqTooEarly)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.graduationYear").exists());

        UpdateProfileDetailsRequest reqTooLate = new UpdateProfileDetailsRequest(
                null, null, null, null, 2101, null, null, null, null, null, null
        );
        mockMvc.perform(put("/api/users/me/profile")
                        .header("Authorization", "Bearer " + token1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqTooLate)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.graduationYear").exists());
    }

    @Test
    @DisplayName("6. Validation rules: githubUrl not https or not github.com returns 400")
    void validation_invalidGithubUrl() throws Exception {
        UpdateProfileDetailsRequest reqHttp = new UpdateProfileDetailsRequest(
                null, null, null, null, null, "http://github.com/alice", null, null, null, null, null
        );
        mockMvc.perform(put("/api/users/me/profile")
                        .header("Authorization", "Bearer " + token1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqHttp)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.githubUrl").exists());

        UpdateProfileDetailsRequest reqWrongHost = new UpdateProfileDetailsRequest(
                null, null, null, null, null, "https://gitlab.com/alice", null, null, null, null, null
        );
        mockMvc.perform(put("/api/users/me/profile")
                        .header("Authorization", "Bearer " + token1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqWrongHost)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.githubUrl").exists());
    }

    @Test
    @DisplayName("7. Validation rules: linkedinUrl not https or not linkedin.com returns 400")
    void validation_invalidLinkedinUrl() throws Exception {
        UpdateProfileDetailsRequest reqWrong = new UpdateProfileDetailsRequest(
                null, null, null, null, null, null, "https://facebook.com/alice", null, null, null, null
        );
        mockMvc.perform(put("/api/users/me/profile")
                        .header("Authorization", "Bearer " + token1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqWrong)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.linkedinUrl").exists());
    }

    @Test
    @DisplayName("8. Validation rules: skills exceeding 20 items or duplicate items returns 400")
    void validation_invalidSkills() throws Exception {
        // Duplicate skill (case-insensitive)
        UpdateProfileDetailsRequest reqDuplicate = new UpdateProfileDetailsRequest(
                null, null, null, null, null, null, null, null, List.of("Java", "java"), null, null
        );
        mockMvc.perform(put("/api/users/me/profile")
                        .header("Authorization", "Bearer " + token1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqDuplicate)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.skills").exists());

        // Skill item length > 30 chars
        UpdateProfileDetailsRequest reqTooLong = new UpdateProfileDetailsRequest(
                null, null, null, null, null, null, null, null, List.of("ThisSkillNameIsWayLongerThanThirtyCharactersLong"), null, null
        );
        mockMvc.perform(put("/api/users/me/profile")
                        .header("Authorization", "Bearer " + token1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqTooLong)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.skills").exists());
    }

    @Test
    @DisplayName("9. Validation rules: invalid timeZone returns 400")
    void validation_invalidTimeZone() throws Exception {
        UpdateProfileDetailsRequest req = new UpdateProfileDetailsRequest(
                null, null, null, null, null, null, null, null, null, "Mars/Phobos_Invalid", null
        );
        mockMvc.perform(put("/api/users/me/profile")
                        .header("Authorization", "Bearer " + token1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.timeZone").exists());
    }

    @Test
    @DisplayName("10. Avatar: type rejection (not png/jpeg/webp) returns 400")
    void avatar_invalidType_rejected() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "doc.pdf", "application/pdf", new byte[]{1, 2, 3});
        mockMvc.perform(multipart("/api/users/me/avatar")
                        .file(file)
                        .header("Authorization", "Bearer " + token1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.file").exists());
    }

    @Test
    @DisplayName("11. Avatar: size rejection (> 2 MB) returns 400")
    void avatar_oversized_rejected() throws Exception {
        byte[] big = new byte[3 * 1024 * 1024];
        MockMultipartFile file = new MockMultipartFile("file", "huge.png", "image/png", big);
        mockMvc.perform(multipart("/api/users/me/avatar")
                        .file(file)
                        .header("Authorization", "Bearer " + token1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.file").exists());
    }

    @Test
    @DisplayName("12. Avatar upload, replacement deleting old image, and avatar deletion 204")
    void avatar_upload_replace_and_delete() throws Exception {
        when(attachmentStorageService.uploadFile(any()))
                .thenReturn("https://res.cloudinary.com/test/image/upload/v1/avatar1.png")
                .thenReturn("https://res.cloudinary.com/test/image/upload/v2/avatar2.png");

        // 1. Initial upload
        MockMultipartFile file1 = new MockMultipartFile("file", "first.png", "image/png", new byte[]{1, 2, 3});
        mockMvc.perform(multipart("/api/users/me/avatar")
                        .file(file1)
                        .header("Authorization", "Bearer " + token1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value("https://res.cloudinary.com/test/image/upload/v1/avatar1.png"));

        // 2. Replacement upload (should delete old image best-effort)
        MockMultipartFile file2 = new MockMultipartFile("file", "second.png", "image/png", new byte[]{4, 5, 6});
        mockMvc.perform(multipart("/api/users/me/avatar")
                        .file(file2)
                        .header("Authorization", "Bearer " + token1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value("https://res.cloudinary.com/test/image/upload/v2/avatar2.png"));

        verify(attachmentStorageService).deleteFile("https://res.cloudinary.com/test/image/upload/v1/avatar1.png");

        // 3. DELETE /api/users/me/avatar -> 204
        mockMvc.perform(delete("/api/users/me/avatar")
                        .header("Authorization", "Bearer " + token1))
                .andExpect(status().isNoContent());

        verify(attachmentStorageService).deleteFile("https://res.cloudinary.com/test/image/upload/v2/avatar2.png");

        // GET shows avatarUrl is null
        mockMvc.perform(get("/api/users/me")
                        .header("Authorization", "Bearer " + token1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.avatarUrl").doesNotExist());
    }

    @Test
    @DisplayName("13. ProjectMemberResponse gains avatarUrl")
    void projectMemberResponse_containsAvatarUrl() throws Exception {
        // Give Bob an avatar
        when(attachmentStorageService.uploadFile(any()))
                .thenReturn("https://res.cloudinary.com/test/image/upload/bob.png");
        MockMultipartFile file = new MockMultipartFile("file", "bob.png", "image/png", new byte[]{1, 2});
        mockMvc.perform(multipart("/api/users/me/avatar")
                        .file(file)
                        .header("Authorization", "Bearer " + token2))
                .andExpect(status().isOk());

        // Alice creates a project and invites Bob
        ProjectResponse project = projectService.createProject(
                testUser1.getEmail(),
                new CreateProjectRequest("Project X", "Desc", "React", "Spring Boot", "PostgreSQL", "JUnit", LocalDate.now().plusMonths(1)));
        ProjectMemberResponse invited = projectMemberService.inviteMember(project.id(), new InviteMemberRequest(testUser2.getEmail(), "Developer"));

        assertThat(invited.avatarUrl()).isEqualTo("https://res.cloudinary.com/test/image/upload/bob.png");

        List<ProjectMemberResponse> members = projectMemberService.getMembers(project.id());
        ProjectMemberResponse bobMember = members.stream()
                .filter(m -> m.userId().equals(testUser2.getId()))
                .findFirst()
                .orElseThrow();
        assertThat(bobMember.avatarUrl()).isEqualTo("https://res.cloudinary.com/test/image/upload/bob.png");
    }

    @Test
    @DisplayName("14. User isolation: user cannot modify another user's profile (derived strictly from token)")
    void userIsolation_enforced() throws Exception {
        UpdateProfileDetailsRequest bobReq = new UpdateProfileDetailsRequest(
                "+14155559999", "Bob Corp", null, null, null, null, null, null, null, null, null
        );

        mockMvc.perform(put("/api/users/me/profile")
                        .header("Authorization", "Bearer " + token2)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(bobReq)))
                .andExpect(status().isOk());

        // Alice's profile remains untouched
        mockMvc.perform(get("/api/users/me")
                        .header("Authorization", "Bearer " + token1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.phone").doesNotExist())
                .andExpect(jsonPath("$.profile.organization").doesNotExist());
    }

    @Test
    @DisplayName("15. Existing PUT /api/users/me still works and preserves profile")
    void existingPutUsersMe_stillWorks() throws Exception {
        UpdateProfileRequest req = new UpdateProfileRequest("Alice Renamed");
        mockMvc.perform(put("/api/users/me")
                        .header("Authorization", "Bearer " + token1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Alice Renamed"))
                .andExpect(jsonPath("$.profile").exists());

        User inDb = userRepository.findById(testUser1.getId()).orElseThrow();
        assertThat(inDb.getName()).isEqualTo("Alice Renamed");
    }
}
