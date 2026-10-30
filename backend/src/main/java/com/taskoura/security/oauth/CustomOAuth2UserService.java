package com.taskoura.security.oauth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.*;

@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private static final Logger log = LoggerFactory.getLogger(CustomOAuth2UserService.class);

    private final RestClient restClient;

    public CustomOAuth2UserService() {
        this.restClient = RestClient.builder().build();
    }

    public CustomOAuth2UserService(RestClient restClient) {
        this.restClient = restClient != null ? restClient : RestClient.builder().build();
    }

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oauth2User = super.loadUser(userRequest);
        String registrationId = userRequest.getClientRegistration().getRegistrationId();

        if ("github".equalsIgnoreCase(registrationId)) {
            return processGitHubUser(userRequest, oauth2User);
        }

        return oauth2User;
    }

    private OAuth2User processGitHubUser(OAuth2UserRequest userRequest, OAuth2User oauth2User) {
        Map<String, Object> attributes = new HashMap<>(oauth2User.getAttributes());
        String token = userRequest.getAccessToken().getTokenValue();

        String verifiedEmail = null;
        boolean emailVerified = false;

        try {
            List<Map<String, Object>> emails = restClient.get()
                    .uri("https://api.github.com/user/emails")
                    .header("Authorization", "Bearer " + token)
                    .header("Accept", "application/vnd.github+json")
                    .header("User-Agent", "Taskoura-OAuth")
                    .retrieve()
                    .body(new ParameterizedTypeReference<List<Map<String, Object>>>() {});

            if (emails != null && !emails.isEmpty()) {
                // First pass: find verified && primary
                for (Map<String, Object> emailObj : emails) {
                    Boolean primary = Boolean.TRUE.equals(emailObj.get("primary"));
                    Boolean verified = Boolean.TRUE.equals(emailObj.get("verified"));
                    if (primary && verified) {
                        verifiedEmail = (String) emailObj.get("email");
                        emailVerified = true;
                        break;
                    }
                }
                // Second pass: if no primary verified, find any verified
                if (!emailVerified) {
                    for (Map<String, Object> emailObj : emails) {
                        Boolean verified = Boolean.TRUE.equals(emailObj.get("verified"));
                        if (verified) {
                            verifiedEmail = (String) emailObj.get("email");
                            emailVerified = true;
                            break;
                        }
                    }
                }
                // If emails found but none verified
                if (verifiedEmail == null && !emails.isEmpty()) {
                    verifiedEmail = (String) emails.get(0).get("email");
                    emailVerified = false;
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch verified primary email from GitHub /user/emails: {}", e.getMessage());
        }

        if (verifiedEmail == null) {
            Object attrEmail = attributes.get("email");
            if (attrEmail != null && !attrEmail.toString().isBlank()) {
                verifiedEmail = attrEmail.toString().trim();
                // If email attribute is provided from userinfo without /user/emails verification confirmation,
                // we treat as false unless confirmed
                emailVerified = false;
            }
        }

        if (verifiedEmail != null) {
            attributes.put("email", verifiedEmail);
        }
        attributes.put("email_verified", emailVerified);

        String userNameAttributeName = userRequest.getClientRegistration()
                .getProviderDetails().getUserInfoEndpoint().getUserNameAttributeName();
        if (userNameAttributeName == null || userNameAttributeName.isBlank()) {
            userNameAttributeName = "id";
        }

        var authorities = oauth2User.getAuthorities() != null && !oauth2User.getAuthorities().isEmpty()
                ? oauth2User.getAuthorities()
                : Collections.singleton(new SimpleGrantedAuthority("ROLE_USER"));

        return new DefaultOAuth2User(authorities, attributes, userNameAttributeName);
    }
}

