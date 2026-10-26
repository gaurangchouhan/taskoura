import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { ProjectBoardPage } from '../pages/ProjectBoardPage';
import { TaskCard } from '../components/TaskCard';
import {
  getSubtasks,
  createSubtask,
  useSubtasks,
  useCreateSubtask,
  SubtaskProgress,
  SubtaskRow,
  SubtasksSection,
} from '../features/subtasks';
import { setToken, setStoredUser } from '../lib/token';
import { Task } from '../types/task';
import { Project } from '../types/project';
import { ProjectMember } from '../types/member';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

const PROJECT_ID = 'proj-subtask-test-1';
const CURRENT_USER_ID = 'user-owner-1';
const PARENT_TASK_ID = 'task-parent-100';
const CHILD_TASK_ID = 'task-sub-101';

let mockProjects: Project[] = [];
let mockTasks: Task[] = [];
let mockMembers: ProjectMember[] = [];
let failCreateSubtaskWithNestedError = false;

const server = setupServer(
  http.get('*/api/projects', () => {
    return HttpResponse.json(mockProjects);
  }),

  http.get('*/api/projects/:id', ({ params }) => {
    const found = mockProjects.find((p) => p.id === params.id);
    if (!found) return HttpResponse.json({ message: 'Project not found' }, { status: 404 });
    return HttpResponse.json(found);
  }),

  http.get('*/api/projects/:id/members', () => {
    return HttpResponse.json(mockMembers);
  }),

  http.get('*/api/projects/:id/tasks', () => {
    return HttpResponse.json(mockTasks);
  }),

  http.get('*/api/projects/:id/ai/next-task', () => {
    return HttpResponse.json(null);
  }),

  http.get('*/api/notifications*', () => {
    return HttpResponse.json([]);
  }),

  http.get('*/api/tasks/:parentTaskId/subtasks', ({ params }) => {
    const parentId = params.parentTaskId;
    const subtasks = mockTasks.filter((t) => t.parentTaskId === parentId);
    return HttpResponse.json(subtasks);
  }),

  http.post('*/api/tasks/:parentTaskId/subtasks', async ({ params, request }) => {
    const parentId = params.parentTaskId as string;
    const parent = mockTasks.find((t) => t.id === parentId);

    if (failCreateSubtaskWithNestedError || (parent && parent.parentTaskId)) {
      return HttpResponse.json(
        {
          status: 400,
          error: 'Bad Request',
          message: 'Subtasks cannot have nested subtasks (maximum 1 level of nesting allowed)',
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Partial<Task>;
    const newSubtask: Task = {
      id: `task-sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: body.title || 'Untitled Subtask',
      description: body.description,
      category: body.category || 'Backend',
      priority: body.priority || 'Medium',
      status: 'Backlog',
      assignedTo: body.assignedTo,
      deadline: body.deadline,
      parentTaskId: parentId,
      subtaskCount: 0,
    };

    mockTasks.push(newSubtask);

    // Update parent's subtaskCount
    if (parent) {
      parent.subtaskCount = (parent.subtaskCount || 0) + 1;
    }

    return HttpResponse.json(newSubtask, { status: 201 });
  }),

  http.patch('*/api/tasks/:taskId/status', async ({ params, request }) => {
    const body = (await request.json()) as { status: Task['status'] };
    const task = mockTasks.find((t) => t.id === params.taskId);
    if (!task) {
      return HttpResponse.json({ message: 'Task not found' }, { status: 404 });
    }
    task.status = body.status;

    // Update parent task completedSubtaskCount if applicable
    if (task.parentTaskId) {
      const parent = mockTasks.find((t) => t.id === task.parentTaskId);
      if (parent) {
        const completedCount = mockTasks.filter(
          (t) => t.parentTaskId === parent.id && t.status === 'Completed'
        ).length;
        parent.completedSubtaskCount = completedCount;
      }
    }

    return HttpResponse.json(task);
  }),

  http.get('*/api/tasks/:taskId/status-logs', () => {
    return HttpResponse.json([]);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());

beforeEach(() => {
  server.resetHandlers();
  failCreateSubtaskWithNestedError = false;

  const validToken = createJwt({
    sub: 'owner@taskoura.io',
    userId: CURRENT_USER_ID,
    name: 'Alice Owner',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  setToken(validToken);
  setStoredUser({
    id: CURRENT_USER_ID,
    email: 'owner@taskoura.io',
    name: 'Alice Owner',
  });

  mockProjects = [
    {
      id: PROJECT_ID,
      name: 'Cloud Engine Project',
      description: 'Distributed execution platform',
      ownerId: CURRENT_USER_ID,
      createdAt: '2026-10-01T10:00:00Z',
    },
  ];

  mockMembers = [
    {
      id: 'mem-1',
      userId: CURRENT_USER_ID,
      userEmail: 'owner@taskoura.io',
      userName: 'Alice Owner',
      role: 'Owner',
    },
    {
      id: 'mem-2',
      userId: 'user-dev-2',
      userEmail: 'bob@taskoura.io',
      userName: 'Bob Developer',
      role: 'Member',
    },
  ];

  mockTasks = [
    {
      id: PARENT_TASK_ID,
      title: 'Design API Gateway Architecture',
      category: 'Backend',
      priority: 'High',
      status: 'InProgress',
      subtaskCount: 1,
      completedSubtaskCount: 0,
    },
    {
      id: CHILD_TASK_ID,
      title: 'Configure Rate Limiter Plugin',
      category: 'Backend',
      priority: 'Medium',
      status: 'Backlog',
      parentTaskId: PARENT_TASK_ID,
      subtaskCount: 0,
    },
    {
      id: 'task-other-200',
      title: 'Setup Database Connection Pool',
      category: 'Database',
      priority: 'Medium',
      status: 'Backlog',
      subtaskCount: 0,
    },
  ];
});

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function renderBoardPage(initialEntry: string = `/projects/${PROJECT_ID}/board`) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/projects/:projectId/board" element={<ProjectBoardPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('MODULE F14: Subtasks', () => {
  describe('Backend Contract & API Helpers', () => {
    it('getSubtasks fetches list from GET /api/tasks/:parentTaskId/subtasks', async () => {
      const subtasks = await getSubtasks(PARENT_TASK_ID);
      expect(subtasks).toHaveLength(1);
      expect(subtasks[0].id).toBe(CHILD_TASK_ID);
      expect(subtasks[0].parentTaskId).toBe(PARENT_TASK_ID);
    });

    it('createSubtask posts payload to /api/tasks/:parentTaskId/subtasks', async () => {
      const created = await createSubtask(PARENT_TASK_ID, {
        title: 'Add JWT validation layer',
        category: 'Backend',
        priority: 'High',
      });
      expect(created.title).toBe('Add JWT validation layer');
      expect(created.parentTaskId).toBe(PARENT_TASK_ID);
    });
  });

  describe('SubtaskProgress Component', () => {
    it('calculates progress math correctly: 0 completed, partial completed, all completed', () => {
      // 1. Zero completed (0 of 3 done)
      const { rerender } = render(
        <SubtaskProgress
          subtasks={[
            { id: '1', status: 'Backlog' },
            { id: '2', status: 'InProgress' },
            { id: '3', status: 'Testing' },
          ]}
        />
      );
      expect(screen.getByTestId('subtask-progress-label')).toHaveTextContent('0 of 3 done');
      expect(screen.getByTestId('subtask-progress-percent')).toHaveTextContent('0%');

      // 2. Partial completed (2 of 3 done)
      rerender(
        <SubtaskProgress
          subtasks={[
            { id: '1', status: 'Completed' },
            { id: '2', status: 'Completed' },
            { id: '3', status: 'Backlog' },
          ]}
        />
      );
      expect(screen.getByTestId('subtask-progress-label')).toHaveTextContent('2 of 3 done');
      expect(screen.getByTestId('subtask-progress-percent')).toHaveTextContent('67%');

      // 3. All completed (3 of 3 done)
      rerender(
        <SubtaskProgress
          subtasks={[
            { id: '1', status: 'Completed' },
            { id: '2', status: 'Completed' },
            { id: '3', status: 'Completed' },
          ]}
        />
      );
      expect(screen.getByTestId('subtask-progress-label')).toHaveTextContent('3 of 3 done');
      expect(screen.getByTestId('subtask-progress-percent')).toHaveTextContent('100%');
    });

    it('returns null if there are no subtasks', () => {
      const { container } = render(<SubtaskProgress subtasks={[]} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('TaskCard Subtask Badge', () => {
    it('shows subtask badge when subtaskCount > 0, and hides when 0 or undefined', () => {
      const parentTask: Task = {
        id: 't-1',
        title: 'Parent Task',
        category: 'Backend',
        priority: 'High',
        status: 'InProgress',
        subtaskCount: 3,
        completedSubtaskCount: 2,
      };

      const { rerender } = render(<TaskCard task={parentTask} />);
      const badge = screen.getByTestId('subtask-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('2/3');

      // No badge when subtaskCount === 0
      rerender(<TaskCard task={{ ...parentTask, subtaskCount: 0 }} />);
      expect(screen.queryByTestId('subtask-badge')).toBeNull();
    });
  });

  describe('Board Filtering: Subtasks Excluded from Board Columns', () => {
    it('board shows only top-level tasks and excludes any task with a parentTaskId', async () => {
      renderBoardPage();

      // Top-level task should appear on the board
      await waitFor(() => {
        expect(screen.getByText('Design API Gateway Architecture')).toBeInTheDocument();
      });
      expect(screen.getByText('Setup Database Connection Pool')).toBeInTheDocument();

      // Child subtask should NOT be rendered in any board column
      expect(screen.queryByText('Configure Rate Limiter Plugin')).toBeNull();

      // Board header shows count of top-level tasks (2 tasks)
      expect(screen.getByText('(2 tasks)')).toBeInTheDocument();
    });
  });

  describe('SubtasksSection: Nesting Rules & Error Handling', () => {
    it('renders "Add subtask" button for a top-level task and submits new subtask', async () => {
      const user = userEvent.setup();
      const parentTask = mockTasks[0]; // Top-level task

      renderWithClient(
        <SubtasksSection
          task={parentTask}
          projectId={PROJECT_ID}
          memberMap={new Map()}
        />
      );

      // Verify subtask count badge and existing subtask row
      await waitFor(() => {
        expect(screen.getByTestId('subtask-count-badge')).toHaveTextContent('1');
        expect(screen.getByText('Configure Rate Limiter Plugin')).toBeInTheDocument();
      });

      // Click "Add Subtask"
      const addBtn = screen.getByTestId('add-subtask-btn');
      await user.click(addBtn);

      // Fill in title
      const titleInput = screen.getByTestId('subtask-title-input');
      await user.type(titleInput, 'Implement Distributed Tracing');

      // Submit
      const submitBtn = screen.getByTestId('subtask-submit-btn');
      await user.click(submitBtn);

      // Verify new subtask appears in list
      await waitFor(() => {
        expect(screen.getByText('Implement Distributed Tracing')).toBeInTheDocument();
      });
    });

    it('HIDES "Add subtask" form when open task is itself a subtask (parentTaskId is set)', async () => {
      const childTask = mockTasks[1]; // has parentTaskId: PARENT_TASK_ID

      renderWithClient(
        <SubtasksSection
          task={childTask}
          projectId={PROJECT_ID}
          memberMap={new Map()}
        />
      );

      // Add subtask button must NOT be present
      expect(screen.queryByTestId('add-subtask-btn')).toBeNull();
      expect(screen.queryByTestId('add-subtask-form')).toBeNull();
      expect(screen.getByTestId('nested-subtask-badge')).toHaveTextContent(/subtask of another task/i);
    });

    it('shows backend error message if nested subtask is rejected by server', async () => {
      failCreateSubtaskWithNestedError = true;
      const user = userEvent.setup();
      const parentTask = mockTasks[0];

      renderWithClient(
        <SubtasksSection
          task={parentTask}
          projectId={PROJECT_ID}
          memberMap={new Map()}
        />
      );

      await user.click(screen.getByTestId('add-subtask-btn'));
      await user.type(screen.getByTestId('subtask-title-input'), 'Deeply nested subtask');
      await user.click(screen.getByTestId('subtask-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('subtask-error')).toHaveTextContent(
          'Subtasks cannot have nested subtasks (maximum 1 level of nesting allowed)'
        );
      });
    });
  });

  describe('MANUAL: End-to-End Subtask Flow in TaskPanel', () => {
    it(
      'Add three subtasks, complete two, verify progress ("2 of 3 done", 67%) and card badge, then verify subtask cannot nest',
      async () => {
        const user = userEvent.setup();

        // 1. Reset tasks with empty parent task (0 subtasks)
        const cleanParentId = 'task-clean-parent';
        mockTasks = [
          {
            id: cleanParentId,
            title: 'Build Authentication Microservice',
            category: 'Backend',
            priority: 'High',
            status: 'Backlog',
            subtaskCount: 0,
            completedSubtaskCount: 0,
          },
        ];

        // Render board page with TaskPanel open (?task=cleanParentId)
        renderBoardPage(`/projects/${PROJECT_ID}/board?task=${cleanParentId}`);

        // Wait for TaskPanel to open
        const panel = await screen.findByRole('dialog', { name: /task details panel/i });
        expect(panel).toBeInTheDocument();
        expect(within(panel).getByText('Build Authentication Microservice')).toBeInTheDocument();

        const subtaskSection = screen.getByTestId('section-subtasks');
        expect(subtaskSection).toBeInTheDocument();

        // Add 1st subtask
        await user.click(within(subtaskSection).getByTestId('add-subtask-btn'));
        await user.type(screen.getByTestId('subtask-title-input'), 'Subtask 1: Token Generation');
        await user.click(screen.getByTestId('subtask-submit-btn'));

        // Add 2nd subtask
        await waitFor(() => expect(screen.getByText('Subtask 1: Token Generation')).toBeInTheDocument());
        await user.click(within(subtaskSection).getByTestId('add-subtask-btn'));
        await user.type(screen.getByTestId('subtask-title-input'), 'Subtask 2: Refresh Token DB');
        await user.click(screen.getByTestId('subtask-submit-btn'));

        // Add 3rd subtask
        await waitFor(() => expect(screen.getByText('Subtask 2: Refresh Token DB')).toBeInTheDocument());
        await user.click(within(subtaskSection).getByTestId('add-subtask-btn'));
        await user.type(screen.getByTestId('subtask-title-input'), 'Subtask 3: Revocation Endpoint');
        await user.click(screen.getByTestId('subtask-submit-btn'));

        await waitFor(() => {
          expect(screen.getByText('Subtask 3: Revocation Endpoint')).toBeInTheDocument();
        });

        // Verify initial progress: "0 of 3 done"
        expect(screen.getByTestId('subtask-progress-label')).toHaveTextContent('0 of 3 done');

        // Complete two subtasks
        const sub1 = mockTasks.find((t) => t.title === 'Subtask 1: Token Generation')!;
        const sub2 = mockTasks.find((t) => t.title === 'Subtask 2: Refresh Token DB')!;

        const select1 = screen.getByTestId(`subtask-status-select-${sub1.id}`);
        await user.selectOptions(select1, 'Completed');

        const select2 = screen.getByTestId(`subtask-status-select-${sub2.id}`);
        await user.selectOptions(select2, 'Completed');

        // Verify progress updates to "2 of 3 done" (67%)
        await waitFor(() => {
          expect(screen.getByTestId('subtask-progress-label')).toHaveTextContent('2 of 3 done');
          expect(screen.getByTestId('subtask-progress-percent')).toHaveTextContent('67%');
        });

        // Close TaskPanel to check board task card badge
        const closeBtn = screen.getByLabelText(/close task details/i);
        await user.click(closeBtn);

        // Verify card badge on the board displays 3 subtasks count
        await waitFor(() => {
          const badge = screen.getByTestId('subtask-badge');
          expect(badge).toBeInTheDocument();
          expect(badge).toHaveTextContent('3');
        });

        // Re-open Subtask 1 directly by setting ?task to subtask id
        renderBoardPage(`/projects/${PROJECT_ID}/board?task=${sub1.id}`);

        // Open subtask details: confirm "Add subtask" button is absent
        await waitFor(() => {
          expect(screen.queryByTestId('add-subtask-btn')).toBeNull();
          expect(screen.getByTestId('nested-subtask-badge')).toBeInTheDocument();
        });
      },
      20000
    );
  });
});
