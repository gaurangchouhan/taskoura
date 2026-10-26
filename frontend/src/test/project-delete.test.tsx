import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AuthProvider } from '../context/AuthContext';
import { DashboardPage } from '../pages/DashboardPage';
import { ProjectLayout } from '../pages/ProjectLayout';
import { ProjectBoardPage } from '../pages/ProjectBoardPage';
import { setToken, setStoredUser } from '../lib/token';
import { Project } from '../types/project';
import { queryKeys } from '../lib/queryKeys';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

const OWNER_ID = 'user-owner-1';
const MEMBER_ID = 'user-member-2';
const PROJECT_ID = 'proj-del-1';
const PROJECT_NAME = 'Taskoura Engine Core';

let mockProjects: Project[] = [];
let lastDeletedProjectId: string | null = null;
let deleteResponseStatus = 204;
let deleteResponseBody: unknown = null;
let projectQueryStatus = 200;

const server = setupServer(
  http.get('*/api/projects', () => {
    return HttpResponse.json(mockProjects);
  }),

  http.get('*/api/projects/:id', ({ params }) => {
    if (projectQueryStatus === 404) {
      return HttpResponse.json({ message: 'Project not found' }, { status: 404 });
    }
    const found = mockProjects.find((p) => p.id === params.id);
    if (!found) {
      return HttpResponse.json({ message: 'Project not found' }, { status: 404 });
    }
    return HttpResponse.json(found);
  }),

  http.get('*/api/projects/:id/members', () => {
    return HttpResponse.json([]);
  }),

  http.get('*/api/projects/:id/tasks', () => {
    if (projectQueryStatus === 404) {
      return HttpResponse.json({ message: 'Project not found' }, { status: 404 });
    }
    return HttpResponse.json([]);
  }),

  http.delete('*/api/projects/:id', ({ params }) => {
    lastDeletedProjectId = params.id as string;
    if (deleteResponseStatus !== 204) {
      return HttpResponse.json(
        deleteResponseBody || { message: 'Delete error' },
        { status: deleteResponseStatus }
      );
    }
    mockProjects = mockProjects.filter((p) => p.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  })
);

const LocationWitness: React.FC = () => {
  const location = useLocation();
  return <div data-testid="current-path">{location.pathname}</div>;
};

const renderProjectLayout = (
  initialRoute = `/app/projects/${PROJECT_ID}`,
  currentUserId = OWNER_ID,
  projectRole: 'Owner' | 'Member' = currentUserId === OWNER_ID ? 'Owner' : 'Member'
) => {
  mockProjects = [
    {
      id: PROJECT_ID,
      name: PROJECT_NAME,
      description: 'Core project workspace',
      frontendStack: 'React',
      backendStack: 'Spring Boot',
      databaseStack: 'PostgreSQL',
      testingStack: 'JUnit',
      deadline: '2026-12-31',
      ownerId: OWNER_ID,
      role: projectRole,
    },
  ];

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const validFuture = Math.floor(Date.now() / 1000) + 3600;
  setToken(createJwt({ sub: currentUserId, exp: validFuture }));
  setStoredUser({
    id: currentUserId,
    name: currentUserId === OWNER_ID ? 'Alice Owner' : 'Bob Member',
    email: currentUserId === OWNER_ID ? 'owner@test.com' : 'member@test.com',
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={[initialRoute]}>
            <LocationWitness />
            <Routes>
              <Route path="/app/projects" element={<DashboardPage />} />
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

describe('F1-Projects: Project Delete UI', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    lastDeletedProjectId = null;
    deleteResponseStatus = 204;
    deleteResponseBody = null;
    projectQueryStatus = 200;
    vi.restoreAllMocks();
  });

  it('Owner only: delete button is visible for owner and hidden for non-owner member', async () => {
    // 1. Member view: Delete button should NOT be rendered
    const { unmount } = renderProjectLayout(`/app/projects/${PROJECT_ID}`, MEMBER_ID, 'Member');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: PROJECT_NAME })).toBeInTheDocument();
    });

    expect(screen.queryByTestId('delete-project-button')).toBeNull();
    expect(screen.queryByRole('button', { name: /delete project/i })).toBeNull();

    unmount();

    // 2. Owner view: Delete button SHOULD be rendered
    renderProjectLayout(`/app/projects/${PROJECT_ID}`, OWNER_ID, 'Owner');

    await waitFor(() => {
      expect(screen.getByTestId('delete-project-button')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /delete project/i })).toBeInTheDocument();
  });

  it('Confirmation modal: explains consequences and keeps Delete button disabled until exact name is typed', async () => {
    const user = userEvent.setup();
    renderProjectLayout(`/app/projects/${PROJECT_ID}`, OWNER_ID, 'Owner');

    await waitFor(() => {
      expect(screen.getByTestId('delete-project-button')).toBeInTheDocument();
    });

    // Open modal
    await user.click(screen.getByTestId('delete-project-button'));

    // Modal appears with title and consequences
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Delete project' })).toBeInTheDocument();
    expect(
      screen.getByText(/Tasks, comments, bugs, attachments and activity for this project will be removed from Taskoura/i)
    ).toBeInTheDocument();

    const deleteBtn = screen.getByTestId('confirm-delete-project-button');
    const input = screen.getByTestId('delete-project-input');

    // Initially disabled
    expect(deleteBtn).toBeDisabled();

    // Typing partial name stays disabled
    await user.type(input, 'Taskoura');
    expect(deleteBtn).toBeDisabled();

    // Typing wrong name stays disabled
    await user.clear(input);
    await user.type(input, 'Wrong Project Name');
    expect(deleteBtn).toBeDisabled();

    // Typing exact name enables delete button
    await user.clear(input);
    await user.type(input, PROJECT_NAME);
    expect(deleteBtn).toBeEnabled();

    // Cancel closes the modal
    await user.click(screen.getByTestId('cancel-delete-project-button'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('Successful delete: 204 calls DELETE /api/projects/:id, shows toast, navigates to /app/projects, and clears caches', async () => {
    const user = userEvent.setup();
    const successSpy = vi.spyOn(toast, 'success');
    const { queryClient } = renderProjectLayout(`/app/projects/${PROJECT_ID}`, OWNER_ID, 'Owner');

    // Pre-populate some project-specific queries in cache
    queryClient.setQueryData(['projects', PROJECT_ID], { id: PROJECT_ID, name: PROJECT_NAME });
    queryClient.setQueryData(['tasks', 'list', PROJECT_ID], [{ id: 'task-1', title: 'Task 1' }]);

    const removeQueriesSpy = vi.spyOn(queryClient, 'removeQueries');
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(screen.getByTestId('delete-project-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('delete-project-button'));

    const input = screen.getByTestId('delete-project-input');
    await user.type(input, PROJECT_NAME);

    const deleteBtn = screen.getByTestId('confirm-delete-project-button');
    expect(deleteBtn).toBeEnabled();
    await user.click(deleteBtn);

    // Verify backend called with 204
    await waitFor(() => {
      expect(lastDeletedProjectId).toBe(PROJECT_ID);
    });

    // Toast shown
    expect(successSpy).toHaveBeenCalledWith('Project deleted successfully');

    // Navigated to /app/projects
    await waitFor(() => {
      expect(screen.getByTestId('current-path')).toHaveTextContent('/app/projects');
    });

    // Caches are cleared
    expect(removeQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['projects', PROJECT_ID] })
    );
    expect(removeQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['tasks', 'list', PROJECT_ID] })
    );
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.projects.all })
    );

    // Project is removed from list cache
    const projectListCache = queryClient.getQueryData<Project[]>(queryKeys.projects.list());
    expect(projectListCache?.find((p) => p.id === PROJECT_ID)).toBeUndefined();
  });

  it('403 handling: non-owner gets 403 error toast "Only the project owner can delete this project"', async () => {
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(toast, 'error');
    deleteResponseStatus = 403;
    deleteResponseBody = { message: 'Only the project owner can delete this project' };

    renderProjectLayout(`/app/projects/${PROJECT_ID}`, OWNER_ID, 'Owner');

    await waitFor(() => {
      expect(screen.getByTestId('delete-project-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('delete-project-button'));
    await user.type(screen.getByTestId('delete-project-input'), PROJECT_NAME);
    await user.click(screen.getByTestId('confirm-delete-project-button'));

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith('Only the project owner can delete this project');
    });
  });

  it('404 handling: already deleted project shows error toast and navigates away to /app/projects', async () => {
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(toast, 'error');
    deleteResponseStatus = 404;
    deleteResponseBody = { message: 'Project not found' };

    const { queryClient } = renderProjectLayout(`/app/projects/${PROJECT_ID}`, OWNER_ID, 'Owner');
    const removeQueriesSpy = vi.spyOn(queryClient, 'removeQueries');

    await waitFor(() => {
      expect(screen.getByTestId('delete-project-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('delete-project-button'));
    await user.type(screen.getByTestId('delete-project-input'), PROJECT_NAME);
    await user.click(screen.getByTestId('confirm-delete-project-button'));

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/already deleted/i));
    });

    // Navigates away
    await waitFor(() => {
      expect(screen.getByTestId('current-path')).toHaveTextContent('/app/projects');
    });

    // Caches are cleaned up
    expect(removeQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['projects', PROJECT_ID] })
    );
  });

  it('Viewing a deleted project (404 on project query): displays the "Project not found" state with back link instead of blank page', async () => {
    projectQueryStatus = 404;
    mockProjects = []; // Server no longer returns the project

    renderProjectLayout(`/app/projects/${PROJECT_ID}`, OWNER_ID, 'Owner');

    await waitFor(() => {
      expect(screen.getByTestId('project-not-found')).toBeInTheDocument();
    });

    expect(screen.getByText('Project not found')).toBeInTheDocument();
    expect(screen.getByText(/The project you requested either does not exist, has been removed/i)).toBeInTheDocument();

    const backLink = screen.getByRole('link', { name: /back to projects/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/app/projects');
  });
});
