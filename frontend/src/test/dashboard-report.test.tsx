import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  normalizeDashboard,
  normalizeReport,
  STATUS_COLORS,
} from '../types/dashboard';
import { CompletionRing } from '../components/dashboard/CompletionRing';
import { StatusDonut, buildDonutData } from '../components/dashboard/StatusDonut';
import { MemberBars } from '../components/dashboard/MemberBars';
import { UpcomingDeadlines } from '../components/dashboard/UpcomingDeadlines';
import { ReportTable, generateCsvContent } from '../components/dashboard/ReportTable';
import { ProjectDashboardPage } from '../pages/ProjectDashboardPage';
import { ReportPage } from '../pages/ReportPage';
import { ProjectLayout } from '../pages/ProjectLayout';
import { setToken, setStoredUser } from '../lib/token';
import { AuthProvider } from '../context/AuthContext';
import { Project } from '../types/project';
import { ProjectMember } from '../types/member';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

const PROJECT_ID = 'proj-f10-123';
const OWNER_USER_ID = 'user-owner-1';
const MEMBER_USER_ID = 'user-member-2';

let mockDashboardData: Record<string, unknown> = {};
let mockReportData: Record<string, unknown>[] | Record<string, unknown> = [];
let mockMembers: ProjectMember[] = [];
let mockProject: Project | null = null;
let reportStatus = 200;

const server = setupServer(
  http.get('*/api/projects/:projectId/dashboard', () => {
    return HttpResponse.json(mockDashboardData);
  }),

  http.get('*/api/projects/:projectId/report', () => {
    if (reportStatus === 403) {
      return HttpResponse.json(
        { error: 'Forbidden', message: 'Only the project owner can view the report.' },
        { status: 403 }
      );
    }
    return HttpResponse.json(mockReportData);
  }),

  http.get('*/api/projects/:projectId/members', () => {
    return HttpResponse.json(mockMembers);
  }),

  http.get('*/api/projects/:projectId', () => {
    return HttpResponse.json(mockProject);
  }),

  http.get('*/api/projects', () => {
    return HttpResponse.json(mockProject ? [mockProject] : []);
  }),

  http.get('*/api/ai/next-task/:projectId', () => {
    return HttpResponse.json({
      recommendation: 'Proceed with auth tests',
      relatedTaskId: 'task-auth-1',
    });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());

beforeEach(() => {
  server.resetHandlers();
  reportStatus = 200;

  mockProject = {
    id: PROJECT_ID,
    name: 'Apollo Workspace',
    description: 'Engineering dashboard and reporting',
    ownerId: OWNER_USER_ID,
    frontendStack: 'React',
    backendStack: 'Spring Boot',
    databaseStack: 'PostgreSQL',
    testingStack: 'JUnit',
    createdAt: new Date().toISOString(),
  };

  mockMembers = [
    {
      id: 'mem-1',
      userId: OWNER_USER_ID,
      userName: 'Alice Owner',
      userEmail: 'alice@example.com',
      role: 'Owner',
    },
    {
      id: 'mem-2',
      userId: MEMBER_USER_ID,
      userName: 'Bob Dev',
      userEmail: 'bob@example.com',
      role: 'Member',
    },
  ];

  mockDashboardData = {
    totalTasks: 10,
    completedTasks: 7,
    completionPercentage: 70.0,
    tasksByStatus: {
      Backlog: 1,
      InProgress: 2,
      Testing: 0,
      Completed: 7,
    },
    tasksByMember: [
      { userId: OWNER_USER_ID, name: 'Alice Owner', assigned: 5, completed: 4 },
      { userId: MEMBER_USER_ID, name: 'Bob Dev', assigned: 5, completed: 3 },
    ],
    upcomingDeadlines: [
      {
        taskId: 't-1',
        title: 'Complete OAuth flow',
        deadline: '2026-10-30',
        status: 'InProgress',
        priority: 'High',
        assignedToName: 'Bob Dev',
      },
    ],
  };

  mockReportData = [
    {
      userId: OWNER_USER_ID,
      userName: 'Alice Owner',
      tasksAssigned: 5,
      tasksCompleted: 4,
      onTimeCompletions: 4,
      lateCompletions: 0,
      averageDelayDays: 0,
      reworkCount: 1,
      bugsAssigned: 2,
      bugsFixed: 2,
      avgBugTurnaroundHours: 3.5,
      testCasesExecuted: 10,
      testCasesPassed: 10,
    },
    {
      userId: MEMBER_USER_ID,
      userName: 'Bob Dev',
      tasksAssigned: 5,
      tasksCompleted: 3,
      onTimeCompletions: 2,
      lateCompletions: 1,
      averageDelayDays: 2.5,
      reworkCount: 2,
      bugsAssigned: 4,
      bugsFixed: 3,
      avgBugTurnaroundHours: 8.0,
      testCasesExecuted: 8,
      testCasesPassed: 7,
    },
  ];

  // Set default logged-in user as owner
  const token = createJwt({
    sub: 'alice@example.com',
    name: 'Alice Owner',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  setToken(token);
  setStoredUser({
    id: OWNER_USER_ID,
    name: 'Alice Owner',
    email: 'alice@example.com',
  });
});

function renderWithClient(ui: React.ReactElement, initialPath: string = `/app/projects/${PROJECT_ID}/dashboard`) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          {ui}
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('Module F10: Normalizers & Zero-Task Safety', () => {
  it('handles a project with zero tasks without NaN, Infinity, or divide-by-zero', () => {
    const zeroRaw = {
      totalTasks: 0,
      completedTasks: 0,
      completionPercentage: 0,
      tasksByStatus: { Backlog: 0, InProgress: 0, Testing: 0, Completed: 0 },
      tasksByMember: [],
      upcomingDeadlines: [],
    };

    const normalized = normalizeDashboard(zeroRaw);
    expect(normalized.totalTasks).toBe(0);
    expect(normalized.completedTasks).toBe(0);
    expect(normalized.completionPercentage).toBe(0);
    expect(isNaN(normalized.completionPercentage)).toBe(false);

    // CompletionRing rendering with 0 tasks
    render(
      <CompletionRing
        completedTasks={0}
        totalTasks={0}
        completionPercentage={normalized.completionPercentage}
      />
    );

    const percentageText = screen.getByTestId('completion-ring-percentage');
    expect(percentageText).toHaveTextContent('0%');
    expect(percentageText.textContent).not.toContain('NaN');
    expect(screen.getByText(/no tasks in sprint yet/i)).toBeInTheDocument();
  });

  it('donut data maps correctly to status colors', () => {
    const tasksByStatus = {
      Backlog: 5,
      InProgress: 3,
      Testing: 2,
      Completed: 8,
    };

    const donutItems = buildDonutData(tasksByStatus);
    expect(donutItems).toHaveLength(4);

    const backlog = donutItems.find((d) => d.status === 'Backlog');
    expect(backlog?.color).toBe(STATUS_COLORS.Backlog);
    expect(backlog?.color).toBe('#64748b');

    const inProgress = donutItems.find((d) => d.status === 'InProgress');
    expect(inProgress?.color).toBe(STATUS_COLORS.InProgress);
    expect(inProgress?.color).toBe('#0284c7');

    const testing = donutItems.find((d) => d.status === 'Testing');
    expect(testing?.color).toBe(STATUS_COLORS.Testing);
    expect(testing?.color).toBe('#d97706');

    const completed = donutItems.find((d) => d.status === 'Completed');
    expect(completed?.color).toBe(STATUS_COLORS.Completed);
    expect(completed?.color).toBe('#059669');
  });

  it('normalizes both array reports and wrapped reports with aiSummary', () => {
    const rawArray = [
      {
        userId: 'u1',
        name: 'Dev One',
        tasksAssigned: 3,
        tasksCompleted: 2,
      },
    ];
    const normalizedArray = normalizeReport(rawArray);
    expect(normalizedArray.members).toHaveLength(1);
    expect(normalizedArray.members[0].name).toBe('Dev One');
    expect(normalizedArray.aiSummary).toBeUndefined();

    const rawWrapped = {
      members: rawArray,
      aiSummary: 'Team is operating with 95% efficiency.',
    };
    const normalizedWrapped = normalizeReport(rawWrapped);
    expect(normalizedWrapped.members).toHaveLength(1);
    expect(normalizedWrapped.aiSummary).toBe('Team is operating with 95% efficiency.');
  });
});

describe('Module F10: ProjectDashboardPage Component', () => {
  it('renders all 4 stat cards, ring, donut, member bars, and upcoming deadlines', async () => {
    renderWithClient(
      <Routes>
        <Route path="/app/projects/:projectId/dashboard" element={<ProjectDashboardPage />} />
      </Routes>
    );

    // Verify StatCards
    const totalCard = await screen.findByTestId('stat-total-tasks');
    expect(totalCard).toHaveTextContent('10');

    const completedCard = screen.getByTestId('stat-completed-tasks');
    expect(completedCard).toHaveTextContent('7');
    expect(completedCard).toHaveTextContent('70%');

    const inProgressCard = screen.getByTestId('stat-inprogress-tasks');
    expect(inProgressCard).toHaveTextContent('2');

    // Verify CompletionRing
    expect(screen.getByTestId('completion-ring')).toBeInTheDocument();
    expect(screen.getByTestId('completion-ring-percentage')).toHaveTextContent('70%');

    // Verify Donut & Member Bars containers
    expect(screen.getByTestId('status-donut')).toBeInTheDocument();
    expect(screen.getByTestId('member-bars')).toBeInTheDocument();

    // Verify Upcoming Deadlines
    expect(screen.getByTestId('upcoming-deadlines')).toBeInTheDocument();
    expect(screen.getByText('Complete OAuth flow')).toBeInTheDocument();
  });
});

describe('Module F10: Owner-Only Report & 403 Forbidden Handling', () => {
  it('shows "Only the project owner can view the report." on 403', async () => {
    reportStatus = 403;

    // Log in as non-owner member
    const memberToken = createJwt({
      sub: 'bob@example.com',
      name: 'Bob Dev',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    setToken(memberToken);
    setStoredUser({
      id: MEMBER_USER_ID,
      name: 'Bob Dev',
      email: 'bob@example.com',
    });

    renderWithClient(
      <Routes>
        <Route path="/app/projects/:projectId/report" element={<ReportPage />} />
      </Routes>,
      `/app/projects/${PROJECT_ID}/report`
    );

    const forbiddenMsg = await screen.findByTestId('forbidden-message');
    expect(forbiddenMsg).toHaveTextContent('Only the project owner can view the report.');
  });

  it('renders report table for the owner with member metrics and units', async () => {
    reportStatus = 200;

    renderWithClient(
      <Routes>
        <Route path="/app/projects/:projectId/report" element={<ReportPage />} />
      </Routes>,
      `/app/projects/${PROJECT_ID}/report`
    );

    expect(await screen.findByTestId('report-table')).toBeInTheDocument();

    // Contributor names
    expect(screen.getByText('Alice Owner')).toBeInTheDocument();
    expect(screen.getByText('Bob Dev')).toBeInTheDocument();

    // Units check: days and hrs
    expect(screen.getByText('2.5 days')).toBeInTheDocument();
    expect(screen.getByText('3.5 hrs')).toBeInTheDocument();
    expect(screen.getByText('8 hrs')).toBeInTheDocument();

    // Buttons
    expect(screen.getByTestId('download-csv-btn')).toBeInTheDocument();
    expect(screen.getByTestId('print-report-btn')).toBeInTheDocument();
  });

  it('hides the Report tab from non-owners in ProjectLayout tab navigation', async () => {
    // Log in as Bob (Member, not Owner)
    const memberToken = createJwt({
      sub: 'bob@example.com',
      name: 'Bob Dev',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    setToken(memberToken);
    setStoredUser({
      id: MEMBER_USER_ID,
      name: 'Bob Dev',
      email: 'bob@example.com',
    });

    renderWithClient(
      <Routes>
        <Route path="/app/projects/:projectId" element={<ProjectLayout />}>
          <Route path="dashboard" element={<div>Dashboard content</div>} />
        </Route>
      </Routes>,
      `/app/projects/${PROJECT_ID}/dashboard`
    );

    // Board, Dashboard, Team, Activity should be visible
    expect(await screen.findByRole('link', { name: /^Board$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Dashboard$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Team$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Activity$/i })).toBeInTheDocument();

    // Report tab must NOT be visible to non-owner
    expect(screen.queryByRole('link', { name: /^Report$/i })).not.toBeInTheDocument();
  });
});

describe('Module F10: CSV Output Format', () => {
  it('generates CSV with a header row and one row per member', () => {
    const sampleMembers = [
      {
        userId: 'u-1',
        name: 'Alice Owner',
        tasksAssigned: 8,
        tasksCompleted: 6,
        onTimeCompletions: 5,
        lateCompletions: 1,
        averageDelayDays: 1.2,
        reworkCount: 0,
        bugsAssigned: 3,
        bugsFixed: 3,
        avgBugTurnaroundHours: 4.5,
        testCasesExecuted: 12,
        testCasesPassed: 11,
      },
      {
        userId: 'u-2',
        name: 'Bob, Senior Dev',
        tasksAssigned: 10,
        tasksCompleted: 7,
        onTimeCompletions: 6,
        lateCompletions: 1,
        averageDelayDays: 2.0,
        reworkCount: 2,
        bugsAssigned: 5,
        bugsFixed: 4,
        avgBugTurnaroundHours: 6.0,
        testCasesExecuted: 15,
        testCasesPassed: 14,
      },
    ];

    const csv = generateCsvContent(sampleMembers);
    const lines = csv.split('\n');

    // Header row + 2 member rows = 3 lines
    expect(lines).toHaveLength(3);

    // Header validation
    const expectedHeaders = [
      'Member Name',
      'Tasks Assigned',
      'Tasks Completed',
      'On-Time Completions',
      'Late Completions',
      'Average Delay (Days)',
      'Rework Count',
      'Bugs Assigned',
      'Bugs Fixed',
      'Avg Bug Turnaround (Hours)',
      'Test Cases Executed',
      'Test Cases Passed',
    ].join(',');
    expect(lines[0]).toBe(expectedHeaders);

    // Row 1
    expect(lines[1]).toBe('Alice Owner,8,6,5,1,1.2,0,3,3,4.5,12,11');

    // Row 2 (with escaped comma in name)
    expect(lines[2]).toBe('"Bob, Senior Dev",10,7,6,1,2,2,5,4,6,15,14');
  });
});
