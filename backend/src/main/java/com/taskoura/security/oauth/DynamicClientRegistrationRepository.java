package com.taskoura.security.oauth;

import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;

import java.util.*;

public class DynamicClientRegistrationRepository implements ClientRegistrationRepository, Iterable<ClientRegistration> {

    private final Map<String, ClientRegistration> registrations;

    public DynamicClientRegistrationRepository(List<ClientRegistration> clientRegistrations) {
        Map<String, ClientRegistration> map = new LinkedHashMap<>();
        if (clientRegistrations != null) {
            for (ClientRegistration reg : clientRegistrations) {
                if (reg != null) {
                    map.put(reg.getRegistrationId().toLowerCase(), reg);
                }
            }
        }
        this.registrations = Collections.unmodifiableMap(map);
    }

    @Override
    public ClientRegistration findByRegistrationId(String registrationId) {
        if (registrationId == null) {
            return null;
        }
        return registrations.get(registrationId.toLowerCase());
    }

    @Override
    public Iterator<ClientRegistration> iterator() {
        return registrations.values().iterator();
    }

    public boolean isProviderConfigured(String provider) {
        if (provider == null) {
            return false;
        }
        return registrations.containsKey(provider.toLowerCase());
    }

    public List<String> getConfiguredProviderKeys() {
        return new ArrayList<>(registrations.keySet());
    }
}

