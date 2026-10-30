package com.taskoura.security.oauth;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

public class CustomOAuth2AuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

    private final DefaultOAuth2AuthorizationRequestResolver defaultResolver;
    private final ClientRegistrationRepository clientRegistrationRepository;

    public CustomOAuth2AuthorizationRequestResolver(ClientRegistrationRepository clientRegistrationRepository) {
        this.defaultResolver = new DefaultOAuth2AuthorizationRequestResolver(clientRegistrationRepository, "/oauth2/authorization");
        this.clientRegistrationRepository = clientRegistrationRepository;
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        String registrationId = resolveRegistrationId(request);
        if (registrationId != null && clientRegistrationRepository.findByRegistrationId(registrationId) == null) {
            throw new OAuth2AuthenticationException(new OAuth2Error("PROVIDER_DISABLED", "Provider is not configured or disabled", null));
        }
        return defaultResolver.resolve(request);
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
        if (clientRegistrationId != null && clientRegistrationRepository.findByRegistrationId(clientRegistrationId) == null) {
            throw new OAuth2AuthenticationException(new OAuth2Error("PROVIDER_DISABLED", "Provider is not configured or disabled", null));
        }
        return defaultResolver.resolve(request, clientRegistrationId);
    }

    private String resolveRegistrationId(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri != null && uri.startsWith("/oauth2/authorization/")) {
            String sub = uri.substring("/oauth2/authorization/".length());
            int slashIdx = sub.indexOf('/');
            return slashIdx != -1 ? sub.substring(0, slashIdx) : sub;
        }
        return null;
    }
}

