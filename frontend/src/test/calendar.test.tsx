import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MonthGrid } from '../features/calendar/components/MonthGrid';
import { DayCell, getStatusBadgeClass } from '../features/calendar/components/DayCell';
import { MonthNav } from '../features/calendar/components/MonthNav';
import { UpcomingList, getDaysRemainingBadgeClass, formatDaysRemainingText } from '../features/calendar/components/UpcomingList';
import { CalendarPage } from '../features/calendar/pages/CalendarPage';
import { projectTabs } from '../components/projects/projectTabs';
import { parseISO, format } from 'date-fns';

const mockProjectId = 'proj-calendar-123';

let mockCalendarData = {
  projectDeadline: '2026-09-30',
  days: [
    {
      date: '2026-09-15',
      tasks: [
        { id: 'task-1', title: 'Task Alpha', status: 'InProgress', priority: 'High', assignedToName: 'Alice' },
        { id: 'task-2', title: 'Task Beta', status: 'InReview', priority: 'Medium', assignedToName: 'Bob' },
        { id: 'task-3', title: 'Task Gamma', status: 'Completed', priority: 'Low', assignedToName: 'Charlie' },
        { id: 'task-4', title: 'Task Delta', status: 'Backlog', priority: 'High', assignedToName: 'David' },
      ],
    },
    {
      date: '2026-09-30',
      tasks: [
        { id: 'task-5', title: 'Release v1.0', status: 'InProgress', priority: 'High', assignedToName: 'Lead' },
      ],
    },
  ],
};

let mockUpcomingData = [
  { taskId: 'task-urgent-0', title: 'Zero Day Task', deadline: '2026-09-10', status: 'InProgress', priority: 'High', assignedToName: 'Alice', daysRemaining: 0 },
  { taskId: 'task-urgent-1', title: 'One Day Task', deadline: '2026-09-11', status: 'InProgress', priority: 'High', assignedToName: 'Bob', daysRemaining: 1 },
  { taskId: 'task-later-5', title: 'Later Task', deadline: '2026-09-15', status: 'Backlog', priority: 'Medium', assignedToName: 'Charlie', daysRemaining: 5 },
];

let lastRequestedMonth: string | null = null;
let lastRequestedWithinDays: string | null = null;

const server = setupServer(
  http.get('*/api/projects/:projectId/calendar', ({ request }) => {
    const url = new URL(request.url);
    lastRequestedMonth = url.searchParams.get('month');
    return HttpResponse.json(mockCalendarData);
  }),

  http.get('*/api/projects/:projectId/deadlines/upcoming', ({ request }) => {
    const url = new URL(request.url);
    lastRequestedWithinDays = url.searchParams.get('withinDays');
    return HttpResponse.json(mockUpcomingData);
  })
);

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe('MODULE F12: Calendar Feature', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
    lastRequestedMonth = null;
    lastRequestedWithinDays = null;
  });

  describe('Registration & Tabs', () => {
    it('registers the "calendar" tab in projectTabs with path and element', () => {
      const calendarTab = projectTabs.find((t) => t.key === 'calendar');
      expect(calendarTab).toBeDefined();
      expect(calendarTab?.label).toBe('Calendar');
      expect(calendarTab?.path).toBe('calendar');
      expect(calendarTab?.element).toBeDefined();
    });
  });

  describe('MonthGrid & Month Boundaries (date-fns, Monday start, Timezone safety)', () => {
    it('builds month grid with weeks starting on Monday', () => {
      // September 2026: Sept 1 is a Tuesday.
      // With weeks starting Monday, Monday Aug 31 is the first cell.
      const sept2026 = parseISO('2026-09-01');
      const { getByTestId, getAllByTestId } = render(
        <MonthGrid currentMonth={sept2026} calendarData={mockCalendarData} />
      );

      expect(getByTestId('month-grid')).toBeInTheDocument();
      // First cell in grid must be 2026-08-31 (Monday)
      expect(getByTestId('day-cell-2026-08-31')).toBeInTheDocument();
      // Sept 1 is Tuesday
      expect(getByTestId('day-cell-2026-09-01')).toBeInTheDocument();
      // Sept 30 is Wednesday, grid ends on Sunday Oct 4
      expect(getByTestId('day-cell-2026-09-30')).toBeInTheDocument();
      expect(getByTestId('day-cell-2026-10-04')).toBeInTheDocument();
    });

    it('handles month boundary cases: Jan 31 and Feb 28/29 (leap year)', () => {
      // 2024 is a leap year (Feb 29 exists)
      const feb2024 = parseISO('2024-02-01');
      const { getByTestId } = render(
        <MonthGrid currentMonth={feb2024} calendarData={{ days: [] }} />
      );
      expect(getByTestId('day-cell-2024-02-29')).toBeInTheDocument();

      // 2025 is not a leap year (Feb 28 is the last day)
      const { getByTestId: getByTestId2025, queryByTestId: queryByTestId2025 } = render(
        <MonthGrid currentMonth={parseISO('2025-02-01')} calendarData={{ days: [] }} />
      );
      expect(getByTestId2025('day-cell-2025-02-28')).toBeInTheDocument();
      expect(queryByTestId2025('day-cell-2025-02-29')).toBeNull();

      // January has 31 days
      const { getByTestId: getByTestIdJan } = render(
        <MonthGrid currentMonth={parseISO('2026-01-01')} calendarData={{ days: [] }} />
      );
      expect(getByTestIdJan('day-cell-2026-01-31')).toBeInTheDocument();
    });

    it('handles a month that starts on Sunday correctly with Monday week start', () => {
      // March 2026 starts on Sunday (March 1, 2026).
      // Since weeks start on Monday, the first row should span Monday Feb 23 -> Sunday March 1.
      const march2026 = parseISO('2026-03-01');
      const { getByTestId } = render(
        <MonthGrid currentMonth={march2026} calendarData={{ days: [] }} />
      );

      expect(getByTestId('day-cell-2026-02-23')).toBeInTheDocument();
      expect(getByTestId('day-cell-2026-03-01')).toBeInTheDocument();
    });

    it('places near-midnight dates on the correct day (timezone safety)', () => {
      // If backend returns date near midnight like 2026-09-15
      const calendarDataWithTimestamp = {
        days: [
          {
            date: '2026-09-15',
            tasks: [{ id: 't-midnight', title: 'Midnight Safe Task', status: 'InProgress' }],
          },
        ],
      };

      const sept2026 = parseISO('2026-09-01');
      const { getByTestId } = render(
        <MonthGrid currentMonth={sept2026} calendarData={calendarDataWithTimestamp} />
      );

      const cell15 = getByTestId('day-cell-2026-09-15');
      expect(cell15).toHaveTextContent('Midnight Safe Task');

      // Adjacent cell 2026-09-14 should NOT have it
      const cell14 = getByTestId('day-cell-2026-09-14');
      expect(cell14).not.toHaveTextContent('Midnight Safe Task');
    });
  });

  describe('DayCell: Chips, +N more popover, Project Deadline', () => {
    it('shows up to 3 task chips, and "+N more" button appears above 3 tasks', () => {
      const dayDate = parseISO('2026-09-15');
      const tasks = [
        { id: '1', title: 'Task One', status: 'Backlog' },
        { id: '2', title: 'Task Two', status: 'InProgress' },
        { id: '3', title: 'Task Three', status: 'InReview' },
        { id: '4', title: 'Task Four', status: 'Completed' },
        { id: '5', title: 'Task Five', status: 'Blocked' },
      ];

      const { getByTestId, getByText, queryByTestId } = render(
        <DayCell dayDate={dayDate} tasks={tasks} />
      );

      // First 3 tasks are visible
      expect(getByTestId('task-chip-1')).toBeInTheDocument();
      expect(getByTestId('task-chip-2')).toBeInTheDocument();
      expect(getByTestId('task-chip-3')).toBeInTheDocument();

      // Tasks 4 & 5 are not direct chips
      expect(queryByTestId('task-chip-4')).toBeNull();
      expect(queryByTestId('task-chip-5')).toBeNull();

      // +2 more button appears
      const moreBtn = getByTestId('more-tasks-btn');
      expect(moreBtn).toHaveTextContent('+2 more');
    });

    it('clicking "+N more" opens a day list popover containing all tasks for that day', async () => {
      const user = userEvent.setup();
      const dayDate = parseISO('2026-09-15');
      const onTaskClick = vi.fn();
      const tasks = [
        { id: '1', title: 'Task 1', status: 'InProgress', assignedToName: 'User A' },
        { id: '2', title: 'Task 2', status: 'InReview' },
        { id: '3', title: 'Task 3', status: 'Backlog' },
        { id: '4', title: 'Task 4', status: 'Completed' },
      ];

      const { getByTestId, queryByTestId } = render(
        <DayCell dayDate={dayDate} tasks={tasks} onTaskClick={onTaskClick} />
      );

      expect(queryByTestId('day-popover')).toBeNull();

      // Click +1 more
      await user.click(getByTestId('more-tasks-btn'));

      // Popover is now open
      const popover = getByTestId('day-popover');
      expect(popover).toBeInTheDocument();
      expect(popover).toHaveTextContent('Task 1');
      expect(popover).toHaveTextContent('Task 4');

      // Clicking a task in the popover triggers onTaskClick
      await user.click(getByTestId('popover-task-1'));
      expect(onTaskClick).toHaveBeenCalledWith('1');
    });

    it('clicking a task chip calls onTaskClick with task id', async () => {
      const user = userEvent.setup();
      const onTaskClick = vi.fn();
      const tasks = [{ id: 'chip-99', title: 'Clickable Chip', status: 'InProgress' }];

      const { getByTestId } = render(
        <DayCell dayDate={parseISO('2026-09-15')} tasks={tasks} onTaskClick={onTaskClick} />
      );

      await user.click(getByTestId('task-chip-chip-99'));
      expect(onTaskClick).toHaveBeenCalledWith('chip-99');
    });

    it('renders project deadline marker when isProjectDeadline is true', () => {
      const { getByTestId, rerender } = render(
        <DayCell dayDate={parseISO('2026-09-30')} isProjectDeadline={true} />
      );
      expect(getByTestId('project-deadline-marker')).toBeInTheDocument();

      rerender(<DayCell dayDate={parseISO('2026-09-30')} isProjectDeadline={false} />);
      expect(screen.queryByTestId('project-deadline-marker')).toBeNull();
    });
  });

  describe('UpcomingList: Selector, badges, and empty states', () => {
    it('selector for 7, 14, or 30 days triggers onDaysChange', async () => {
      const user = userEvent.setup();
      const onDaysChange = vi.fn();

      const { getByTestId } = render(
        <UpcomingList withinDays={7} onDaysChange={onDaysChange} upcoming={[]} />
      );

      await user.click(getByTestId('days-btn-14'));
      expect(onDaysChange).toHaveBeenCalledWith(14);

      await user.click(getByTestId('days-btn-30'));
      expect(onDaysChange).toHaveBeenCalledWith(30);
    });

    it('applies red badge styling at 0 to 1 days remaining', () => {
      // 0 days remaining -> red
      expect(getDaysRemainingBadgeClass(0)).toContain('bg-rose-100');
      expect(getDaysRemainingBadgeClass(0)).toContain('text-rose-800');
      expect(formatDaysRemainingText(0)).toBe('Due today');

      // 1 day remaining -> red
      expect(getDaysRemainingBadgeClass(1)).toContain('bg-rose-100');
      expect(getDaysRemainingBadgeClass(1)).toContain('text-rose-800');
      expect(formatDaysRemainingText(1)).toBe('1 day left');

      // 5 days remaining -> not red
      expect(getDaysRemainingBadgeClass(5)).not.toContain('bg-rose-100');
      expect(formatDaysRemainingText(5)).toBe('5 days left');
    });

    it('renders empty state "Nothing due soon" when list is empty', () => {
      const { getByTestId, getByText } = render(
        <UpcomingList upcoming={[]} withinDays={7} />
      );

      expect(getByTestId('empty-upcoming')).toBeInTheDocument();
      expect(getByText('Nothing due soon')).toBeInTheDocument();
    });
  });

  describe('MonthNav & Navigation', () => {
    it('displays visible month and calls onPrevMonth, onNextMonth, onToday', async () => {
      const user = userEvent.setup();
      const onPrevMonth = vi.fn();
      const onNextMonth = vi.fn();
      const onToday = vi.fn();

      const sept2026 = parseISO('2026-09-01');
      const { getByTestId, getByLabelText, getByText } = render(
        <MonthNav
          currentMonth={sept2026}
          onPrevMonth={onPrevMonth}
          onNextMonth={onNextMonth}
          onToday={onToday}
        />
      );

      expect(getByTestId('calendar-month-title')).toHaveTextContent('September 2026');

      await user.click(getByLabelText('Previous month'));
      expect(onPrevMonth).toHaveBeenCalled();

      await user.click(getByLabelText('Next month'));
      expect(onNextMonth).toHaveBeenCalled();

      await user.click(getByText('Today'));
      expect(onToday).toHaveBeenCalled();
    });
  });

  describe('CalendarPage Integration with MSW backend', () => {
    it('fetches calendar data and upcoming deadlines, renders grid and list', async () => {
      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[`/app/projects/${mockProjectId}/calendar`]}>
            <Routes>
              <Route path="/app/projects/:projectId/calendar" element={<CalendarPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify page mounted
      await waitFor(() => {
        expect(screen.getByTestId('calendar-page')).toBeInTheDocument();
      });

      // Backend should have received request with current month YYYY-MM
      expect(lastRequestedMonth).toMatch(/^\d{4}-\d{2}$/);
      expect(lastRequestedWithinDays).toBe('7');

      // Verify tasks in upcoming list
      await waitFor(() => {
        expect(screen.getByText('Zero Day Task')).toBeInTheDocument();
        expect(screen.getByText('One Day Task')).toBeInTheDocument();
        expect(screen.getByText('Later Task')).toBeInTheDocument();
      });
    });

    it('clicking a task chip or upcoming item navigates to ?task=<id> on the board route', async () => {
      const user = userEvent.setup();
      const queryClient = createTestQueryClient();

      let currentPath = '';
      function LocationWatcher() {
        return <div data-testid="location">{window.location.search}</div>;
      }

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[`/app/projects/${mockProjectId}/calendar`]}>
            <Routes>
              <Route path="/app/projects/:projectId/calendar" element={<CalendarPage />} />
              <Route
                path="/app/projects/:projectId/board"
                element={<div data-testid="board-destination">Board View</div>}
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Wait for upcoming tasks
      await waitFor(() => {
        expect(screen.getByTestId('upcoming-item-task-urgent-0')).toBeInTheDocument();
      });

      // Click upcoming task item
      await user.click(screen.getByTestId('upcoming-item-task-urgent-0'));

      // Destination board view is displayed with ?task=task-urgent-0
      await waitFor(() => {
        expect(screen.getByTestId('board-destination')).toBeInTheDocument();
      });
    });
  });
});
