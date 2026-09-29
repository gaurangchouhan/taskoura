package com.taskoura.service;

import com.taskoura.dto.CalendarDtos.CalendarDayResponse;
import com.taskoura.dto.CalendarDtos.CalendarResponse;
import com.taskoura.dto.CalendarDtos.UpcomingDeadlineResponse;
import com.taskoura.dto.ProjectDtos.CreateProjectRequest;
import com.taskoura.dto.ProjectDtos.ProjectResponse;
import com.taskoura.dto.TaskDtos.CreateTaskRequest;
import com.taskoura.dto.TaskDtos.TaskResponse;
import com.taskoura.dto.TaskDtos.UpdateTaskStatusRequest;
import com.taskoura.entity.User;
import com.taskoura.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class CalendarIntegrationTest {

    @Autowired private CalendarService calendarService;
    @Autowired private ProjectService projectService;
    @Autowired private TaskService taskService;
    @Autowired private UserRepository userRepository;

    private User owner;
    private ProjectResponse project;

    @BeforeEach
    void setUp() {
        owner = userRepository.save(User.builder()
                .name("Calendar Owner")
                .email("cal-owner-" + UUID.randomUUID() + "@test.com")
                .passwordHash("pass")
                .verified(true)
                .build());

        project = projectService.createProject(owner.getEmail(),
                new CreateProjectRequest("Calendar Test Project", "Dedicated calendar tests",
                        "React", "Spring Boot", "PostgreSQL", "JUnit 5", LocalDate.of(2026, 12, 31)));
    }

    @Test
    @DisplayName("Calendar: month filter returns only tasks in that month grouped by date")
    void testCalendarMonthFilterAndGrouping() {
        // Create 2 tasks in Sept 2026 (one on 2026-09-15, one on 2026-09-20)
        taskService.createTask(project.id(), new CreateTaskRequest(
                "Sept Task 1", "desc", "Backend", "High", owner.getId(), LocalDate.of(2026, 9, 15)
        ));
        taskService.createTask(project.id(), new CreateTaskRequest(
                "Sept Task 2", "desc", "Frontend", "Medium", owner.getId(), LocalDate.of(2026, 9, 15)
        ));
        taskService.createTask(project.id(), new CreateTaskRequest(
                "Sept Task 3", "desc", "Testing", "Low", owner.getId(), LocalDate.of(2026, 9, 20)
        ));

        // Create 1 task in Oct 2026 (on 2026-10-10)
        taskService.createTask(project.id(), new CreateTaskRequest(
                "Oct Task 1", "desc", "Backend", "High", owner.getId(), LocalDate.of(2026, 10, 10)
        ));

        // Call calendar endpoint for "2026-09"
        CalendarResponse septCalendar = calendarService.getCalendar(project.id(), "2026-09");

        assertThat(septCalendar).isNotNull();
        assertThat(septCalendar.projectDeadline()).isEqualTo(LocalDate.of(2026, 12, 31));
        assertThat(septCalendar.days()).hasSize(2);

        CalendarDayResponse day1 = septCalendar.days().get(0);
        assertThat(day1.date()).isEqualTo(LocalDate.of(2026, 9, 15));
        assertThat(day1.tasks()).hasSize(2);
        assertThat(day1.tasks()).extracting("title").containsExactlyInAnyOrder("Sept Task 1", "Sept Task 2");

        CalendarDayResponse day2 = septCalendar.days().get(1);
        assertThat(day2.date()).isEqualTo(LocalDate.of(2026, 9, 20));
        assertThat(day2.tasks()).hasSize(1);
        assertThat(day2.tasks().get(0).title()).isEqualTo("Sept Task 3");

        // Verify Oct task is NOT included in Sept calendar
        assertThat(septCalendar.days().stream()
                .flatMap(d -> d.tasks().stream())
                .map(t -> t.title()))
                .doesNotContain("Oct Task 1");

        // Now call calendar endpoint for "2026-10"
        CalendarResponse octCalendar = calendarService.getCalendar(project.id(), "2026-10");
        assertThat(octCalendar.days()).hasSize(1);
        assertThat(octCalendar.days().get(0).date()).isEqualTo(LocalDate.of(2026, 10, 10));
        assertThat(octCalendar.days().get(0).tasks().get(0).title()).isEqualTo("Oct Task 1");
    }

    @Test
    @DisplayName("Upcoming deadlines: returns tasks due within N days, and excludes completed tasks")
    void testUpcomingDeadlinesAndCompletedFilter() {
        LocalDate today = LocalDate.now();

        // 1. Create task due tomorrow
        TaskResponse dueTomorrow = taskService.createTask(project.id(), new CreateTaskRequest(
                "Release Patch", "Deploy hotfix", "Backend", "High", owner.getId(), today.plusDays(1)
        ));

        // 2. Create task due in 30 days
        taskService.createTask(project.id(), new CreateTaskRequest(
                "Quarterly Review", "Doc prep", "Documentation", "Low", owner.getId(), today.plusDays(30)
        ));

        // Call /deadlines/upcoming?withinDays=7 -> confirm only "due tomorrow" is returned
        List<UpcomingDeadlineResponse> upcoming = calendarService.getUpcomingDeadlines(project.id(), 7);
        assertThat(upcoming).hasSize(1);
        assertThat(upcoming.get(0).title()).isEqualTo("Release Patch");
        assertThat(upcoming.get(0).daysRemaining()).isEqualTo(1);

        // 3. Mark the "due tomorrow" task as Completed
        taskService.updateStatus(dueTomorrow.id(), new UpdateTaskStatusRequest("Completed"), owner.getEmail());

        // Call the endpoint again -> confirm it no longer appears
        List<UpcomingDeadlineResponse> afterCompletion = calendarService.getUpcomingDeadlines(project.id(), 7);
        assertThat(afterCompletion).isEmpty();
    }
}
