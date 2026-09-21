package com.taskoura.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.config.SecurityConfig;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.exception.GlobalExceptionHandler;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.JwtUtil;
import com.taskoura.service.ProjectService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProjectController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
    "jwt.secret=taskoura-super-secret-test-jwt-key-256-bits-length!!",
    "jwt.expiration-ms=86400000"
})
class ProjectControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private ProjectService projectService;

    @Test
    @DisplayName("POST /api/projects: 201 Created and ownerId matches logged-in user")
    void createProject_authenticated_success() throws Exception {
        String userEmail = "alex@example.com";
        UUID ownerId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        LocalDate deadline = LocalDate.now().plusMonths(2);

        CreateProjectRequest request = new CreateProjectRequest(
                "Taskoura Pro",
                "Project management platform",
                "React",
                "Spring Boot",
                "PostgreSQL",
                "JUnit",
                deadline
        );

        ProjectResponse response = new ProjectResponse(
                projectId,
                "Taskoura Pro",
                "Project management platform",
                ownerId,
                deadline
        );

        when(projectService.createProject(eq(userEmail), any(CreateProjectRequest.class))).thenReturn(response);

        String token = jwtUtil.generateToken(userEmail);

        mockMvc.perform(post("/api/projects")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(projectId.toString()))
                .andExpect(jsonPath("$.name").value("Taskoura Pro"))
                .andExpect(jsonPath("$.description").value("Project management platform"))
                .andExpect(jsonPath("$.ownerId").value(ownerId.toString()));

        verify(projectService).createProject(eq(userEmail), any(CreateProjectRequest.class));
    }

    @Test
    @DisplayName("GET /api/projects: lists only projects belonging to the authenticated user")
    void getProjects_authenticated_returnsUserProjects() throws Exception {
        String userEmail = "bob@example.com";
        UUID bobId = UUID.randomUUID();
        ProjectResponse bobProject = new ProjectResponse(
                UUID.randomUUID(),
                "Bob's Project",
                "Bob's desc",
                bobId,
                LocalDate.now().plusDays(15)
        );

        when(projectService.getProjectsForUser(userEmail)).thenReturn(List.of(bobProject));

        String token = jwtUtil.generateToken(userEmail);

        mockMvc.perform(get("/api/projects")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Bob's Project"))
                .andExpect(jsonPath("$[0].ownerId").value(bobId.toString()));

        verify(projectService).getProjectsForUser(userEmail);
    }

    @Test
    @DisplayName("GET /api/projects: different user sees only their own projects")
    void getProjects_differentUser_doesNotSeeOtherUsersProjects() throws Exception {
        String charlieEmail = "charlie@example.com";
        when(projectService.getProjectsForUser(charlieEmail)).thenReturn(List.of());

        String token = jwtUtil.generateToken(charlieEmail);

        mockMvc.perform(get("/api/projects")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(0));

        verify(projectService).getProjectsForUser(charlieEmail);
    }

    @Test
    @DisplayName("POST /api/projects: 401 when no Authorization header is provided")
    void createProject_unauthenticated_returns401() throws Exception {
        CreateProjectRequest request = new CreateProjectRequest(
                "Unauthorized Proj", "Desc", "React", "Spring", "PG", "JUnit", LocalDate.now()
        );

        mockMvc.perform(post("/api/projects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/projects: 401 when garbage token is provided")
    void createProject_garbageToken_returns401() throws Exception {
        CreateProjectRequest request = new CreateProjectRequest(
                "Unauthorized Proj", "Desc", "React", "Spring", "PG", "JUnit", LocalDate.now()
        );

        mockMvc.perform(post("/api/projects")
                        .header("Authorization", "Bearer garbage-token-12345")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/projects: 401 when no Authorization header is provided")
    void getProjects_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/projects"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/projects: 401 when garbage token is provided")
    void getProjects_garbageToken_returns401() throws Exception {
        mockMvc.perform(get("/api/projects")
                        .header("Authorization", "Bearer garbage-token-12345"))
                .andExpect(status().isUnauthorized());
    }
}
