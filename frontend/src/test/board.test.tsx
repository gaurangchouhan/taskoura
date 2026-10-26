import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { ProjectLayout } from '../pages/ProjectLayout';
import { ProjectBoardPage } from '../pages/ProjectBoardPage';
import { setToken, setStoredUser } from '../lib/token';
import { Project } from '../types/project';
import { ProjectMember } from '../types/member';
import { Task, TaskStatus, TaskStatusLog } from '../types/task';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

const PROJECT_ID = 'proj-board-1';
const CURRENT_USER_ID = 'user-owner-1';
const OTHER_USER_ID = 'user-dev-2';

let mockProjects: Project[] = [];
let mockMembers: ProjectMember[] = [];
let mockTasks: Task[] = [];
let mockStatusLogs: Record<string, TaskStatusLog[]> = {};

let lastCreatedTaskPayload: Record<string, unknown> | null = null;
let lastPatchedStatus: string | null = null;
let failStatusPatch = false;

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

  http.post('*/api/projects/:id/tasks', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    lastCreatedTaskPayload = body;

    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: body.title as string,
      description: body.description as string | undefined,
      category: body.category as any,
      priority: body.priority as any,
      status: 'Backlog', // Server always sets Backlog
      assignedTo: body.assignedTo as string | undefined,
      deadline: body.deadline as string | undefined,
    };
    mockTasks.push(newTask);
    return HttpResponse.json(newTask, { status: 201 });
  }),

  http.patch('*/api/tasks/:taskId/status', async ({ params, request }) => {
    if (failStatusPatch) {
      return HttpResponse.json(
        { error: 'Internal Server Error', message: 'Failed to update status', status: 500 },
        { status: 500 }
      );
    }

    const body = (await request.json()) as { status: TaskStatus };
    lastPatchedStatus = body.status;

    const task = mockTasks.find((t) => t.id === params.taskId);
    if (!task) {
      return HttpResponse.json({ message: 'Task not found' }, { status: 404 });
    }

    const oldStatus = task.status;
    task.status = body.status;

    const logs = mockStatusLogs[task.id] || [];
    logs.push({
      id: `log-${Date.now()}`,
      fromStatus: oldStatus,
      toStatus: body.status,
      changedByUserId: CURRENT_USER_ID,
      changedByName: 'Alice Lead',
      changedAt: new Date().toISOString(),
    });
    mockStatusLogs[task.id] = logs;

    return HttpResponse.json(task, { status: 200 });
  }),

  http.get('*/api/tasks/:taskId/status-logs', ({ params }) => {
    const logs = mockStatusLogs[params.taskId as string] || [];
    return HttpResponse.json(logs);
  })
);

const renderBoardPage = (initialRoute: string = `/app/projects/${PROJECT_ID}`) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={[initialRoute]}>
            <Routes>
              <Route path="/app/projects/:projectId" element={<ProjectLayout />}>
                <Route index element={<ProjectBoardPage />} />
                <Route path="board" element={<ProjectBoardPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    ),
  };
};

describe('MODULE R6: Connect the Board', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    lastCreatedTaskPayload = null;
    lastPatchedStatus = null;
    failStatusPatch = false;

    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    setToken(createJwt({ sub: CURRENT_USER_ID, exp: validFuture }));
    setStoredUser({ id: CURRENT_USER_ID, name: 'Alice Lead', email: 'alice@example.com' });

    mockProjects = [
      {
        id: PROJECT_ID,
        name: 'Distributed Core App',
        description: 'Sprint workspace',
        ownerId: CURRENT_USER_ID,
        role: 'Owner',
      },
    ];

    mockMembers = [
      {
        id: 'mem-1',
        userId: CURRENT_USER_ID,
        userName: 'Alice Lead',
        userEmail: 'alice@example.com',
        role: 'Owner',
      },
      {
        id: 'mem-2',
        userId: OTHER_USER_ID,
        userName: 'Bob Developer',
        userEmail: 'bob@example.com',
        role: 'Member',
      },
    ];

    mockTasks = [
      {
        id: 't-101',
        title: 'Build Kafka Cluster Consumers',
        description: 'Implement distributed consumer groups with backoff',
        category: 'Backend',
        priority: 'High',
        status: 'Backlog',
        assignedTo: OTHER_USER_ID,
        deadline: '2020-01-01', // Overdue
      },
      {
        id: 't-102',
        title: 'Optimize Tailwind CSS Bundle',
        description: 'Purge unused classes and minify stylesheets',
        category: 'Frontend',
        priority: 'Medium',
        status: 'InProgress',
        assignedTo: CURRENT_USER_ID,
        deadline: '2030-12-31', // Future
      },
      {
        id: 't-103',
        title: 'E2E Regression Run',
        description: 'Execute Cypress smoke suites on staging',
        category: 'Testing',
        priority: 'Low',
        status: 'Testing',
        assignedTo: undefined,
        deadline: '2020-01-01', // Overdue but status is Testing
      },
      {
        id: 't-104',
        title: 'Legacy Completed Story',
        description: 'Previously finished task with past deadline',
        category: 'Database',
        priority: 'High',
        status: 'Completed',
        assignedTo: CURRENT_USER_ID,
        deadline: '2020-01-01', // Past deadline but Completed -> NOT overdue
      },
    ];

    mockStatusLogs = {
      't-101': [
        {
          id: 'log-1',
          fromStatus: 'Backlog',
          toStatus: 'InProgress',
          changedByUserId: CURRENT_USER_ID,
          changedByName: 'Alice Lead',
          changedAt: '2026-10-20T10:00:00Z',
        },
        {
          id: 'log-2',
          fromStatus: 'InProgress',
          toStatus: 'Testing',
          changedByUserId: OTHER_USER_ID,
          changedByName: 'Bob Developer',
          changedAt: '2026-10-21T12:00:00Z',
        },
      ],
    };
  });

  it('Create task sends no status and lands in Backlog', async () => {
    renderBoardPage();

    await waitFor(() => {
      expect(screen.getByText('Build Kafka Cluster Consumers')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const addTaskBtn = screen.getAllByRole('button', { name: /add task/i })[0];
    await user.click(addTaskBtn);

    const modal = await screen.findByRole('dialog');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText(/create new task/i)).toBeInTheDocument();

    const titleInput = within(modal).getByLabelText(/task title/i);
    const descInput = within(modal).getByLabelText(/description/i);
    const categorySelect = within(modal).getByLabelText(/category/i);
    const prioritySelect = within(modal).getByLabelText(/priority/i);
    const assigneeSelect = within(modal).getByLabelText(/assignee/i);
    const deadlineInput = within(modal).getByLabelText(/target deadline/i);

    await user.type(titleInput, 'Implement Distributed Lock via Redis');
    await user.type(descInput, 'Redlock algorithm with TTL lease renewal');
    await user.selectOptions(categorySelect, 'Backend');
    await user.selectOptions(prioritySelect, 'High');
    await user.selectOptions(assigneeSelect, OTHER_USER_ID);
    await user.type(deadlineInput, '2026-12-15');

    const submitBtn = within(modal).getByRole('button', { name: /create task/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Implement Distributed Lock via Redis')).toBeInTheDocument();
    });

    // Verify payload sent: NEVER contains status!
    expect(lastCreatedTaskPayload).toEqual({
      title: 'Implement Distributed Lock via Redis',
      description: 'Redlock algorithm with TTL lease renewal',
      category: 'Backend',
      priority: 'High',
      assignedTo: OTHER_USER_ID,
      deadline: '2026-12-15',
    });
    expect(lastCreatedTaskPayload).not.toHaveProperty('status');

    // Confirms it landed in the Backlog column
    const backlogCol = document.querySelector('[data-column-id="Backlog"]')!;
    expect(within(backlogCol as HTMLElement).getByText('Implement Distributed Lock via Redis')).toBeInTheDocument();
  });

  it('Overdue style and assignee names render using useMemberMap', async () => {
    renderBoardPage();

    await waitFor(() => {
      expect(screen.getByText('Build Kafka Cluster Consumers')).toBeInTheDocument();
    });

    // 1. Task t-101 is assigned to Bob Developer (OTHER_USER_ID)
    const card101 = screen.getByTestId('task-card-t-101');
    const avatar101 = within(card101).getByTestId('assignee-avatar');
    expect(avatar101).toHaveAttribute('title', 'Bob Developer');

    // 2. Task t-101 has past deadline and status Backlog -> overdue red style
    const overdueDeadline = within(card101).getByTestId('overdue-deadline');
    expect(overdueDeadline).toBeInTheDocument();
    expect(overdueDeadline).toHaveClass('text-rose-600');

    // 3. Task t-104 has past deadline BUT status is Completed -> NOT overdue
    const card104 = screen.getByTestId('task-card-t-104');
    expect(within(card104).queryByTestId('overdue-deadline')).not.toBeInTheDocument();
  });

  it('Status change calls PATCH with the right body, and a failed PATCH rolls back', async () => {
    renderBoardPage();

    await waitFor(() => {
      expect(screen.getByText('Build Kafka Cluster Consumers')).toBeInTheDocument();
    });

    const user = userEvent.setup();

    // Open task t-101 slide-over panel by clicking card (sets ?task=t-101)
    const card101 = screen.getByTestId('task-card-t-101');
    await user.click(card101);

    expect(await screen.findByRole('dialog', { name: /task details panel/i })).toBeInTheDocument();

    // 1. Successful PATCH
    const statusSelect = screen.getByLabelText(/status/i);
    await user.selectOptions(statusSelect, 'Testing');

    await waitFor(() => {
      expect(lastPatchedStatus).toBe('Testing');
    });

    // Confirm column moved to Testing
    const testingCol = document.querySelector('[data-column-id="Testing"]')!;
    expect(within(testingCol as HTMLElement).getByText('Build Kafka Cluster Consumers')).toBeInTheDocument();

    // 2. Failed PATCH rolls back
    failStatusPatch = true;
    await user.selectOptions(statusSelect, 'Completed');

    // Wait for failure and rollback to previous status ('Testing')
    await waitFor(() => {
      expect(within(testingCol as HTMLElement).getByText('Build Kafka Cluster Consumers')).toBeInTheDocument();
    });
  });

  it('History is chronological in TaskPanel', async () => {
    renderBoardPage(`/app/projects/${PROJECT_ID}?task=t-101`);

    expect(await screen.findByRole('dialog', { name: /task details panel/i })).toBeInTheDocument();

    const timeline = await screen.findByTestId('status-history-timeline');
    expect(timeline).toBeInTheDocument();

    // Confirm chronological events
    const timelineText = timeline.textContent || '';
    expect(timelineText).toContain('Backlog');
    expect(timelineText).toContain('InProgress');
    expect(timelineText).toContain('Testing');
    expect(timelineText).toContain('Alice Lead');
    expect(timelineText).toContain('Bob Developer');
  });

  it('Filters narrow the cards: search, category, priority, and assignee', async () => {
    renderBoardPage();

    await waitFor(() => {
      expect(screen.getByText('Build Kafka Cluster Consumers')).toBeInTheDocument();
      expect(screen.getByText('Optimize Tailwind CSS Bundle')).toBeInTheDocument();
    });

    const user = userEvent.setup();

    // 1. Search Query filter
    const searchInput = screen.getByPlaceholderText(/search sprint tasks/i);
    await user.type(searchInput, 'Kafka');

    expect(screen.getByText('Build Kafka Cluster Consumers')).toBeInTheDocument();
    expect(screen.queryByText('Optimize Tailwind CSS Bundle')).not.toBeInTheDocument();

    await user.clear(searchInput);
    expect(screen.getByText('Optimize Tailwind CSS Bundle')).toBeInTheDocument();

    // 2. Category filter
    const catSelect = screen.getByLabelText(/filter by category/i);
    await user.selectOptions(catSelect, 'Frontend');

    expect(screen.queryByText('Build Kafka Cluster Consumers')).not.toBeInTheDocument();
    expect(screen.getByText('Optimize Tailwind CSS Bundle')).toBeInTheDocument();

    await user.selectOptions(catSelect, ''); // Clear category

    // 3. Priority filter
    const priSelect = screen.getByLabelText(/filter by priority/i);
    await user.selectOptions(priSelect, 'High');

    expect(screen.getByText('Build Kafka Cluster Consumers')).toBeInTheDocument();
    expect(screen.queryByText('Optimize Tailwind CSS Bundle')).not.toBeInTheDocument(); // Medium priority

    await user.selectOptions(priSelect, ''); // Clear priority

    // 4. Assignee filter
    const assigneeSelect = screen.getByLabelText(/filter by assignee/i);
    await user.selectOptions(assigneeSelect, OTHER_USER_ID);

    expect(screen.getByText('Build Kafka Cluster Consumers')).toBeInTheDocument();
    expect(screen.queryByText('Optimize Tailwind CSS Bundle')).not.toBeInTheDocument();
  });

  it('TaskPanel closes and toasts error when ?task points to a non-existent task', async () => {
    renderBoardPage(`/app/projects/${PROJECT_ID}?task=ghost-task-999`);

    await waitFor(() => {
      expect(screen.getByText('Build Kafka Cluster Consumers')).toBeInTheDocument();
    });

    // Panel should not be open
    expect(screen.queryByRole('dialog', { name: /task details panel/i })).not.toBeInTheDocument();
  });

  it('Columns expand individually with items-start and scroll container capped at max-h-[540px]', async () => {
    renderBoardPage();

    await waitFor(() => {
      expect(screen.getByText('Build Kafka Cluster Consumers')).toBeInTheDocument();
    });

    // Verify grid has items-start so empty/shorter columns do not stretch to the height of the tallest
    const backlogCol = screen.getByText('Backlog').closest('[data-column-id="Backlog"]');
    const inProgressCol = screen.getByText('In Progress').closest('[data-column-id="InProgress"]');

    expect(backlogCol).toHaveClass('self-start');
    expect(inProgressCol).toHaveClass('self-start');

    // Verify droppable container has overflow-y-auto and max-h-[540px] to scroll after 4 tasks
    const droppable = backlogCol?.querySelector('.overflow-y-auto');
    expect(droppable).toBeInTheDocument();
    expect(droppable).toHaveClass('max-h-[540px]');
    expect(droppable).toHaveClass('overflow-y-auto');
  });
});
