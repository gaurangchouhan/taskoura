package com.taskoura.dto;

import java.util.UUID;

public class ProjectMemberDtos {

    public record InviteMemberRequest(String email, String role) {}

    public record UpdateRoleRequest(String role) {}

    public record ProjectMemberResponse(
            UUID id,
            UUID userId,
            String userName,
            String userEmail,
            String role
    ) {}
}