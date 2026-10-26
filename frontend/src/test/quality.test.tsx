import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { TestSummary } from '../components/quality/TestSummary';
import { BugsTab, getSeverityChip } from '../components/quality/BugsTab';
import { TestCasesTab } from '../components/quality/TestCasesTab';
import { QualitySection } from '../components/quality/QualitySection';
import { useAddTestCase } from '../hooks/useQuality';
import { TaskPanel } from '../components/tasks/TaskPanel';
import { Bug, TestCase, CreateBugRequest, CreateTestCaseRequest } from '../types/quality';
import { ProjectMember } from '../types/member';
import { Task } from '../types/task';

const TASK_ID = 'task-qa-123';
const PROJECT_ID = 'proj-qa-456';
const USER_1 = 'user-alice-1';
const USER_2 = 'user-bob-2';

const mockMemberMap = new Map<string, ProjectMember>([
  [
    USER_1,
    {
      id: 'pm-1',
      userId: USER_1,
      userName: 'Alice Engineer',
      userEmail: 'alice@example.com',
      role: 'Owner',
    },
  ],
  [
    USER_2,
    {
      id: 'pm-2',
      userId: USER_2,
      userName: 'Bob Architect',
      userEmail: 'bob@example.com',
      role: 'Member',
    },
  ],
]);

let mockBugs: Bug[] = [];
let mockTestCases: TestCase[] = [];

const server = setupServer(
  // Bugs endpoints
  http.get('*/api/tasks/:taskId/bugs', ({ params }) => {
    if (params.taskId !== TASK_ID) return HttpResponse.json([]);
    return HttpResponse.json(mockBugs);
  }),

  http.post('*/api/tasks/:taskId/bugs', async ({ request, params }) => {
    const body = (await request.json()) as CreateBugRequest;
    const newBug: Bug = {
      id: `bug-${Date.now()}`,
      taskId: params.taskId as string,
      severity: body.severity,
      status: 'Open',
      reportedBy: USER_1,
      assignedTo: body.assignedTo || null,
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      description: body.description,
    };
    mockBugs.push(newBug);
    return HttpResponse.json(newBug, { status: 201 });
  }),

  http.patch('*/api/bugs/:bugId/resolve', ({ params }) => {
    const bug = mockBugs.find((b) => b.id === params.bugId);
    if (bug) {
      bug.status = 'Resolved';
      bug.resolvedAt = new Date().toISOString();
      return HttpResponse.json(bug, { status: 200 });
    }
    return HttpResponse.json(
      { error: 'Not Found', message: 'Bug not found', status: 404 },
      { status: 404 }
    );
  }),

  // Test cases endpoints
  http.get('*/api/tasks/:taskId/test-cases', ({ params }) => {
    if (params.taskId !== TASK_ID) return HttpResponse.json([]);
    return HttpResponse.json(mockTestCases);
  }),

  http.post('*/api/tasks/:taskId/test-cases', async ({ request }) => {
    const body = (await request.json()) as CreateTestCaseRequest;
    const newTestCase: TestCase = {
      id: `tc-${Date.now()}`,
      description: body.description,
      expectedResult: body.expectedResult,
      passed: body.passed,
      executedBy: USER_1,
      executedAt: new Date().toISOString(),
    };
    mockTestCases.push(newTestCase);
    return HttpResponse.json(newTestCase, { status: 201 });
  }),

  // Status logs endpoint
  http.get('*/api/tasks/:taskId/status-logs', () => HttpResponse.json([])),
  http.get('*/api/tasks/:taskId/comments', () => HttpResponse.json([]))
);

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithProviders = (
  ui: React.ReactElement,
  initialEntries: string[] = ['/']
) => {
  const queryClient = createTestQueryClient();

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={initialEntries}>
            {ui}
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    ),
  };
};

describe('MODULE F7: Bugs and Test Cases', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    mockBugs = [];
    mockTestCases = [];
  });

  describe('TestSummary', () => {
    it('Summary counts are correct for an empty list', () => {
      render(<TestSummary testCases={[]} />);
      const summaryText = screen.getByTestId('test-summary-text');
      expect(summaryText).toHaveTextContent('0 passed, 0 failed');
    });

    it('Summary counts are correct for mixed pass/fail data', () => {
      const mixedCases: TestCase[] = [
        {
          id: 'tc-1',
          description: 'Login with valid pass',
          expectedResult: 'Navigates to dashboard',
          passed: true,
          executedBy: USER_1,
          executedAt: new Date().toISOString(),
        },
        {
          id: 'tc-2',
          description: 'Login with wrong password',
          expectedResult: 'Shows invalid credentials toast',
          passed: true,
          executedBy: USER_1,
          executedAt: new Date().toISOString(),
        },
        {
          id: 'tc-3',
          description: 'Google SSO callback',
          expectedResult: 'Receives token and syncs profile',
          passed: true,
          executedBy: USER_2,
          executedAt: new Date().toISOString(),
        },
        {
          id: 'tc-4',
          description: 'Session timeout renewal',
          expectedResult: 'Silent refresh without logout',
          passed: false,
          executedBy: USER_2,
          executedAt: new Date().toISOString(),
        },
      ];

      render(<TestSummary testCases={mixedCases} />);
      const summaryText = screen.getByTestId('test-summary-text');
      expect(summaryText).toHaveTextContent('3 passed, 1 failed');
      expect(screen.getByText('3 Passed')).toBeInTheDocument();
      expect(screen.getByText('1 Failed')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
    });
  });

  describe('Bugs & Severity Chips', () => {
    it('Severity chips map correctly', () => {
      const low = getSeverityChip('Low');
      expect(low.label).toBe('Low');
      expect(low.className).toContain('text-slate-700');

      const medium = getSeverityChip('Medium');
      expect(medium.label).toBe('Medium');
      expect(medium.className).toContain('text-amber-700');

      const high = getSeverityChip('High');
      expect(high.label).toBe('High');
      expect(high.className).toContain('text-orange-700');

      const critical = getSeverityChip('Critical');
      expect(critical.label).toBe('Critical');
      expect(critical.className).toContain('text-rose-700');
    });

    it('Resolve flips the bug to Resolved and hides the button', async () => {
      const user = userEvent.setup();

      mockBugs = [
        {
          id: 'bug-critical-1',
          taskId: TASK_ID,
          severity: 'Critical',
          status: 'Open',
          reportedBy: USER_1,
          assignedTo: USER_2,
          createdAt: new Date().toISOString(),
          resolvedAt: null,
          description: 'Memory leak causes browser tab crash after 100 drags',
        },
      ];

      renderWithProviders(
        <BugsTab
          taskId={TASK_ID}
          projectId={PROJECT_ID}
          memberMap={mockMemberMap}
        />
      );

      // Verify bug is rendered with Open status and Resolve button
      await waitFor(() => {
        expect(screen.getByTestId('bug-item-bug-critical-1')).toBeInTheDocument();
      });

      expect(screen.getByTestId('severity-chip-critical')).toBeInTheDocument();
      expect(screen.getByTestId('status-chip-open')).toBeInTheDocument();
      expect(screen.getByText(/Alice Engineer/i)).toBeInTheDocument();
      expect(screen.getByText(/Bob Architect/i)).toBeInTheDocument();

      const resolveBtn = screen.getByTestId('resolve-bug-bug-critical-1');
      expect(resolveBtn).toBeInTheDocument();

      // Click resolve
      await user.click(resolveBtn);

      // Optimistically / on settlement: status changes to Resolved, button is hidden
      await waitFor(() => {
        expect(screen.getByTestId('status-chip-resolved')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('resolve-bug-bug-critical-1')).not.toBeInTheDocument();
      expect(mockBugs[0].status).toBe('Resolved');
    });

    it('Opens report bug modal, validates fields, and creates a defect', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <BugsTab
          taskId={TASK_ID}
          projectId={PROJECT_ID}
          memberMap={mockMemberMap}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('empty-bugs')).toBeInTheDocument();
      });

      // Click Report Bug button
      const openModalBtn = screen.getByTestId('report-bug-btn');
      await user.click(openModalBtn);

      expect(screen.getByTestId('report-bug-modal')).toBeInTheDocument();

      const submitBtn = screen.getByTestId('submit-bug-btn');
      expect(submitBtn).toBeDisabled();

      // Fill in description and change severity
      const descInput = screen.getByLabelText(/description & reproduction/i);
      await user.type(descInput, 'Drop zone fails to highlight on mobile touch screens');

      const severitySelect = screen.getByLabelText(/severity/i);
      await user.selectOptions(severitySelect, 'High');

      const assigneeSelect = screen.getByLabelText(/assignee/i);
      await user.selectOptions(assigneeSelect, USER_2);

      expect(submitBtn).toBeEnabled();
      await user.click(submitBtn);

      // Modal closes and new bug appears in list
      await waitFor(() => {
        expect(screen.queryByTestId('report-bug-modal')).not.toBeInTheDocument();
        expect(screen.getByText('High')).toBeInTheDocument();
      });

      expect(mockBugs).toHaveLength(1);
      expect(mockBugs[0].severity).toBe('High');
      expect(mockBugs[0].assignedTo).toBe(USER_2);
      expect(mockBugs[0].description).toBe(
        'Drop zone fails to highlight on mobile touch screens'
      );
    });
  });

  describe('TestCasesTab & useAddTestCase', () => {
    it('Renders test cases list, Pass/Fail chips, and allows adding a new test case', async () => {
      const user = userEvent.setup();

      mockTestCases = [
        {
          id: 'tc-first',
          description: 'Initial state verification',
          expectedResult: 'Backlog column shows correct card count',
          passed: true,
          executedBy: USER_1,
          executedAt: new Date().toISOString(),
        },
      ];

      renderWithProviders(
        <TestCasesTab
          taskId={TASK_ID}
          projectId={PROJECT_ID}
          memberMap={mockMemberMap}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Initial state verification')).toBeInTheDocument();
      });

      expect(screen.getByTestId('chip-pass')).toBeInTheDocument();
      expect(screen.getByTestId('test-summary-text')).toHaveTextContent('1 passed, 0 failed');

      // Open Add form
      const openFormBtn = screen.getByRole('button', { name: /add test case/i });
      await user.click(openFormBtn);

      const descInput = screen.getByLabelText(/description/i);
      const expectedInput = screen.getByLabelText(/expected result/i);
      const passedCheckbox = screen.getByRole('checkbox', { name: /passed verification/i });

      await user.type(descInput, 'Drag card across columns rapidly');
      await user.type(expectedInput, 'Database status updates and persists');
      // Uncheck passed to test failing case
      await user.click(passedCheckbox);

      const addBtn = screen.getByRole('button', { name: /^add test case$/i });
      await user.click(addBtn);

      // Wait for new test case to render
      await waitFor(() => {
        expect(screen.getByText('Drag card across columns rapidly')).toBeInTheDocument();
        expect(screen.getByTestId('chip-fail')).toBeInTheDocument();
      });

      expect(screen.getByTestId('test-summary-text')).toHaveTextContent('1 passed, 1 failed');
      expect(mockTestCases).toHaveLength(2);
      expect(mockTestCases[1].passed).toBe(false);
    });

    it('Exports useAddTestCase hook reusable by AI features (F8)', async () => {
      const queryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      );

      const { result } = renderHook(
        () => useAddTestCase(TASK_ID, PROJECT_ID),
        { wrapper }
      );

      expect(result.current.mutate).toBeDefined();

      await act(async () => {
        await result.current.mutateAsync({
          description: 'AI-generated test scenario: boundary value input',
          expectedResult: 'Throws 400 Bad Request with field error detail',
          passed: true,
        });
      });

      expect(mockTestCases.some((t) => t.description.includes('AI-generated'))).toBe(true);
    });
  });

  describe('Mounting in TaskPanel slot', () => {
    it('Mounts a "Bugs" tab and a "Test cases" tab in TaskPanel slot and toggles between them', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <QualitySection
          taskId={TASK_ID}
          projectId={PROJECT_ID}
          memberMap={mockMemberMap}
        />
      );

      expect(screen.getByTestId('section-bugs-tests')).toBeInTheDocument();

      const bugsTabBtn = screen.getByTestId('tab-button-bugs');
      const testCasesTabBtn = screen.getByTestId('tab-button-test-cases');

      expect(bugsTabBtn).toBeInTheDocument();
      expect(testCasesTabBtn).toBeInTheDocument();

      // Bugs tab is default
      expect(screen.getByTestId('tab-bugs')).toBeInTheDocument();

      // Switch to Test cases tab
      await user.click(testCasesTabBtn);
      expect(screen.getByTestId('tab-test-cases')).toBeInTheDocument();
      expect(screen.queryByTestId('tab-bugs')).not.toBeInTheDocument();

      // Switch back to Bugs tab
      await user.click(bugsTabBtn);
      expect(screen.getByTestId('tab-bugs')).toBeInTheDocument();
    });

    it('Mounts QualitySection directly inside TaskPanel', async () => {
      const mockTask: Task = {
        id: TASK_ID,
        title: 'Refactor Core Storage Service',
        category: 'Backend',
        priority: 'High',
        status: 'InProgress',
      };

      renderWithProviders(
        <TaskPanel
          projectId={PROJECT_ID}
          tasks={[mockTask]}
          memberMap={mockMemberMap}
          isLoadingTasks={false}
        />,
        [`/app/projects/${PROJECT_ID}?task=${TASK_ID}`]
      );

      // Verify QualitySection is mounted in TaskPanel
      await waitFor(() => {
        expect(screen.getByTestId('section-bugs-tests')).toBeInTheDocument();
        expect(screen.getByTestId('tab-button-bugs')).toBeInTheDocument();
        expect(screen.getByTestId('tab-button-test-cases')).toBeInTheDocument();
      });
    });
  });
});
