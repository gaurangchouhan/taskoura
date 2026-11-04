package com.taskoura.controller;

import com.taskoura.dto.ProfileDtos.AvatarResponse;
import com.taskoura.dto.ProfileDtos.UpdateProfileDetailsRequest;
import com.taskoura.dto.ProfileDtos.UpdateProfileRequest;
import com.taskoura.dto.ProfileDtos.UserProfileResponse;
import com.taskoura.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getProfile(Authentication authentication) {
        return ResponseEntity.ok(userService.getProfile(authentication.getName()));
    }

    @PutMapping("/me")
    public ResponseEntity<UserProfileResponse> updateProfile(
            @RequestBody UpdateProfileRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(userService.updateProfile(authentication.getName(), request));
    }

    @PutMapping("/me/profile")
    public ResponseEntity<UserProfileResponse> updateProfileDetails(
            @RequestBody UpdateProfileDetailsRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(userService.updateProfileDetails(authentication.getName(), request));
    }

    @PostMapping("/me/avatar")
    public ResponseEntity<AvatarResponse> uploadAvatar(
            @RequestParam("file") MultipartFile file,
            Authentication authentication
    ) {
        return ResponseEntity.ok(userService.uploadAvatar(authentication.getName(), file));
    }

    @DeleteMapping("/me/avatar")
    public ResponseEntity<Void> deleteAvatar(Authentication authentication) {
        userService.deleteAvatar(authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/me/providers/{provider}")
    public ResponseEntity<Void> disconnectProvider(
            @PathVariable("provider") String provider,
            Authentication authentication
    ) {
        userService.disconnectProvider(authentication.getName(), provider);
        return ResponseEntity.noContent().build();
    }
}
