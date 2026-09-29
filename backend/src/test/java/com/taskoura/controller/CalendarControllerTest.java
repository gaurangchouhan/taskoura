package com.taskoura.controller;

import com.taskoura.config.SecurityConfig;
import com.taskoura.dto.CalendarDtos.*;
import com.taskoura.exception.GlobalExceptionHandler;
import com.taskoura.security.JwtAuthFilter;
import com.taskoura.security.JwtUtil;
import com.taskoura.service.CalendarService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CalendarController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
    "jwt.secret=taskoura-super-secret-test-jwt-key-256-bits-length!!",
    "jwt.expiration-ms=86400000"
})
class CalendarControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private CalendarService calendarService;

    @Test
    @DisplayName("GET /api/projects/{projectId}/calendar: 200 OK with calendar days")
    void getCalendar_success() throws Exception {
        UUID projectId = UUID.randomUUID();
        String token = jwtUtil.generateToken("user@test.com");

        CalendarResponse response = new CalendarResponse(
                LocalDate.of(2026, 12, 1),
                List.of(new CalendarDayResponse(
                        LocalDate.of(2026, 9, 15),
                        List.of(new CalendarTaskItem(UUID.randomUUID(), "Task 1", "InProgress", "High", UUID.randomUUID(), "Alice"))
                ))
        );

        when(calendarService.getCalendar(projectId, "2026-09")).thenReturn(response);

        mockMvc.perform(get("/api/projects/{projectId}/calendar", projectId)
                        .param("month", "2026-09")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projectDeadline").value("2026-12-01"))
                .andExpect(jsonPath("$.days[0].date").value("2026-09-15"))
                .andExpect(jsonPath("$.days[0].tasks[0].title").value("Task 1"))
                .andExpect(jsonPath("$.days[0].tasks[0].assignedToName").value("Alice"));
    }

    @Test
    @DisplayName("GET /api/projects/{projectId}/deadlines/upcoming: 200 OK with upcoming tasks")
    void getUpcomingDeadlines_success() throws Exception {
        UUID projectId = UUID.randomUUID();
        String token = jwtUtil.generateToken("user@test.com");

        UpcomingDeadlineResponse item = new UpcomingDeadlineResponse(
                UUID.randomUUID(), "Due Soon", LocalDate.now().plusDays(2),
                "InProgress", "High", "Bob", 2
        );

        when(calendarService.getUpcomingDeadlines(projectId, 7)).thenReturn(List.of(item));

        mockMvc.perform(get("/api/projects/{projectId}/deadlines/upcoming", projectId)
                        .param("withinDays", "7")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Due Soon"))
                .andExpect(jsonPath("$[0].daysRemaining").value(2))
                .andExpect(jsonPath("$[0].assignedToName").value("Bob"));
    }
}
