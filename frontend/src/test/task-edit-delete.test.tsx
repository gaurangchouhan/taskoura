import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AuthProvider } from '../context/AuthContext';
import { ProjectLayout } from '../pages/ProjectLayout';
import { ProjectBoardPage } from '../pages/ProjectBoardPage';
import { TaskPanel } from '../components/tasks/TaskPanel';
import { setToken, setStoredUser } from '../lib/token';
import { Project } from '../types/project';
import { ProjectMember } from '../types/member';
import { Task } from '../types/task';
import { queryKeys } from '../lib/queryKeys';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

const PROJECT_ID = 'proj-edit-del-1';
const OWNER_ID = 'user-owner-1';
const CREATOR_ID = 'user-creator-2';
const REGULAR_MEMBER_ID = 'user-dev-3';

let mockProjects: Project[] = [];
let mockMembers: ProjectMember[] = [];
let mockTasks: Task[] = [];
let lastPutPayload: Record<string, unknown> | null = null;
let lastPutTaskId: string | null = null;
let lastDeletedTaskId: string | null = null;
let putResponseStatus = 200;
let putResponseBody: unknown = null;
let deleteResponseStatus = 204;
let deleteResponseBody: unknown = null;

const server = setupServer(
  http.get('*/api/projects', () => HttpResponse.json(mockProjects)),
  http.get('*/api/projects/:id', ({ params }) => {
    const found = mockProjects.find((p) => p.id === params.id);
    if (!found) return HttpResponse.json({ message: 'Project not found' }, { status: 404 });
    return HttpResponse.json(found);
  }),
  http.get('*/api/projects/:id/members', () => HttpResponse.json(mockMembers)),
  http.get('*/api/projects/:id/tasks', () => HttpResponse.json(mockTasks)),
  http.get('*/api/tasks/:taskId', ({ params }) => {
    const found = mockTasks.find((t) => t.id === params.taskId);
    if (!found) return HttpResponse.json({ message: 'Task not found' }, { status: 404 });
    return HttpResponse.json(found);
  }),
  http.put('*/api/tasks/:taskId', async ({ params, request }) => {
    lastPutTaskId = params.taskId as string;
    lastPutPayload = (await request.json()) as Record<string, unknown>;

    if (putResponseStatus !== 200) {
      return HttpResponse.json(putResponseBody || { message: 'Error' }, { status: putResponseStatus });
    }

    const task = mockTasks.find((t) => t.id === params.taskId);
    const updated: Task = {
      ...(task || ({} as Task)),
      id: params.taskId as string,
      title: (lastPutPayload.title as string) || task?.title || '',
      description: (lastPutPayload.description as string) ?? task?.description,
      category: (lastPutPayload.category as any) || task?.category,
      priority: (lastPutPayload.priority as any) || task?.priority,
      assignedTo: (lastPutPayload.assignedTo as string) ?? task?.assignedTo,
      deadline: (lastPutPayload.deadline as string) ?? task?.deadline,
      status: task?.status || 'Backlog',
      createdAt: task?.createdAt || '2026-10-25T10:00:00Z',
      updatedAt: '2026-10-25T14:30:00Z',
      createdBy: task?.createdBy || { id: CREATOR_ID, name: 'Bob Creator' },
      updatedBy: { id: OWNER_ID, name: 'Alice Owner' },
    };
    mockTasks = mockTasks.map((t) => (t.id === params.taskId ? updated : t));
    return HttpResponse.json(updated, { status: 200 });
  }),
  http.delete('*/api/tasks/:taskId', ({ params }) => {
    lastDeletedTaskId = params.taskId as string;
    if (deleteResponseStatus !== 204) {
      return HttpResponse.json(deleteResponseBody || { message: 'Delete Error' }, { status: deleteResponseStatus });
    }
    mockTasks = mockTasks.filter((t) => t.id !== params.taskId);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('*/api/tasks/:taskId/status-logs', () => HttpResponse.json([]))
);

function renderBoardWithQueryClient(
  initialRoute: string = `/app/projects/${PROJECT_ID}?task=task-1`,
  currentUserId: string = OWNER_ID,
  currentUserRole: 'Owner' | 'Member' = currentUserId === OWNER_ID ? 'Owner' : 'Member'
) {
  mockProjects = mockProjects.map((p) => ({ ...p, role: currentUserRole }));

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const validFuture = Math.floor(Date.now() / 1000) + 3600;
  setToken(createJwt({ sub: currentUserId, exp: validFuture }));
  const userName = currentUserId === OWNER_ID ? 'Alice Owner' : currentUserId === CREATOR_ID ? 'Bob Creator' : 'Dev Charlie';
  setStoredUser({ id: currentUserId, name: userName, email: `${userName.toLowerCase().replace(' ', '')}@example.com` });

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
}

describe('F1-Tasks: Task edit and delete UI', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    lastPutPayload = null;
    lastPutTaskId = null;
    lastDeletedTaskId = null;
    putResponseStatus = 200;
    putResponseBody = null;
    deleteResponseStatus = 204;
    deleteResponseBody = null;
    vi.restoreAllMocks();

    mockProjects = [
      {
        id: PROJECT_ID,
        name: 'Task Management App',
        description: 'Workspace for task management',
        ownerId: OWNER_ID,
        role: 'Owner',
      },
    ];

    mockMembers = [
      {
        id: 'member-1',
        userId: OWNER_ID,
        role: 'Owner',
        userName: 'Alice Owner',
        userEmail: 'alice@example.com',
      },
      {
        id: 'member-2',
        userId: CREATOR_ID,
        role: 'Member',
        userName: 'Bob Creator',
        userEmail: 'bob@example.com',
      },
      {
        id: 'member-3',
        userId: REGULAR_MEMBER_ID,
        role: 'Member',
        userName: 'Dev Charlie',
        userEmail: 'charlie@example.com',
      },
    ];

    mockTasks = [
      {
        id: 'task-1',
        title: 'Initial Task Title',
        description: 'Initial Description',
        category: 'Frontend',
        priority: 'Medium',
        status: 'Backlog',
        assignedTo: CREATOR_ID,
        deadline: '2026-11-01',
        subtaskCount: 3,
        createdAt: '2026-10-25T10:00:00Z',
        updatedAt: null,
        createdBy: { id: CREATOR_ID, name: 'Bob Creator' },
        updatedBy: null,
      },
      {
        id: 'task-no-subtasks',
        title: 'Simple Task Without Subtasks',
        description: '',
        category: 'Backend',
        priority: 'Low',
        status: 'Backlog',
        assignedTo: undefined,
        deadline: undefined,
        subtaskCount: 0,
        createdAt: '2026-10-25T10:00:00Z',
        updatedAt: null,
        createdBy: { id: OWNER_ID, name: 'Alice Owner' },
        updatedBy: null,
      },
      {
        id: 'task-already-edited',
        title: 'Edited Task Title',
        description: 'Previously edited description',
        category: 'Testing',
        priority: 'High',
        status: 'InProgress',
        assignedTo: REGULAR_MEMBER_ID,
        deadline: '2026-11-15',
        subtaskCount: 1,
        createdAt: '2026-10-25T08:00:00Z',
        updatedAt: '2026-10-25T12:00:00Z', // later than createdAt
        createdBy: { id: CREATOR_ID, name: 'Bob Creator' },
        updatedBy: { id: OWNER_ID, name: 'Alice Owner' },
      },
    ];
  });

  it('1. Edit form validates, disables Save while unchanged, and shows character counter', async () => {
    const user = userEvent.setup();
    renderBoardWithQueryClient(`/app/projects/${PROJECT_ID}?task=task-1`, OWNER_ID);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /task details panel/i })).toBeInTheDocument();
      expect(screen.getByTestId('task-panel-title')).toHaveTextContent('Initial Task Title');
    });

    const editBtn = screen.getByTestId('edit-task-button');
    expect(editBtn).toBeInTheDocument();
    await user.click(editBtn);

    // Edit form is rendered
    expect(screen.getByTestId('edit-task-form')).toBeInTheDocument();
    const titleInput = screen.getByTestId('edit-task-title-input');
    const descInput = screen.getByTestId('edit-task-description-input');
    const saveBtn = screen.getByTestId('save-task-button');
    const counter = screen.getByTestId('description-char-counter');

    // Values pre-populated
    expect(titleInput).toHaveValue('Initial Task Title');
    expect(descInput).toHaveValue('Initial Description');
    expect(counter).toHaveTextContent(`${'Initial Description'.length}/255`);

    // Save disabled while unchanged
    expect(saveBtn).toBeDisabled();

    // Clear title -> Save disabled because title is required
    await user.clear(titleInput);
    expect(saveBtn).toBeDisabled();

    // Enter valid changed title -> Save enabled
    await user.type(titleInput, 'New Changed Title');
    expect(saveBtn).not.toBeDisabled();

    // Type description exceeding 255 chars -> Save disabled
    await user.clear(descInput);
    const longDesc = 'A'.repeat(256);
    await user.type(descInput, longDesc);
    expect(counter).toHaveTextContent('256/255');
    expect(saveBtn).toBeDisabled();
  });

  it('2. Edit form sends all six fields, replaces cached task, shows toast, and invalidates queries on 200', async () => {
    const user = userEvent.setup();
    const successSpy = vi.spyOn(toast, 'success');
    const { queryClient } = renderBoardWithQueryClient(`/app/projects/${PROJECT_ID}?task=task-1`, OWNER_ID);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(screen.getByTestId('task-panel-title')).toHaveTextContent('Initial Task Title');
    });

    await user.click(screen.getByTestId('edit-task-button'));

    const titleInput = screen.getByTestId('edit-task-title-input');
    const descInput = screen.getByTestId('edit-task-description-input');
    const categorySelect = screen.getByTestId('edit-task-category-select');
    const prioritySelect = screen.getByTestId('edit-task-priority-select');
    const assigneeSelect = screen.getByTestId('edit-task-assignee-select');
    const deadlineInput = screen.getByTestId('edit-task-deadline-input');

    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Engineering Title');
    await user.clear(descInput);
    await user.type(descInput, 'Updated description text');
    await user.selectOptions(categorySelect, 'Backend');
    await user.selectOptions(prioritySelect, 'High');
    await user.selectOptions(assigneeSelect, OWNER_ID);
    await user.clear(deadlineInput);
    await user.type(deadlineInput, '2026-11-20');

    const saveBtn = screen.getByTestId('save-task-button');
    expect(saveBtn).not.toBeDisabled();
    await user.click(saveBtn);

    // Verify all six fields were sent in PUT body
    await waitFor(() => {
      expect(lastPutPayload).toEqual({
        title: 'Updated Engineering Title',
        description: 'Updated description text',
        category: 'Backend',
        priority: 'High',
        assignedTo: OWNER_ID,
        deadline: '2026-11-20',
      });
      expect(lastPutTaskId).toBe('task-1');
    });

    // Success toast shown only after 200
    await waitFor(() => {
      expect(successSpy).toHaveBeenCalledWith('Task updated successfully');
    });

    // Switched back to details view and cached task replaced
    await waitFor(() => {
      expect(screen.getByTestId('task-panel-title')).toHaveTextContent('Updated Engineering Title');
    });

    // Verify query invalidations: tasks, dashboard, calendar, upcoming/deadlines, activity, report
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.tasks.list(PROJECT_ID) })
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.projects.dashboard(PROJECT_ID) })
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.projects.calendar(PROJECT_ID) })
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.projects.deadlines(PROJECT_ID) })
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.projects.activity(PROJECT_ID) })
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.projects.report(PROJECT_ID) })
    );
  });

  it('3. Edit form maps fieldErrors on 400 VALIDATION_FAILED and does not show success toast', async () => {
    const user = userEvent.setup();
    const successSpy = vi.spyOn(toast, 'success');

    putResponseStatus = 400;
    putResponseBody = {
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      fieldErrors: {
        title: 'Title must be between 1 and 200 characters',
        description: 'Description cannot exceed 255 characters',
        category: 'Category must be one of: Frontend, Backend, Database, Testing, Documentation',
        priority: 'Priority must be one of: High, Medium, Low',
        assignedTo: 'Assignee must be a member of the project',
        deadline: 'Deadline is invalid',
      },
    };

    renderBoardWithQueryClient(`/app/projects/${PROJECT_ID}?task=task-1`, OWNER_ID);

    await waitFor(() => {
      expect(screen.getByTestId('task-panel-title')).toHaveTextContent('Initial Task Title');
    });

    await user.click(screen.getByTestId('edit-task-button'));

    const titleInput = screen.getByTestId('edit-task-title-input');
    await user.type(titleInput, ' trigger change');

    await user.click(screen.getByTestId('save-task-button'));

    // Field errors mapped to right inputs
    await waitFor(() => {
      expect(screen.getByTestId('field-error-title')).toHaveTextContent('Title must be between 1 and 200 characters');
      expect(screen.getByTestId('field-error-description')).toHaveTextContent('Description cannot exceed 255 characters');
      expect(screen.getByTestId('field-error-category')).toHaveTextContent('Category must be one of');
      expect(screen.getByTestId('field-error-priority')).toHaveTextContent('Priority must be one of');
      expect(screen.getByTestId('field-error-assignedTo')).toHaveTextContent('Assignee must be a member of the project');
      expect(screen.getByTestId('field-error-deadline')).toHaveTextContent('Deadline is invalid');
    });

    // No success toast on failure
    expect(successSpy).not.toHaveBeenCalled();
    // Form remains in edit mode
    expect(screen.getByTestId('edit-task-form')).toBeInTheDocument();
  });

  it('4. The "Edited" line appears only after a real edit with tooltip, and not on unedited tasks', async () => {
    // Task 1 has createdAt but updatedAt is null -> "Edited" line should NOT appear
    const { unmount } = renderBoardWithQueryClient(`/app/projects/${PROJECT_ID}?task=task-1`, OWNER_ID);

    await waitFor(() => {
      expect(screen.getByTestId('task-panel-title')).toHaveTextContent('Initial Task Title');
    });

    expect(screen.queryByTestId('task-edited-line')).not.toBeInTheDocument();
    unmount();

    // Task 3 has updatedAt later than createdAt -> "Edited" line MUST appear
    renderBoardWithQueryClient(`/app/projects/${PROJECT_ID}?task=task-already-edited`, OWNER_ID);

    await waitFor(() => {
      expect(screen.getByTestId('task-panel-title')).toHaveTextContent('Edited Task Title');
    });

    const editedLine = screen.getByTestId('task-edited-line');
    expect(editedLine).toBeInTheDocument();
    expect(editedLine).toHaveTextContent(/Edited .* by Alice Owner/);
    expect(editedLine).toHaveAttribute('title');
    expect(editedLine.getAttribute('title')).toBeTruthy();
  });

  it('5. Delete button is visible to project Owner, opens ConfirmDialog, mentions subtasks, and removes queries', async () => {
    const user = userEvent.setup();
    const successSpy = vi.spyOn(toast, 'success');
    const { queryClient } = renderBoardWithQueryClient(`/app/projects/${PROJECT_ID}?task=task-1`, OWNER_ID);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const removeSpy = vi.spyOn(queryClient, 'removeQueries');

    await waitFor(() => {
      expect(screen.getByTestId('task-panel-title')).toHaveTextContent('Initial Task Title');
    });

    // Delete button visible for owner
    const deleteBtn = screen.getByTestId('delete-task-button');
    expect(deleteBtn).toBeInTheDocument();

    await user.click(deleteBtn);

    // Confirm dialog opened and mentions 3 subtasks
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Delete Task' })).toBeInTheDocument();
      expect(screen.getByText(/This also deletes 3 subtasks/)).toBeInTheDocument();
    });

    const confirmBtn = screen.getByTestId('confirm-dialog-confirm-button');
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(lastDeletedTaskId).toBe('task-1');
      expect(successSpy).toHaveBeenCalledWith('Task deleted successfully');
    });

    // Panel is closed (no ?task in dialog)
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /task details panel/i })).not.toBeInTheDocument();
    });

    // Invalidation checks
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.tasks.list(PROJECT_ID) })
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.projects.dashboard(PROJECT_ID) })
    );

    // Per-task cache removal
    expect(removeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.tasks.detail('task-1') })
    );
    expect(removeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.tasks.subtasks('task-1') })
    );
    expect(removeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.tasks.comments('task-1') })
    );
  });

  it('6. Delete button is visible to task creator even if not project Owner', async () => {
    // CREATOR_ID is Bob Creator (Role: Member, NOT Owner)
    renderBoardWithQueryClient(`/app/projects/${PROJECT_ID}?task=task-1`, CREATOR_ID, 'Member');

    await waitFor(() => {
      expect(screen.getByTestId('task-panel-title')).toHaveTextContent('Initial Task Title');
    });

    // Bob created task-1, so Bob CAN delete it
    expect(screen.getByTestId('delete-task-button')).toBeInTheDocument();
  });

  it('7. Delete button is hidden for non-owners who did not create the task', async () => {
    // REGULAR_MEMBER_ID is Dev Charlie (Role: Member, NOT Owner, did NOT create task-1)
    renderBoardWithQueryClient(`/app/projects/${PROJECT_ID}?task=task-1`, REGULAR_MEMBER_ID, 'Member');

    await waitFor(() => {
      expect(screen.getByTestId('task-panel-title')).toHaveTextContent('Initial Task Title');
    });

    // Delete button must NOT be present
    expect(screen.queryByTestId('delete-task-button')).not.toBeInTheDocument();
    // But Edit button is still accessible
    expect(screen.getByTestId('edit-task-button')).toBeInTheDocument();
  });

  it('8. Confirm dialog does not mention subtasks when subtaskCount is 0', async () => {
    const user = userEvent.setup();
    renderBoardWithQueryClient(`/app/projects/${PROJECT_ID}?task=task-no-subtasks`, OWNER_ID);

    await waitFor(() => {
      expect(screen.getByTestId('task-panel-title')).toHaveTextContent('Simple Task Without Subtasks');
    });

    await user.click(screen.getByTestId('delete-task-button'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Delete Task' })).toBeInTheDocument();
    });

    expect(screen.queryByText(/This also deletes.*subtask/)).not.toBeInTheDocument();
  });

  it('9. 403 or 404 on edit displays clear error message and refreshes list', async () => {
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(toast, 'error');

    putResponseStatus = 403;
    putResponseBody = { message: 'Forbidden access to task' };

    const { queryClient } = renderBoardWithQueryClient(`/app/projects/${PROJECT_ID}?task=task-1`, REGULAR_MEMBER_ID);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(screen.getByTestId('task-panel-title')).toHaveTextContent('Initial Task Title');
    });

    await user.click(screen.getByTestId('edit-task-button'));
    const titleInput = screen.getByTestId('edit-task-title-input');
    await user.type(titleInput, ' altered');

    await user.click(screen.getByTestId('save-task-button'));

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith('Forbidden access to task');
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.tasks.list(PROJECT_ID) })
      );
    });
  });

  it('10. 403 or 404 on delete displays clear error message and refreshes list', async () => {
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(toast, 'error');

    deleteResponseStatus = 403;
    deleteResponseBody = { message: 'You are not allowed to delete this task' };

    const { queryClient } = renderBoardWithQueryClient(`/app/projects/${PROJECT_ID}?task=task-1`, OWNER_ID);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(screen.getByTestId('task-panel-title')).toHaveTextContent('Initial Task Title');
    });

    await user.click(screen.getByTestId('delete-task-button'));
    await user.click(screen.getByTestId('confirm-dialog-confirm-button'));

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith('You are not allowed to delete this task');
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.tasks.list(PROJECT_ID) })
      );
    });
  });
});
