import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { PlanPreview } from '../components/ai/PlanPreview';
import { AiPlanModal } from '../components/ai/AiPlanModal';
import { AiTestCasesPanel } from '../components/ai/AiTestCasesPanel';
import { NextTaskCard } from '../components/ai/NextTaskCard';
import { PlanModule, GenerateProjectPlanResponse, GenerateTestCasesResponse } from '../types/ai';

const PROJECT_ID = 'proj-ai-123';
const TASK_ID = 'task-ai-456';
const RELATED_TASK_ID = 'task-related-789';

let failPlanGeneration = false;
let failTestCasesGeneration = false;
let failSpecificTestCaseSave: string | null = null;
let lastConfirmedPayload: any = null;

const sampleModules: PlanModule[] = [
  {
    name: 'Authentication Module',
    tasks: [
      { title: 'Setup JWT authentication', category: 'Backend', priority: 'High' },
      { title: 'Create Login and Register forms', category: 'Frontend', priority: 'Medium' },
    ],
  },
  {
    name: 'Task Management Module',
    tasks: [
      { title: 'Design database schema for tasks', category: 'Database', priority: 'High' },
      { title: 'Implement Kanban Board drag and drop', category: 'Frontend', priority: 'High' },
      { title: 'Setup automated QA regression suite', category: 'Testing', priority: 'Low' },
    ],
  },
];

const server = setupServer(
  // AI Plan generation
  http.post('*/api/ai/project-plan', () => {
    if (failPlanGeneration) {
      return HttpResponse.json(
        { error: 'Bad Gateway', message: 'Grok API rate limit exceeded', status: 502 },
        { status: 502 }
      );
    }
    return HttpResponse.json<GenerateProjectPlanResponse>({
      modules: sampleModules,
    });
  }),

  // AI Plan confirmation
  http.post('*/api/ai/project-plan/confirm', async ({ request }) => {
    const body = await request.json();
    lastConfirmedPayload = body;
    const taskCount = (body as any).modules?.reduce(
      (acc: number, m: any) => acc + (m.tasks?.length || 0),
      0
    ) || 0;

    return HttpResponse.json(
      {
        createdCount: taskCount,
        taskIds: Array.from({ length: taskCount }, (_, i) => `created-task-${i}`),
      },
      { status: 201 }
    );
  }),

  // AI Test Cases generation
  http.post('*/api/ai/test-cases', () => {
    if (failTestCasesGeneration) {
      return HttpResponse.json(
        { error: 'Bad Gateway', message: 'AI upstream timeout', status: 502 },
        { status: 502 }
      );
    }
    return HttpResponse.json<GenerateTestCasesResponse>({
      testCases: [
        {
          title: 'Verify valid credentials redirect to dashboard',
          expectedResult: 'HTTP 200 and auth token stored',
        },
        {
          title: 'Verify SQL injection payload is sanitized',
          expectedResult: 'Parameterized query rejects unescaped SQL',
        },
      ],
    });
  }),

  // Saving test case via F7 endpoint
  http.post('*/api/tasks/:taskId/test-cases', async ({ request }) => {
    const body = (await request.json()) as any;
    if (failSpecificTestCaseSave && body.description === failSpecificTestCaseSave) {
      return HttpResponse.json(
        { error: 'Internal Server Error', message: 'Database lock timeout', status: 500 },
        { status: 500 }
      );
    }
    return HttpResponse.json(
      {
        id: `tc-${Date.now()}`,
        description: body.description,
        expectedResult: body.expectedResult,
        passed: body.passed,
        executedBy: 'user-1',
        executedAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  // Next task recommendation
  http.get('*/api/ai/next-task/:projectId', () => {
    return HttpResponse.json({
      recommendation: 'Focus on setting up JWT authentication to unblock the frontend routes.',
      relatedTaskId: RELATED_TASK_ID,
    });
  })
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

describe('MODULE F8: AI Features', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    failPlanGeneration = false;
    failTestCasesGeneration = false;
    failSpecificTestCaseSave = null;
    lastConfirmedPayload = null;
  });

  describe('Project Plan & PlanPreview', () => {
    it('Plan preview renders, deselecting reduces the count, confirm sends only selected items', async () => {
      const user = userEvent.setup();
      let confirmedModules: PlanModule[] = [];

      render(
        <PlanPreview
          modules={sampleModules}
          onConfirm={(mods) => {
            confirmedModules = mods;
          }}
          isConfirming={false}
        />
      );

      // Verify overview and initial count: 5 total tasks
      expect(screen.getByText(/2 modules proposed • 5 total tasks/i)).toBeInTheDocument();
      const confirmBtn = screen.getByTestId('confirm-plan-btn');
      expect(confirmBtn).toHaveTextContent('Add 5 tasks?');

      // Deselect 1 task in Module 0
      const taskCheckbox = screen.getByTestId('checkbox-task-0-0');
      expect(taskCheckbox).toBeChecked();
      await user.click(taskCheckbox);
      expect(taskCheckbox).not.toBeChecked();

      // Count is reduced to 4
      expect(confirmBtn).toHaveTextContent('Add 4 tasks?');

      // Deselect entire Module 1 (3 tasks)
      const module1Checkbox = screen.getByTestId('checkbox-module-1');
      await user.click(module1Checkbox);

      // Count is now 1 task
      expect(confirmBtn).toHaveTextContent('Add 1 tasks?');

      // Click Confirm
      await user.click(confirmBtn);

      // Only selected items are sent
      expect(confirmedModules).toHaveLength(1);
      expect(confirmedModules[0].name).toBe('Authentication Module');
      expect(confirmedModules[0].tasks).toHaveLength(1);
      expect(confirmedModules[0].tasks[0].title).toBe('Create Login and Register forms');
    });

    it('502 shows the retry state in AiPlanModal and retries successfully', async () => {
      const user = userEvent.setup();
      failPlanGeneration = true;

      renderWithProviders(
        <AiPlanModal
          isOpen={true}
          onClose={() => {}}
          projectId={PROJECT_ID}
        />
      );

      // 502 error state shows friendly message and retry button
      await waitFor(() => {
        expect(screen.getByTestId('ai-error')).toBeInTheDocument();
        expect(screen.getByText('The AI service is unavailable, try again')).toBeInTheDocument();
      });

      const retryBtn = screen.getByTestId('ai-retry-btn');
      expect(retryBtn).toBeInTheDocument();

      // Fix failure and click Retry
      failPlanGeneration = false;
      await user.click(retryBtn);

      // Plan preview renders after successful retry
      await waitFor(() => {
        expect(screen.getByTestId('plan-preview')).toBeInTheDocument();
        expect(screen.getByText('Authentication Module')).toBeInTheDocument();
      });
    });

    it('Editing title, priority, category, and description updates the payload sent on confirm', async () => {
      const user = userEvent.setup();
      let confirmedModules: PlanModule[] = [];

      render(
        <PlanPreview
          modules={sampleModules}
          onConfirm={(mods) => {
            confirmedModules = mods;
          }}
          isConfirming={false}
        />
      );

      // Edit title of task 0-0
      const titleInput = screen.getByTestId('task-title-input-0-0');
      await user.clear(titleInput);
      await user.type(titleInput, 'Custom OAuth2 Setup');

      // Edit priority of task 0-0
      const prioritySelect = screen.getByTestId('task-priority-select-0-0');
      await user.selectOptions(prioritySelect, 'Low');

      // Edit category of task 0-0
      const categorySelect = screen.getByTestId('task-category-select-0-0');
      await user.selectOptions(categorySelect, 'Frontend');

      // Edit description of task 0-0
      const descInput = screen.getByTestId('task-description-input-0-0');
      await user.type(descInput, 'Add Google and GitHub OAuth providers');

      // Edit module name
      const modNameInput = screen.getByTestId('module-name-input-0');
      await user.clear(modNameInput);
      await user.type(modNameInput, 'Security & Auth');

      // Confirm
      const confirmBtn = screen.getByTestId('confirm-plan-btn');
      await user.click(confirmBtn);

      expect(confirmedModules[0].name).toBe('Security & Auth');
      expect(confirmedModules[0].tasks[0].title).toBe('Custom OAuth2 Setup');
      expect(confirmedModules[0].tasks[0].priority).toBe('Low');
      expect(confirmedModules[0].tasks[0].category).toBe('Frontend');
      expect(confirmedModules[0].tasks[0].description).toBe('Add Google and GitHub OAuth providers');
    });

    it('Removing tasks updates live count, empty modules disappear, and removed tasks are not sent', async () => {
      const user = userEvent.setup();
      let confirmedModules: PlanModule[] = [];

      render(
        <PlanPreview
          modules={sampleModules}
          onConfirm={(mods) => {
            confirmedModules = mods;
          }}
          isConfirming={false}
        />
      );

      expect(screen.getByTestId('selected-tasks-count')).toHaveTextContent('5 selected');
      const confirmBtn = screen.getByTestId('confirm-plan-btn');
      expect(confirmBtn).toHaveTextContent('Add 5 tasks?');

      // Remove task 0-0
      const removeBtn0 = screen.getByTestId('remove-task-btn-0-0');
      await user.click(removeBtn0);

      // Count is now 4
      expect(screen.getByTestId('selected-tasks-count')).toHaveTextContent('4 selected');
      expect(confirmBtn).toHaveTextContent('Add 4 tasks?');

      // Remove task 0-0 (which is the remaining task in module 0)
      const removeBtnNext = screen.getByTestId('remove-task-btn-0-0');
      await user.click(removeBtnNext);

      // Module 0 had all tasks removed -> empty module disappears!
      expect(screen.queryByText('Authentication Module')).not.toBeInTheDocument();
      expect(screen.getByTestId('selected-tasks-count')).toHaveTextContent('3 selected');
      expect(confirmBtn).toHaveTextContent('Add 3 tasks?');

      // Deselect 1 task in Module 1 (which is now index 0)
      const taskCheckbox = screen.getByTestId('checkbox-task-0-0');
      await user.click(taskCheckbox);

      expect(screen.getByTestId('selected-tasks-count')).toHaveTextContent('2 selected');
      expect(confirmBtn).toHaveTextContent('Add 2 tasks?');

      // Click Confirm
      await user.click(confirmBtn);

      // Sent payload only contains the 2 selected tasks from the remaining module
      expect(confirmedModules).toHaveLength(1);
      expect(confirmedModules[0].name).toBe('Task Management Module');
      expect(confirmedModules[0].tasks).toHaveLength(2);
    });

    it('Reset to AI suggestion action per task restores the original values', async () => {
      const user = userEvent.setup();

      render(
        <PlanPreview
          modules={sampleModules}
          onConfirm={() => {}}
          isConfirming={false}
        />
      );

      // Initially no reset button visible because task is unmodified
      expect(screen.queryByTestId('reset-task-btn-0-0')).not.toBeInTheDocument();

      // Edit title and priority
      const titleInput = screen.getByTestId('task-title-input-0-0');
      await user.type(titleInput, ' - EDITED');

      // Reset button appears
      const resetBtn = screen.getByTestId('reset-task-btn-0-0');
      expect(resetBtn).toBeInTheDocument();

      // Click reset
      await user.click(resetBtn);

      // Value restored to original
      expect(titleInput).toHaveValue('Setup JWT authentication');
      expect(screen.queryByTestId('reset-task-btn-0-0')).not.toBeInTheDocument();
    });

    it('Inline validation shows errors and blocks Confirm button', async () => {
      const user = userEvent.setup();

      render(
        <PlanPreview
          modules={sampleModules}
          onConfirm={() => {}}
          isConfirming={false}
        />
      );

      const confirmBtn = screen.getByTestId('confirm-plan-btn');
      expect(confirmBtn).toBeEnabled();

      // Clear title (empty title is invalid)
      const titleInput = screen.getByTestId('task-title-input-0-0');
      await user.clear(titleInput);

      // Error shown and confirm disabled
      expect(screen.getByTestId('task-title-error-0-0')).toBeInTheDocument();
      expect(confirmBtn).toBeDisabled();

      // Fix title
      await user.type(titleInput, 'Valid Title');
      expect(screen.queryByTestId('task-title-error-0-0')).not.toBeInTheDocument();
      expect(confirmBtn).toBeEnabled();

      // Exceed description 255 chars
      const descInput = screen.getByTestId('task-description-input-0-0');
      const longText = 'a'.repeat(256);
      await user.type(descInput, longText);

      expect(screen.getByTestId('task-description-error-0-0')).toHaveTextContent(
        'Description must be 255 characters or less'
      );
      expect(screen.getByTestId('description-counter-0-0')).toHaveTextContent('256/255');
      expect(confirmBtn).toBeDisabled();

      // Fix description
      await user.clear(descInput);
      await user.type(descInput, 'Short description');
      expect(screen.queryByTestId('task-description-error-0-0')).not.toBeInTheDocument();
      expect(confirmBtn).toBeEnabled();
    });

    it('Server 400 fieldErrors map back to the right row and field', async () => {
      render(
        <PlanPreview
          modules={sampleModules}
          onConfirm={() => {}}
          isConfirming={false}
          serverFieldErrors={{
            'modules[0].tasks[1].category': 'Category must be one of: Frontend, Backend, Database, Testing, Documentation',
            'modules[1].tasks[0].title': 'Title must be 200 characters or less',
          }}
        />
      );

      // Error lands on module 0, task 1 category
      expect(screen.getByTestId('task-category-error-0-1')).toHaveTextContent(
        'Category must be one of: Frontend, Backend, Database, Testing, Documentation'
      );

      // Error lands on module 1, task 0 title
      expect(screen.getByTestId('task-title-error-1-0')).toHaveTextContent(
        'Title must be 200 characters or less'
      );
    });

    it('Cancel/close after editing asks for confirmation before discarding', async () => {
      const user = userEvent.setup();
      let closed = false;

      renderWithProviders(
        <AiPlanModal
          isOpen={true}
          onClose={() => {
            closed = true;
          }}
          projectId={PROJECT_ID}
        />
      );

      // Wait for plan preview to load
      await waitFor(() => {
        expect(screen.getByTestId('plan-preview')).toBeInTheDocument();
      });

      // Edit a task title to make draft dirty
      const titleInput = screen.getByTestId('task-title-input-0-0');
      await user.type(titleInput, ' edited');

      // Click close button
      const closeBtn = screen.getByLabelText('Close plan modal');
      await user.click(closeBtn);

      // Modal is NOT closed yet, discard confirmation dialog is displayed
      expect(closed).toBe(false);
      expect(screen.getByTestId('discard-confirm-dialog')).toBeInTheDocument();
      expect(screen.getByText('Discard plan edits?')).toBeInTheDocument();

      // Click "Keep editing"
      const keepEditingBtn = screen.getByTestId('confirm-dialog-cancel-button');
      await user.click(keepEditingBtn);

      // Confirmation dialog is closed, modal is still open, edits preserved
      expect(screen.queryByTestId('discard-confirm-dialog')).not.toBeInTheDocument();
      expect(screen.getByTestId('plan-preview')).toBeInTheDocument();
      expect(screen.getByTestId('task-title-input-0-0')).toHaveValue(
        'Setup JWT authentication edited'
      );
      expect(closed).toBe(false);

      // Click close button again and choose "Discard"
      await user.click(closeBtn);
      const discardBtn = screen.getByTestId('confirm-dialog-confirm-button');
      await user.click(discardBtn);

      // Now onClose was called!
      expect(closed).toBe(true);
    });
  });

  describe('AI Test Cases Panel & Partial Failure', () => {
    it('502 shows the retry state for AI test cases', async () => {
      const user = userEvent.setup();
      failTestCasesGeneration = true;

      renderWithProviders(
        <AiTestCasesPanel
          taskId={TASK_ID}
          projectId={PROJECT_ID}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('ai-error')).toBeInTheDocument();
        expect(screen.getByText('The AI service is unavailable, try again')).toBeInTheDocument();
      });

      const retryBtn = screen.getByTestId('ai-retry-btn');
      expect(retryBtn).toBeInTheDocument();

      failTestCasesGeneration = false;
      await user.click(retryBtn);

      await waitFor(() => {
        expect(
          screen.getByText('Verify valid credentials redirect to dashboard')
        ).toBeInTheDocument();
      });
    });

    it('Saving selected test cases handles a partial failure with Promise.allSettled', async () => {
      const user = userEvent.setup();
      let savedCalled = false;

      // Make the 2nd test case fail
      failSpecificTestCaseSave = 'Verify SQL injection payload is sanitized';

      renderWithProviders(
        <AiTestCasesPanel
          taskId={TASK_ID}
          projectId={PROJECT_ID}
          onSaved={() => {
            savedCalled = true;
          }}
        />
      );

      // Wait for test cases to load (all selected by default)
      await waitFor(() => {
        expect(screen.getByTestId('generated-test-case-0')).toBeInTheDocument();
        expect(screen.getByTestId('generated-test-case-1')).toBeInTheDocument();
      });

      const saveBtn = screen.getByTestId('save-selected-test-cases-btn');
      expect(saveBtn).toHaveTextContent('Save selected (2)');

      // Click save selected
      await user.click(saveBtn);

      // Promise.allSettled gracefully completes without crashing
      await waitFor(() => {
        expect(savedCalled).toBe(true);
      });
    });
  });

  describe('NextTaskCard', () => {
    // Helper component to track active query params
    const LocationInspector = () => {
      const location = useLocation();
      return <div data-testid="current-search">{location.search}</div>;
    };

    it('NextTaskCard renders recommendation and Open task sets query param', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <>
          <NextTaskCard projectId={PROJECT_ID} />
          <LocationInspector />
        </>,
        [`/app/projects/${PROJECT_ID}`]
      );

      // Wait for recommendation to load
      await waitFor(() => {
        expect(screen.getByTestId('next-task-recommendation')).toHaveTextContent(
          'Focus on setting up JWT authentication to unblock the frontend routes.'
        );
      });

      // Open task button is visible
      const openTaskBtn = screen.getByTestId('open-task-btn');
      expect(openTaskBtn).toBeInTheDocument();

      // Click Open task
      await user.click(openTaskBtn);

      // Search param is updated with ?task=<relatedTaskId>
      await waitFor(() => {
        expect(screen.getByTestId('current-search')).toHaveTextContent(`?task=${RELATED_TASK_ID}`);
      });
    });
  });
});
