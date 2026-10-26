import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse, delay } from 'msw';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { DashboardPage } from '../pages/DashboardPage';
import { ProjectLayout } from '../pages/ProjectLayout';
import { ProjectBoardPage } from '../pages/ProjectBoardPage';
import { projectTabs } from '../components/projects/projectTabs';
import { setToken, setStoredUser, clearToken } from '../lib/token';
import { Project, CreateProjectRequest } from '../types/project';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

let mockProjects: Project[] = [];
let lastCreatedProjectPayload: CreateProjectRequest | null = null;
let delayCreateMs = 0;

const server = setupServer(
  http.get('*/api/projects', () => {
    return HttpResponse.json(mockProjects);
  }),

  http.post('*/api/projects', async ({ request }) => {
    const body = (await request.json()) as CreateProjectRequest;
    lastCreatedProjectPayload = body;
    if (delayCreateMs > 0) {
      await delay(delayCreateMs);
    }
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: body.name,
      description: body.description,
      frontendStack: body.frontendStack,
      backendStack: body.backendStack,
      databaseStack: body.databaseStack,
      testingStack: body.testingStack,
      deadline: body.deadline,
      ownerId: 'user-owner-1',
      role: 'Owner',
    };
    mockProjects.push(newProject);
    return HttpResponse.json(newProject, { status: 201 });
  }),

  http.get('*/api/projects/:id', ({ params }) => {
    const found = mockProjects.find((p) => p.id === params.id);
    if (!found) {
      return HttpResponse.json({ message: 'Project not found' }, { status: 404 });
    }
    return HttpResponse.json(found);
  })
);

const LocationWitness: React.FC = () => {
  const location = useLocation();
  return <div data-testid="current-path">{location.pathname}</div>;
};

const renderWithProviders = (initialRoute: string) => {
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

describe('MODULE R4: DashboardPage & ProjectLayout', () => {
  const currentUserId = 'user-owner-1';

  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    lastCreatedProjectPayload = null;
    delayCreateMs = 0;

    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    const token = createJwt({ sub: currentUserId, exp: validFuture });
    setToken(token);
    setStoredUser({ id: currentUserId, name: 'Alice Owner', email: 'alice@example.com' });

    mockProjects = [
      {
        id: 'proj-owned',
        name: 'Alpha Distributed Engine',
        description: 'Owned project description',
        frontendStack: 'React',
        backendStack: 'Spring Boot',
        databaseStack: 'PostgreSQL',
        testingStack: 'JUnit 5',
        deadline: '2026-12-31',
        ownerId: currentUserId,
        role: 'Owner',
      },
      {
        id: 'proj-invited',
        name: 'Beta Guest Workspace',
        description: 'Invited project description',
        frontendStack: 'Vue',
        backendStack: 'Node.js',
        databaseStack: 'MongoDB',
        testingStack: 'Jest',
        deadline: '2026-11-20',
        ownerId: 'user-other-2',
        role: 'Member',
      },
    ];
  });

  it('Owner badge only for the owner: shows Owner badge for owned projects and Member badge for invited projects', async () => {
    renderWithProviders('/app/projects');

    await waitFor(() => {
      expect(screen.getByText('Alpha Distributed Engine')).toBeInTheDocument();
      expect(screen.getByText('Beta Guest Workspace')).toBeInTheDocument();
    });

    const ownerBadges = screen.getAllByTestId('owner-badge');
    expect(ownerBadges).toHaveLength(1);
    expect(ownerBadges[0]).toHaveTextContent('Owner');

    const memberBadges = screen.getAllByTestId('member-badge');
    expect(memberBadges).toHaveLength(1);
    expect(memberBadges[0]).toHaveTextContent('Member');
  });

  it('falls back to ownerId === user.id when role is absent', async () => {
    mockProjects = [
      {
        id: 'proj-no-role-owned',
        name: 'Project With No Role Owned',
        description: 'No role provided, but ownerId matches',
        ownerId: currentUserId,
      },
      {
        id: 'proj-no-role-other',
        name: 'Project With No Role Other',
        description: 'No role provided, ownerId is someone else',
        ownerId: 'different-user',
      },
    ];

    renderWithProviders('/app/projects');

    await waitFor(() => {
      expect(screen.getByText('Project With No Role Owned')).toBeInTheDocument();
      expect(screen.getByText('Project With No Role Other')).toBeInTheDocument();
    });

    // Should have 1 Owner badge (for proj-no-role-owned) and 1 Member badge (for proj-no-role-other)
    const ownerBadges = screen.getAllByTestId('owner-badge');
    expect(ownerBadges).toHaveLength(1);

    const memberBadges = screen.getAllByTestId('member-badge');
    expect(memberBadges).toHaveLength(1);
    expect(memberBadges[0]).toHaveTextContent('Member');
  });

  it('Create modal validation: validates required name and shows warning for past deadline', async () => {
    renderWithProviders('/app/projects');

    await waitFor(() => {
      expect(screen.getByText('Alpha Distributed Engine')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const newProjectBtn = screen.getByRole('button', { name: /new project/i });
    await user.click(newProjectBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/project title/i)).toBeRequired();

    // Check past deadline warning
    const deadlineInput = screen.getByLabelText(/milestone deadline/i);
    await user.type(deadlineInput, '2020-01-01');

    expect(await screen.findByTestId('deadline-warning')).toHaveTextContent(/deadline.*in the past/i);

    // Change to future deadline
    await user.clear(deadlineInput);
    await user.type(deadlineInput, '2030-12-31');

    expect(screen.queryByTestId('deadline-warning')).not.toBeInTheDocument();
  });

  it('Create modal pending state: disables submit button while request is in flight', async () => {
    delayCreateMs = 250;
    renderWithProviders('/app/projects');

    await waitFor(() => {
      expect(screen.getByText('Alpha Distributed Engine')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /new project/i }));

    const titleInput = screen.getByLabelText(/project title/i);
    await user.type(titleInput, 'Pending Test Project');

    const submitBtn = screen.getByRole('button', { name: /initialize project/i });
    await user.click(submitBtn);

    // Button should be disabled and show loading text while pending
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent(/creating/i);

    // Settle request
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('A new project appears after creation and navigates to the new project layout', async () => {
    renderWithProviders('/app/projects');

    await waitFor(() => {
      expect(screen.getByText('Alpha Distributed Engine')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /new project/i }));

    await user.type(screen.getByLabelText(/project title/i), 'Gamma Autonomous Ops');
    await user.type(screen.getByLabelText(/description/i), 'Full stack automation suite');
    await user.type(screen.getByLabelText(/frontend stack/i), 'React 18');
    await user.type(screen.getByLabelText(/backend stack/i), 'Spring Boot 3.4');
    await user.type(screen.getByLabelText(/database stack/i), 'PostgreSQL 16');
    await user.type(screen.getByLabelText(/testing stack/i), 'Vitest + Cypress');
    await user.type(screen.getByLabelText(/milestone deadline/i), '2026-12-25');

    const submitBtn = screen.getByRole('button', { name: /initialize project/i });
    await user.click(submitBtn);

    // Upon creation: navigates to /app/projects/:id
    await waitFor(() => {
      const currentPath = screen.getByTestId('current-path').textContent;
      expect(currentPath).toMatch(/^\/app\/projects\/proj-/);
    });

    // Verify payload sent to backend
    expect(lastCreatedProjectPayload).toEqual({
      name: 'Gamma Autonomous Ops',
      description: 'Full stack automation suite',
      frontendStack: 'React 18',
      backendStack: 'Spring Boot 3.4',
      databaseStack: 'PostgreSQL 16',
      testingStack: 'Vitest + Cypress',
      deadline: '2026-12-25',
    });
  });

  it('Dashboard empty state shows "Create your first project" when no projects exist', async () => {
    mockProjects = [];
    renderWithProviders('/app/projects');

    expect(await screen.findByTestId('empty-projects')).toBeInTheDocument();
    expect(screen.getAllByText(/create your first project/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /create your first project/i })).toBeInTheDocument();
  });

  it('ProjectLayout: unknown project id shows the not-found state with link back', async () => {
    renderWithProviders('/app/projects/non-existent-id-999');

    const notFoundEl = await screen.findByTestId('project-not-found');
    expect(notFoundEl).toBeInTheDocument();
    expect(screen.getByText(/project not found/i)).toBeInTheDocument();

    const backLink = screen.getByRole('link', { name: /back to projects/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/app/projects');
  });

  it('ProjectLayout: valid project renders breadcrumbs, tabs from projectTabs, and default child board', async () => {
    renderWithProviders('/app/projects/proj-owned');

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Alpha Distributed Engine' })).toBeInTheDocument();
    });

    // Check breadcrumb
    const breadcrumb = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(breadcrumb).toHaveTextContent('Projects');
    expect(breadcrumb).toHaveTextContent('Alpha Distributed Engine');

    // Check tabs
    expect(projectTabs).toBeDefined();
    expect(projectTabs[0].key).toBe('board');
    expect(projectTabs[0].label).toBe('Board');
    expect(screen.getByRole('link', { name: 'Board' })).toBeInTheDocument();

    // Check Board child is rendered by default
    expect(screen.getByText(/sprint kanban board/i)).toBeInTheDocument();
  });
});
