package com.taskoura.service;

import com.taskoura.dto.CalendarDtos.*;
import com.taskoura.entity.Project;
import com.taskoura.entity.Task;
import com.taskoura.entity.User;
import com.taskoura.exception.BadRequestException;
import com.taskoura.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CalendarServiceTest {

    @Mock private ProjectService projectService;
    @Mock private TaskRepository taskRepository;

    @InjectMocks private CalendarService calendarService;

    private UUID projectId;
    private Project project;
    private User dev;

    @BeforeEach
    void setUp() {
        projectId = UUID.randomUUID();
        project = Project.builder()
                .id(projectId)
                .name("Calendar Project")
                .deadline(LocalDate.of(2026, 12, 1))
                .build();
        dev = User.builder().id(UUID.randomUUID()).name("Dev User").email("dev@test.com").build();
    }

    @Test
    @DisplayName("getCalendar: month filter returns only tasks in that month, grouped by date")
    void getCalendar_withMonthFilter_returnsFilteredAndGrouped() {
        Task tSept1 = Task.builder()
                .id(UUID.randomUUID()).project(project).title("Sept Task 1")
                .status("InProgress").priority("High").assignedTo(dev)
                .deadline(LocalDate.of(2026, 9, 15)).build();

        Task tSept2 = Task.builder()
                .id(UUID.randomUUID()).project(project).title("Sept Task 2")
                .status("Backlog").priority("Medium").assignedTo(null)
                .deadline(LocalDate.of(2026, 9, 15)).build();

        Task tSept3 = Task.builder()
                .id(UUID.randomUUID()).project(project).title("Sept Task 3")
                .status("Testing").priority("Low").assignedTo(dev)
                .deadline(LocalDate.of(2026, 9, 20)).build();

        Task tOct = Task.builder()
                .id(UUID.randomUUID()).project(project).title("Oct Task")
                .status("Backlog").priority("High").assignedTo(dev)
                .deadline(LocalDate.of(2026, 10, 5)).build();

        when(projectService.getProjectEntityOrThrow(projectId)).thenReturn(project);
        when(taskRepository.findByProjectId(projectId)).thenReturn(List.of(tSept1, tSept2, tSept3, tOct));

        CalendarResponse response = calendarService.getCalendar(projectId, "2026-09");

        assertThat(response).isNotNull();
        assertThat(response.projectDeadline()).isEqualTo(LocalDate.of(2026, 12, 1));
        assertThat(response.days()).hasSize(2); // Sept 15 and Sept 20 (Oct 5 omitted)

        CalendarDayResponse day1 = response.days().get(0);
        assertThat(day1.date()).isEqualTo(LocalDate.of(2026, 9, 15));
        assertThat(day1.tasks()).hasSize(2);
        assertThat(day1.tasks().get(0).title()).isEqualTo("Sept Task 1");
        assertThat(day1.tasks().get(0).assignedToName()).isEqualTo("Dev User");

        CalendarDayResponse day2 = response.days().get(1);
        assertThat(day2.date()).isEqualTo(LocalDate.of(2026, 9, 20));
        assertThat(day2.tasks()).hasSize(1);
        assertThat(day2.tasks().get(0).title()).isEqualTo("Sept Task 3");
    }

    @Test
    @DisplayName("getCalendar: without month filter returns all tasks with deadline grouped by date")
    void getCalendar_withoutMonthFilter_returnsAll() {
        Task tSept = Task.builder().id(UUID.randomUUID()).project(project).title("Sept Task")
                .status("InProgress").deadline(LocalDate.of(2026, 9, 10)).build();
        Task tOct = Task.builder().id(UUID.randomUUID()).project(project).title("Oct Task")
                .status("Backlog").deadline(LocalDate.of(2026, 10, 10)).build();
        Task tNoDeadline = Task.builder().id(UUID.randomUUID()).project(project).title("No Deadline")
                .status("Backlog").deadline(null).build();

        when(projectService.getProjectEntityOrThrow(projectId)).thenReturn(project);
        when(taskRepository.findByProjectId(projectId)).thenReturn(List.of(tSept, tOct, tNoDeadline));

        CalendarResponse response = calendarService.getCalendar(projectId, null);

        assertThat(response.days()).hasSize(2);
        assertThat(response.days().get(0).date()).isEqualTo(LocalDate.of(2026, 9, 10));
        assertThat(response.days().get(1).date()).isEqualTo(LocalDate.of(2026, 10, 10));
    }

    @Test
    @DisplayName("getCalendar: invalid month format throws BadRequestException")
    void getCalendar_invalidMonth_throwsBadRequest() {
        when(projectService.getProjectEntityOrThrow(projectId)).thenReturn(project);

        assertThatThrownBy(() -> calendarService.getCalendar(projectId, "invalid-date"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Invalid month format");
    }

    @Test
    @DisplayName("getUpcomingDeadlines: returns incomplete tasks due within N days, sorted ascending")
    void getUpcomingDeadlines_filtersCorrectly() {
        LocalDate today = LocalDate.now();

        Task dueTomorrow = Task.builder().id(UUID.randomUUID()).project(project)
                .title("Due Tomorrow").status("InProgress").priority("High")
                .assignedTo(dev).deadline(today.plusDays(1)).build();

        Task dueIn5Days = Task.builder().id(UUID.randomUUID()).project(project)
                .title("Due in 5 Days").status("Backlog").priority("Medium")
                .assignedTo(dev).deadline(today.plusDays(5)).build();

        Task dueTomorrowCompleted = Task.builder().id(UUID.randomUUID()).project(project)
                .title("Due Tomorrow Completed").status("Completed").priority("Low")
                .assignedTo(dev).deadline(today.plusDays(1)).build();

        Task dueIn30Days = Task.builder().id(UUID.randomUUID()).project(project)
                .title("Due in 30 Days").status("InProgress").priority("High")
                .assignedTo(dev).deadline(today.plusDays(30)).build();

        when(projectService.getProjectEntityOrThrow(projectId)).thenReturn(project);
        when(taskRepository.findByProjectId(projectId))
                .thenReturn(List.of(dueTomorrow, dueIn5Days, dueTomorrowCompleted, dueIn30Days));

        List<UpcomingDeadlineResponse> result = calendarService.getUpcomingDeadlines(projectId, 7);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).title()).isEqualTo("Due Tomorrow");
        assertThat(result.get(0).daysRemaining()).isEqualTo(1);
        assertThat(result.get(1).title()).isEqualTo("Due in 5 Days");
        assertThat(result.get(1).daysRemaining()).isEqualTo(5);
    }
}
