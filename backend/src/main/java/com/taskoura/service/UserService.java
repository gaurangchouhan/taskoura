package com.taskoura.service;

import com.taskoura.dto.ProfileDtos.UpdateProfileRequest;
import com.taskoura.dto.ProfileDtos.UserProfileResponse;
import com.taskoura.entity.User;
import com.taskoura.exception.BadRequestException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UserProfileResponse getProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found"));
        return new UserProfileResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.isVerified(),
                user.getCreatedAt()
        );
    }

    public UserProfileResponse updateProfile(String email, UpdateProfileRequest request) {
        if (request == null || request.name() == null || request.name().trim().isEmpty()) {
            throw new BadRequestException("Name cannot be empty");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found"));

        user.setName(request.name().trim());
        User saved = userRepository.save(user);

        return new UserProfileResponse(
                saved.getId(),
                saved.getName(),
                saved.getEmail(),
                saved.isVerified(),
                saved.getCreatedAt()
        );
    }
}
