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
        ACCOUNT_EXISTS_USE_PASSWORD,
        ACCOUNT_EXISTS_UNVERIFIED
    }

    public record LoginResult(LoginStatus status, User user, boolean autoLinked) {
        public static LoginResult success(User user) {
            return new LoginResult(LoginStatus.SUCCESS, user, false);
        }

        public static LoginResult success(User user, boolean autoLinked) {
            return new LoginResult(LoginStatus.SUCCESS, user, autoLinked);
        }

        public static LoginResult accountExistsUsePassword() {
            return new LoginResult(LoginStatus.ACCOUNT_EXISTS_USE_PASSWORD, null, false);
        }

        public static LoginResult accountExistsUnverified() {
            return new LoginResult(LoginStatus.ACCOUNT_EXISTS_UNVERIFIED, null, false);
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
                                         String githubUrl,
                                         boolean emailVerified,
                                         boolean autoLinkVerifiedEmail) {
        String normalizedEmail = email != null ? email.toLowerCase().trim() : null;

        // 1. Existing identity
        Optional<OAuthIdentity> existingIdentity =
                oauthIdentityRepository.findByProviderAndProviderUserId(provider, providerUserId);

        if (existingIdentity.isPresent()) {
            UUID userId = existingIdentity.get().getUserId();
            Optional<User> userOpt = userRepository.findById(userId);
            if (userOpt.isPresent()) {
                return LoginResult.success(userOpt.get(), false);
            }
        }

        // 2. Existing user with same email
        if (normalizedEmail != null) {
            Optional<User> existingUserOpt = userRepository.findByEmail(normalizedEmail);
            if (existingUserOpt.isPresent()) {
                User existingUser = existingUserOpt.get();
                if (!existingUser.isVerified()) {
                    return LoginResult.accountExistsUnverified();
                }

                if (autoLinkVerifiedEmail && emailVerified) {
                    // Automatic linking
                    OAuthIdentity identity = OAuthIdentity.builder()
                            .userId(existingUser.getId())
                            .provider(provider)
                            .providerUserId(providerUserId)
                            .emailAtLink(normalizedEmail)
                            .createdAt(LocalDateTime.now())
                            .build();
                    oauthIdentityRepository.save(identity);

                    // Prefill empty profile details
                    userProfileRepository.findById(existingUser.getId()).ifPresent(profile -> {
                        boolean changed = false;
                        if ((profile.getAvatarUrl() == null || profile.getAvatarUrl().isBlank())
                                && avatarUrl != null && !avatarUrl.isBlank()) {
                            profile.setAvatarUrl(avatarUrl);
                            changed = true;
                        }
                        if ("github".equalsIgnoreCase(provider)
                                && (profile.getGithubUrl() == null || profile.getGithubUrl().isBlank())
                                && githubUrl != null && !githubUrl.isBlank()) {
                            profile.setGithubUrl(githubUrl);
                            changed = true;
                        }
                        if (changed) {
                            userProfileRepository.save(profile);
                        }
                    });

                    return LoginResult.success(existingUser, true);
                }

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
                .emailAtLink(normalizedEmail != null ? normalizedEmail : "")
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

        return LoginResult.success(savedUser, false);
    }

    @Transactional
    public LoginResult processOAuthLogin(String provider,
                                         String providerUserId,
                                         String email,
                                         String name,
                                         String avatarUrl,
                                         String githubUrl) {
        return processOAuthLogin(provider, providerUserId, email, name, avatarUrl, githubUrl, true, true);
    }

    @Transactional
    public LinkStatus linkAccount(UUID userId,
                                  String provider,
                                  String providerUserId,
                                  String email,
                                  String avatarUrl,
                                  String githubUrl) {
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

        userProfileRepository.findById(userId).ifPresent(profile -> {
            boolean changed = false;
            if ((profile.getAvatarUrl() == null || profile.getAvatarUrl().isBlank())
                    && avatarUrl != null && !avatarUrl.isBlank()) {
                profile.setAvatarUrl(avatarUrl);
                changed = true;
            }
            if ("github".equalsIgnoreCase(provider)
                    && (profile.getGithubUrl() == null || profile.getGithubUrl().isBlank())
                    && githubUrl != null && !githubUrl.isBlank()) {
                profile.setGithubUrl(githubUrl);
                changed = true;
            }
            if (changed) {
                userProfileRepository.save(profile);
            }
        });

        return LinkStatus.SUCCESS;
    }

    @Transactional
    public LinkStatus linkAccount(UUID userId, String provider, String providerUserId, String email) {
        return linkAccount(userId, provider, providerUserId, email, null, null);
    }
}
