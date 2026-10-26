package com.taskoura.service;

import com.taskoura.dto.ProfileDtos.*;
import com.taskoura.entity.User;
import com.taskoura.entity.UserProfile;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.exception.ValidationException;
import com.taskoura.repository.UserProfileRepository;
import com.taskoura.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.time.ZoneId;
import java.util.*;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final AttachmentStorageService attachmentStorageService;

    public UserService(
            UserRepository userRepository,
            UserProfileRepository userProfileRepository,
            @Autowired(required = false) AttachmentStorageService attachmentStorageService
    ) {
        this.userRepository = userRepository;
        this.userProfileRepository = userProfileRepository;
        this.attachmentStorageService = attachmentStorageService;
    }

    public UserProfileResponse getProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found"));

        UserProfile profile = userProfileRepository.findById(user.getId()).orElse(null);
        ProfileDataDto profileData = toProfileData(profile);

        return new UserProfileResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.isVerified(),
                user.getCreatedAt(),
                profileData,
                Collections.emptyList()
        );
    }

    @Transactional
    public UserProfileResponse updateProfile(String email, UpdateProfileRequest request) {
        if (request == null || request.name() == null || request.name().trim().isEmpty()) {
            throw new BadRequestException("Name cannot be empty");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found"));

        user.setName(request.name().trim());
        userRepository.save(user);

        return getProfile(email);
    }

    @Transactional
    public UserProfileResponse updateProfileDetails(String email, UpdateProfileDetailsRequest request) {
        if (request == null) {
            throw new BadRequestException("Request body cannot be null");
        }

        Map<String, String> fieldErrors = new LinkedHashMap<>();

        // 1. Phone validation: optional, E.164 format (+ and 8 to 15 digits)
        String phone = null;
        if (request.phone() != null && !request.phone().isBlank()) {
            String p = request.phone().trim();
            if (!p.matches("^\\+[0-9]{8,15}$")) {
                fieldErrors.put("phone", "Phone number must be in E.164 format (+ and 8 to 15 digits)");
            } else {
                phone = p;
            }
        }

        // 2. Organization: 0-120
        String organization = null;
        if (request.organization() != null) {
            if (request.organization().length() > 120) {
                fieldErrors.put("organization", "Organization must not exceed 120 characters");
            } else if (!request.organization().isBlank()) {
                organization = request.organization().trim();
            }
        }

        // 3. Department: 0-120
        String department = null;
        if (request.department() != null) {
            if (request.department().length() > 120) {
                fieldErrors.put("department", "Department must not exceed 120 characters");
            } else if (!request.department().isBlank()) {
                department = request.department().trim();
            }
        }

        // 4. Job Title: 0-120
        String jobTitle = null;
        if (request.jobTitle() != null) {
            if (request.jobTitle().length() > 120) {
                fieldErrors.put("jobTitle", "Job title must not exceed 120 characters");
            } else if (!request.jobTitle().isBlank()) {
                jobTitle = request.jobTitle().trim();
            }
        }

        // 5. Graduation Year: 1990-2100 or null
        Integer graduationYear = request.graduationYear();
        if (graduationYear != null) {
            if (graduationYear < 1990 || graduationYear > 2100) {
                fieldErrors.put("graduationYear", "Graduation year must be between 1990 and 2100 or null");
            }
        }

        // 6. GitHub URL: must be https on github.com
        String githubUrl = null;
        if (request.githubUrl() != null && !request.githubUrl().isBlank()) {
            String gh = request.githubUrl().trim();
            try {
                URI uri = new URI(gh);
                if (!"https".equalsIgnoreCase(uri.getScheme())) {
                    fieldErrors.put("githubUrl", "GitHub URL must use HTTPS protocol");
                } else {
                    String host = uri.getHost();
                    if (host == null || (!host.equalsIgnoreCase("github.com") && !host.equalsIgnoreCase("www.github.com"))) {
                        fieldErrors.put("githubUrl", "GitHub URL must be on github.com");
                    } else {
                        githubUrl = gh;
                    }
                }
            } catch (Exception e) {
                fieldErrors.put("githubUrl", "GitHub URL must be a valid URL");
            }
        }

        // 7. LinkedIn URL: https on linkedin.com
        String linkedinUrl = null;
        if (request.linkedinUrl() != null && !request.linkedinUrl().isBlank()) {
            String li = request.linkedinUrl().trim();
            try {
                URI uri = new URI(li);
                if (!"https".equalsIgnoreCase(uri.getScheme())) {
                    fieldErrors.put("linkedinUrl", "LinkedIn URL must use HTTPS protocol");
                } else {
                    String host = uri.getHost();
                    if (host == null || (!host.equalsIgnoreCase("linkedin.com") && !host.equalsIgnoreCase("www.linkedin.com") && !host.toLowerCase().endsWith(".linkedin.com"))) {
                        fieldErrors.put("linkedinUrl", "LinkedIn URL must be on linkedin.com");
                    } else {
                        linkedinUrl = li;
                    }
                }
            } catch (Exception e) {
                fieldErrors.put("linkedinUrl", "LinkedIn URL must be a valid URL");
            }
        }

        // 8. Bio: 0-500
        String bio = null;
        if (request.bio() != null) {
            if (request.bio().length() > 500) {
                fieldErrors.put("bio", "Bio must not exceed 500 characters");
            } else if (!request.bio().isBlank()) {
                bio = request.bio().trim();
            }
        }

        // 9. Skills: up to 20 items of 1-30 characters (trimmed, no duplicates)
        List<String> trimmedSkills = new ArrayList<>();
        if (request.skills() != null) {
            if (request.skills().size() > 20) {
                fieldErrors.put("skills", "Skills cannot contain more than 20 items");
            }
            Set<String> seen = new HashSet<>();
            for (String s : request.skills()) {
                if (s == null || s.trim().isEmpty()) {
                    fieldErrors.put("skills", "Skill item cannot be empty");
                    break;
                }
                String trimmed = s.trim();
                if (trimmed.length() > 30) {
                    fieldErrors.put("skills", "Each skill must not exceed 30 characters");
                    break;
                }
                if (!seen.add(trimmed.toLowerCase())) {
                    fieldErrors.put("skills", "Skills must not contain duplicate items");
                    break;
                }
                trimmedSkills.add(trimmed);
            }
        }

        // 10. TimeZone: a valid IANA id (validate with ZoneId.of)
        String timeZone = null;
        if (request.timeZone() != null && !request.timeZone().isBlank()) {
            String tz = request.timeZone().trim();
            try {
                ZoneId.of(tz);
                timeZone = tz;
            } catch (Exception e) {
                fieldErrors.put("timeZone", "Time zone must be a valid IANA identifier");
            }
        }

        if (!fieldErrors.isEmpty()) {
            throw new ValidationException("Validation failed", fieldErrors);
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found"));

        UserProfile profile = userProfileRepository.findById(user.getId())
                .orElseGet(() -> UserProfile.builder().user(user).userId(user.getId()).build());

        // Full replacement: null clears a value
        profile.setPhone(phone);
        profile.setPhoneVerified(false);
        profile.setOrganization(organization);
        profile.setDepartment(department);
        profile.setJobTitle(jobTitle);
        profile.setGraduationYear(graduationYear);
        profile.setGithubUrl(githubUrl);
        profile.setLinkedinUrl(linkedinUrl);
        profile.setBio(bio);
        profile.setSkills(trimmedSkills);
        profile.setTimeZone(timeZone);

        // Notification preferences replacement
        if (request.notificationPrefs() != null) {
            profile.setPrefTaskAssigned(request.notificationPrefs().taskAssigned());
            profile.setPrefDeadlineReminders(request.notificationPrefs().deadlineReminders());
            profile.setPrefMentions(request.notificationPrefs().mentions());
            profile.setPrefProjectInvites(request.notificationPrefs().projectInvites());
            profile.setPrefStatusChanges(request.notificationPrefs().statusChanges());
        } else {
            profile.setPrefTaskAssigned(true);
            profile.setPrefDeadlineReminders(true);
            profile.setPrefMentions(true);
            profile.setPrefProjectInvites(true);
            profile.setPrefStatusChanges(false);
        }

        userProfileRepository.save(profile);

        return getProfile(email);
    }

    @Transactional
    public AvatarResponse uploadAvatar(String email, MultipartFile file) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();

        if (file == null || file.isEmpty()) {
            fieldErrors.put("file", "Avatar file is required");
        } else {
            if (file.getSize() > 2 * 1024 * 1024) {
                fieldErrors.put("file", "Avatar file size must not exceed 2 MB");
            }

            String contentType = file.getContentType();
            String filename = file.getOriginalFilename();
            boolean validMime = false;
            if (contentType != null) {
                String ct = contentType.toLowerCase().trim();
                if (ct.equals("image/png") || ct.equals("image/jpeg") || ct.equals("image/jpg") || ct.equals("image/webp")) {
                    validMime = true;
                }
            }
            if (!validMime && filename != null) {
                String fn = filename.toLowerCase().trim();
                if (fn.endsWith(".png") || fn.endsWith(".jpeg") || fn.endsWith(".jpg") || fn.endsWith(".webp")) {
                    validMime = true;
                }
            }
            if (!validMime) {
                fieldErrors.put("file", "Avatar must be a PNG, JPEG, or WebP image");
            }
        }

        if (!fieldErrors.isEmpty()) {
            throw new ValidationException("Validation failed", fieldErrors);
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found"));

        UserProfile profile = userProfileRepository.findById(user.getId())
                .orElseGet(() -> UserProfile.builder().user(user).userId(user.getId()).build());

        // Delete previous Cloudinary image (best-effort, never fails the request)
        String previousAvatarUrl = profile.getAvatarUrl();
        if (previousAvatarUrl != null && !previousAvatarUrl.isBlank() && attachmentStorageService != null) {
            try {
                attachmentStorageService.deleteFile(previousAvatarUrl);
            } catch (Exception e) {
                log.warn("Best-effort deletion of previous avatar failed: {}", e.getMessage());
            }
        }

        if (attachmentStorageService == null) {
            throw new BadRequestException("Storage service is not configured");
        }

        String newAvatarUrl = attachmentStorageService.uploadFile(file);
        profile.setAvatarUrl(newAvatarUrl);
        userProfileRepository.save(profile);

        return new AvatarResponse(newAvatarUrl);
    }

    @Transactional
    public void deleteAvatar(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found"));

        UserProfile profile = userProfileRepository.findById(user.getId()).orElse(null);
        if (profile != null && profile.getAvatarUrl() != null) {
            String previousAvatarUrl = profile.getAvatarUrl();
            if (attachmentStorageService != null && !previousAvatarUrl.isBlank()) {
                try {
                    attachmentStorageService.deleteFile(previousAvatarUrl);
                } catch (Exception e) {
                    log.warn("Best-effort deletion of avatar failed: {}", e.getMessage());
                }
            }
            profile.setAvatarUrl(null);
            userProfileRepository.save(profile);
        }
    }

    private ProfileDataDto toProfileData(UserProfile profile) {
        if (profile == null) {
            return ProfileDataDto.defaults();
        }

        return new ProfileDataDto(
                profile.getPhone(),
                false, // phoneVerified is always false
                profile.getOrganization(),
                profile.getDepartment(),
                profile.getJobTitle(),
                profile.getGraduationYear(),
                profile.getGithubUrl(),
                profile.getLinkedinUrl(),
                profile.getBio(),
                profile.getSkills() != null ? new ArrayList<>(profile.getSkills()) : Collections.emptyList(),
                profile.getTimeZone(),
                profile.getAvatarUrl(),
                new NotificationPrefsDto(
                        profile.isPrefTaskAssigned(),
                        profile.isPrefDeadlineReminders(),
                        profile.isPrefMentions(),
                        profile.isPrefProjectInvites(),
                        profile.isPrefStatusChanges()
                )
        );
    }
}
