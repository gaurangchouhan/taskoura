package com.taskoura.security;

import com.taskoura.entity.User;
import com.taskoura.repository.UserRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        if (email == null || email.isBlank()) {
            throw new UsernameNotFoundException("Email cannot be empty");
        }

        User user = userRepository.findByEmail(email)
                .or(() -> userRepository.findByEmail(email.trim().toLowerCase()))
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + email));

        if (!user.isPasswordLoginEnabled() || user.getPasswordHash() == null) {
            throw new UsernameNotFoundException("Password login disabled for this account");
        }

        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getEmail())
                .password(user.getPasswordHash())
                .authorities(Collections.singleton(new SimpleGrantedAuthority("ROLE_USER")))
                .build();
    }
}

