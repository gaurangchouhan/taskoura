package com.taskoura.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.config.SecurityConfig;
import com.taskoura.dto.ProjectMemberDtos.InviteMemberRequest;
import com.taskoura.dto.ProjectMemberDtos.ProjectMemberResponse;
import com.taskoura.dto.ProjectMemberDtos.UpdateRoleRequest;
import com.taskoura.exception.ConflictException;
import com.taskoura.exception.GlobalExceptionHandler;
import com.taskoura.exception.NotFoundException;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.JwtUtil;
import com.taskoura.service.ProjectMemberService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProjectMemberController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
    "jwt.secret=taskoura-super-secret-test-jwt-key-256-bits-length!!",
    "jwt.expiration-ms=86400000"
})
class ProjectMemberControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private ProjectMemberService projectMemberService;

    @Test
    @DisplayName("POST /api/projects/{projectId}/members: 201 Created on valid invite")
    void inviteMember_success() throws Exception {
        UUID projectId = UUID.randomUUID();
        UUID memberId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        InviteMemberRequest request = new InviteMemberRequest("jane@example.com", "Member");
        ProjectMemberResponse response = new ProjectMemberResponse(memberId, userId, "Jane Doe", "jane@example.com", "Member");

        when(projectMemberService.inviteMember(eq(projectId), any(InviteMemberRequest.class))).thenReturn(response);

        String token = jwtUtil.generateToken("owner@example.com");

        mockMvc.perform(post("/api/projects/{projectId}/members", projectId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(memberId.toString()))
                .andExpect(jsonPath("$.userEmail").value("jane@example.com"))
                .andExpect(jsonPath("$.role").value("Member"));
    }

    @Test
    @DisplayName("POST /api/projects/{projectId}/members: 404 when invited email does not exist")
    void inviteMember_userNotFound_returns404() throws Exception {
        UUID projectId = UUID.randomUUID();
        InviteMemberRequest request = new InviteMemberRequest("unknown@example.com", "Member");

        when(projectMemberService.inviteMember(eq(projectId), any(InviteMemberRequest.class)))
                .thenThrow(new NotFoundException("User with this email not found"));

        String token = jwtUtil.generateToken("owner@example.com");

        mockMvc.perform(post("/api/projects/{projectId}/members", projectId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("User with this email not found"));
    }

    @Test
    @DisplayName("POST /api/projects/{projectId}/members: 409 when user is already a member")
    void inviteMember_alreadyMember_returns409() throws Exception {
        UUID projectId = UUID.randomUUID();
        InviteMemberRequest request = new InviteMemberRequest("jane@example.com", "Member");

        when(projectMemberService.inviteMember(eq(projectId), any(InviteMemberRequest.class)))
                .thenThrow(new ConflictException("User is already a member of this project"));

        String token = jwtUtil.generateToken("owner@example.com");

        mockMvc.perform(post("/api/projects/{projectId}/members", projectId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("User is already a member of this project"));
    }

    @Test
    @DisplayName("GET /api/projects/{projectId}/members: 200 OK returns member list")
    void getMembers_success() throws Exception {
        UUID projectId = UUID.randomUUID();
        ProjectMemberResponse response = new ProjectMemberResponse(
                UUID.randomUUID(), UUID.randomUUID(), "Alice", "alice@example.com", "Owner"
        );

        when(projectMemberService.getMembers(projectId)).thenReturn(List.of(response));

        String token = jwtUtil.generateToken("alice@example.com");

        mockMvc.perform(get("/api/projects/{projectId}/members", projectId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].userEmail").value("alice@example.com"))
                .andExpect(jsonPath("$[0].role").value("Owner"));
    }

    @Test
    @DisplayName("PUT /api/projects/{projectId}/members/{userId}: 200 OK updates member role")
    void updateRole_success() throws Exception {
        UUID projectId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UpdateRoleRequest request = new UpdateRoleRequest("Owner");
        ProjectMemberResponse response = new ProjectMemberResponse(
                UUID.randomUUID(), userId, "Jane Doe", "jane@example.com", "Owner"
        );

        when(projectMemberService.updateRole(eq(projectId), eq(userId), any(UpdateRoleRequest.class))).thenReturn(response);

        String token = jwtUtil.generateToken("alice@example.com");

        mockMvc.perform(put("/api/projects/{projectId}/members/{userId}", projectId, userId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("Owner"));
    }

    @Test
    @DisplayName("DELETE /api/projects/{projectId}/members/{userId}: 204 No Content removes member")
    void removeMember_success() throws Exception {
        UUID projectId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        doNothing().when(projectMemberService).removeMember(projectId, userId);

        String token = jwtUtil.generateToken("alice@example.com");

        mockMvc.perform(delete("/api/projects/{projectId}/members/{userId}", projectId, userId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        verify(projectMemberService).removeMember(projectId, userId);
    }

    @Test
    @DisplayName("Member endpoints require authentication: 401 when missing token")
    void memberEndpoints_unauthenticated_returns401() throws Exception {
        UUID projectId = UUID.randomUUID();
        mockMvc.perform(get("/api/projects/{projectId}/members", projectId))
                .andExpect(status().isUnauthorized());
    }
}
