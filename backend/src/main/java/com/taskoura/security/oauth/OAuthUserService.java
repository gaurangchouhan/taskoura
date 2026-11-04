package com.taskoura.security.oauth;

import com.taskoura.entity.OAuthIdentity;
import com.taskoura.entity.User;
import com.taskoura.entity.UserProfile;
import com.taskoura.repository.OAuthIdentityRepository;
import com.taskoura.repository.UserProfileRepository;
import com.taskoura.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
public class OAuthUserService {

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final OAuthIdentityRepository oauthIdentityRepository;
    private final PasswordEncoder passwordEncoder;

    @Autowired
    public OAuthUserService(UserRepository userRepository,
                            UserProfileRepository userProfileRepository,
                            OAuthIdentityRepository oauthIdentityRepository,
                            @Autowired(required = false) PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.userProfileRepository = userProfileRepository;
        this.oauthIdentityRepository = oauthIdentityRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public enum LoginStatus {
        SUCCESS,
        ACCOUNT_EXISTS_USE_PASSWORD
    }

    public record LoginResult(LoginStatus status, User user) {
        public static LoginResult success(User user) {
            return new LoginResult(LoginStatus.SUCCESS, user);
        }

        public static LoginResult accountExistsUsePassword() {
            return new LoginResult(LoginStatus.ACCOUNT_EXISTS_USE_PASSWORD, null);
        }
    }

    public enum LinkStatus {
        SUCCESS,
        ALREADY_LINKED,
        IDENTITY_LINKED_TO_OTHER_ACCOUNT
    }

    @Transactional
    public LoginResult processOAuthLogin(String provider,
                                         String providerUserId,
                                         String email,
                                         String name,
                                         String avatarUrl,
                                         String githubUrl) {
        String normalizedEmail = email != null ? email.toLowerCase().trim() : null;

        // 1. Existing identity
        Optional<OAuthIdentity> existingIdentity =
                oauthIdentityRepository.findByProviderAndProviderUserId(provider, providerUserId);

        if (existingIdentity.isPresent()) {
            UUID userId = existingIdentity.get().getUserId();
            Optional<User> userOpt = userRepository.findById(userId);
            if (userOpt.isPresent()) {
                return LoginResult.success(userOpt.get());
            }
        }

        // 2. Existing user with same email (password required, linking prevented)
        if (normalizedEmail != null) {
            Optional<User> existingUser = userRepository.findByEmail(normalizedEmail);
            if (existingUser.isPresent()) {
                return LoginResult.accountExistsUsePassword();
            }
        }

        // 3. New user creation
        String safeName = (name != null && !name.isBlank())
                ? name.trim()
                : (normalizedEmail != null && normalizedEmail.contains("@")
                        ? normalizedEmail.substring(0, normalizedEmail.indexOf('@'))
                        : "User");

        String randomUnusableHash = passwordEncoder != null
                ? passwordEncoder.encode(UUID.randomUUID().toString())
                : "{bcrypt}" + UUID.randomUUID().toString();

        User newUser = User.builder()
                .name(safeName)
                .email(normalizedEmail)
                .passwordHash(randomUnusableHash)
                .verified(true)
                .passwordLoginEnabled(false)
                .createdAt(LocalDateTime.now())
                .build();

        User savedUser = userRepository.save(newUser);

        OAuthIdentity identity = OAuthIdentity.builder()
                .userId(savedUser.getId())
                .provider(provider)
                .providerUserId(providerUserId)
                .emailAtLink(normalizedEmail)
                .createdAt(LocalDateTime.now())
                .build();
        oauthIdentityRepository.save(identity);

        UserProfile profile = UserProfile.builder()
                .user(savedUser)
                .userId(savedUser.getId())
                .avatarUrl(avatarUrl)
                .githubUrl(githubUrl)
                .build();
        userProfileRepository.save(profile);

        return LoginResult.success(savedUser);
    }

    @Transactional
    public LinkStatus linkAccount(UUID userId, String provider, String providerUserId, String email) {
        Optional<OAuthIdentity> existingIdentity =
                oauthIdentityRepository.findByProviderAndProviderUserId(provider, providerUserId);

        if (existingIdentity.isPresent()) {
            if (existingIdentity.get().getUserId().equals(userId)) {
                return LinkStatus.ALREADY_LINKED;
            } else {
                return LinkStatus.IDENTITY_LINKED_TO_OTHER_ACCOUNT;
            }
        }

        Optional<OAuthIdentity> userProviderIdentity =
                oauthIdentityRepository.findByUserIdAndProvider(userId, provider);
        if (userProviderIdentity.isPresent()) {
            return LinkStatus.ALREADY_LINKED;
        }

        OAuthIdentity newIdentity = OAuthIdentity.builder()
                .userId(userId)
                .provider(provider)
                .providerUserId(providerUserId)
                .emailAtLink(email != null ? email.toLowerCase().trim() : "")
                .createdAt(LocalDateTime.now())
                .build();
        oauthIdentityRepository.save(newIdentity);

        return LinkStatus.SUCCESS;
    }
}

