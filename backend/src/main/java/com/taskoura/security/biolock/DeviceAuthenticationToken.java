package com.taskoura.security.biolock;

import com.taskoura.entity.BiolockDevice;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.Collections;

public class DeviceAuthenticationToken extends AbstractAuthenticationToken {

    private final BiolockDevice device;

    public DeviceAuthenticationToken(BiolockDevice device) {
        super(Collections.singletonList(new SimpleGrantedAuthority("ROLE_DEVICE")));
        this.device = device;
        setAuthenticated(true);
    }

    @Override
    public Object getCredentials() {
        return null;
    }

    @Override
    public Object getPrincipal() {
        return device;
    }

    public BiolockDevice getDevice() {
        return device;
    }
}
