import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse, delay } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { setToken, setStoredUser } from '../lib/token';
import { Project } from '../types/project';
import { Task } from '../types/task';
import { ProjectMember } from '../types/member';
import { TemplateSummary } from '../types/template';
import { getTemplates, applyTemplate } from '../features/templates/api';
import { TemplateCard } from '../features/templates/components/TemplateCard';
import { TemplateGallery } from '../features/templates/components/TemplateGallery';
import { ApplyTemplateDialog } from '../features/templates/components/ApplyTemplateDialog';
import { ProjectBoardPage } from '../pages/ProjectBoardPage';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

const PROJECT_ID = 'proj-template-test-1';
const CURRENT_USER_ID = 'user-owner-1';

const mockTemplates: TemplateSummary[] = [
  {
    key: 'e-commerce-website',
    name: 'E-Commerce Website',
    description: 'Modern storefront with shopping cart, payments, and order tracking.',
    moduleCount: 4,
    taskCount: 14,
  },
  {
    key: 'hospital-management',
    name: 'Hospital Management System',
    description: 'Clinical workflows, doctor scheduling, and electronic medical records.',
    moduleCount: 4,
    taskCount: 12,
  },
  {
    key: 'library-management',
    name: 'Library Management System',
    description: 'Digital cataloging, member checkout, and fine tracking.',
    moduleCount: 4,
    taskCount: 13,
  },
];

let mockProjects: Project[] = [];
let mockTasks: Task[] = [];
let mockMembers: ProjectMember[] = [];
let applyRequestsCount = 0;
let applyDelayMs = 0;
let failApplyWith404 = false;

const server = setupServer(
  http.get('*/api/templates', () => {
    return HttpResponse.json({ templates: mockTemplates });
  }),

  http.post('*/api/projects/:projectId/templates/:key/apply', async ({ params }) => {
    applyRequestsCount++;
    if (applyDelayMs > 0) {
      await delay(applyDelayMs);
    }

    if (failApplyWith404 || params.key === 'unknown-template') {
      return HttpResponse.json(
        { message: 'Template not found: ' + params.key },
        { status: 404 }
      );
    }

    const tpl = mockTemplates.find((t) => t.key === params.key);
    const count = tpl ? tpl.taskCount : 14;

    const newTasks: Task[] = [];
    const taskIds: string[] = [];
    for (let i = 1; i <= count; i++) {
      const taskId = `task-gen-${i}-${Date.now()}`;
      taskIds.push(taskId);
      newTasks.push({
        id: taskId,
        title: `${tpl?.name || 'Template'} Task ${i}`,
        description: `Automated generated task #${i}`,
        category: 'Backend',
        priority: 'Medium',
        status: 'Backlog',
      });
    }

    mockTasks.push(...newTasks);
    return HttpResponse.json({
      createdCount: count,
      taskIds,
    });
  }),

  http.get('*/api/projects', () => {
    return HttpResponse.json(mockProjects);
  }),

  http.get('*/api/projects/:id', ({ params }) => {
    const found = mockProjects.find((p) => p.id === params.id);
    if (!found) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    return HttpResponse.json(found);
  }),

  http.get('*/api/projects/:id/tasks', () => {
    return HttpResponse.json(mockTasks);
  }),

  http.get('*/api/projects/:id/members', () => {
    return HttpResponse.json(mockMembers);
  }),

  http.get('*/api/projects/:id/ai/next-task', () => {
    return HttpResponse.json(null);
  }),

  http.get('*/api/notifications*', () => {
    return HttpResponse.json([]);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());

beforeEach(() => {
  server.resetHandlers();
  applyRequestsCount = 0;
  applyDelayMs = 0;
  failApplyWith404 = false;

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
      name: 'E-Commerce Website',
      description: 'Online store project',
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
  ];

  mockTasks = [];
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

function renderBoardPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[`/projects/${PROJECT_ID}/board`]}>
          <Routes>
            <Route path="/projects/:projectId/board" element={<ProjectBoardPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('MODULE F13: Project Templates', () => {
  describe('API Contracts & Helpers', () => {
    it('getTemplates fetches from GET /api/templates', async () => {
      const data = await getTemplates();
      expect(data.templates).toHaveLength(3);
      expect(data.templates[0].key).toBe('e-commerce-website');
      expect(data.templates[0].moduleCount).toBe(4);
      expect(data.templates[0].taskCount).toBe(14);
    });

    it('applyTemplate posts to /api/projects/:projectId/templates/:key/apply', async () => {
      const result = await applyTemplate(PROJECT_ID, 'e-commerce-website');
      expect(result.createdCount).toBe(14);
      expect(result.taskIds).toHaveLength(14);
    });
  });

  describe('TemplateCard & TemplateGallery', () => {
    it('TemplateCard renders name, description, and "N modules, M tasks" counts', () => {
      const onApply = vi.fn();
      render(
        <TemplateCard
          template={mockTemplates[0]}
          onApply={onApply}
        />
      );

      expect(screen.getByText('E-Commerce Website')).toBeInTheDocument();
      expect(screen.getByText(/Modern storefront/i)).toBeInTheDocument();
      expect(screen.getByText('4 modules, 14 tasks')).toBeInTheDocument();

      const btn = screen.getByRole('button', { name: /use template/i });
      btn.click();
      expect(onApply).toHaveBeenCalledWith(mockTemplates[0]);
    });

    it('Gallery renders counts for all templates', async () => {
      renderWithClient(
        <TemplateGallery
          isOpen={true}
          onClose={() => {}}
          projectId={PROJECT_ID}
          projectName="E-Commerce Website"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('E-Commerce Website')).toBeInTheDocument();
      });

      // Verify counts are displayed
      expect(screen.getByText('4 modules, 14 tasks')).toBeInTheDocument();
      expect(screen.getByText('4 modules, 12 tasks')).toBeInTheDocument();
      expect(screen.getByText('4 modules, 13 tasks')).toBeInTheDocument();
    });
  });

  describe('ApplyTemplateDialog: Confirmation, Pending State, and 404 Handling', () => {
    it('dialog states "This adds M tasks to <project name>"', () => {
      renderWithClient(
        <ApplyTemplateDialog
          isOpen={true}
          onClose={() => {}}
          template={mockTemplates[0]}
          projectId={PROJECT_ID}
          projectName="E-Commerce Website"
        />
      );

      expect(
        screen.getByText('This adds 14 tasks to E-Commerce Website')
      ).toBeInTheDocument();
    });

    it('the apply button is disabled while pending and sends only one request', async () => {
      applyDelayMs = 150; // Hold the mutation in pending state
      const user = userEvent.setup();

      renderWithClient(
        <ApplyTemplateDialog
          isOpen={true}
          onClose={() => {}}
          template={mockTemplates[0]}
          projectId={PROJECT_ID}
          projectName="E-Commerce Website"
        />
      );

      const applyBtn = screen.getByRole('button', { name: /apply template/i });
      expect(applyBtn).not.toBeDisabled();

      // Click once
      await user.click(applyBtn);

      // Immediately verify button is disabled
      expect(applyBtn).toBeDisabled();
      expect(screen.getByText(/applying/i)).toBeInTheDocument();

      // Attempt multiple clicks while disabled
      await user.click(applyBtn);
      await user.click(applyBtn);

      // Wait for completion
      await waitFor(() => {
        expect(applyRequestsCount).toBe(1);
      });
    });

    it('404 handling: shows "This template is no longer available"', async () => {
      failApplyWith404 = true;
      const user = userEvent.setup();

      renderWithClient(
        <ApplyTemplateDialog
          isOpen={true}
          onClose={() => {}}
          template={mockTemplates[0]}
          projectId={PROJECT_ID}
          projectName="E-Commerce Website"
        />
      );

      const applyBtn = screen.getByRole('button', { name: /apply template/i });
      await user.click(applyBtn);

      await waitFor(() => {
        expect(
          screen.getByText('This template is no longer available')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Board Integration & Manual Flow', () => {
    it('toolbar contains "Templates" button and empty board renders "Start from a template" CTA', async () => {
      renderBoardPage();

      await waitFor(() => {
        expect(screen.getByTestId('empty-board-state')).toBeInTheDocument();
      }, { timeout: 5000 });

      // 1. Toolbar Templates button
      const toolbarTemplatesBtn = screen.getByTestId('board-templates-btn');
      expect(toolbarTemplatesBtn).toBeInTheDocument();
      expect(toolbarTemplatesBtn).toHaveTextContent(/templates/i);

      // 2. Empty board CTA
      expect(screen.getByText('Sprint board is empty')).toBeInTheDocument();
      const startFromTemplateBtn = screen.getByRole('button', {
        name: /start from a template/i,
      });
      expect(startFromTemplateBtn).toBeInTheDocument();
    });

    it(
      'MANUAL: Applying "E-Commerce Website" fills the board with exactly the advertised number of tasks (14 tasks)',
      async () => {
        const user = userEvent.setup();
        renderBoardPage();

      await waitFor(() => {
        expect(screen.getByTestId('empty-board-state')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Click "Start from a template" on empty board
      const startCta = screen.getByRole('button', { name: /start from a template/i });
      fireEvent.click(startCta);

      // Gallery opens
      const gallery = await screen.findByTestId('template-gallery');
      expect(gallery).toBeInTheDocument();
      expect(screen.getByText('4 modules, 14 tasks')).toBeInTheDocument();

      // Click "Use Template" on E-Commerce Website
      const useBtn = screen.getByTestId('apply-template-btn-e-commerce-website');
      fireEvent.click(useBtn);

      // Confirm dialog opens
      const dialog = await screen.findByTestId('apply-template-dialog');
      expect(dialog).toBeInTheDocument();
      expect(
        within(dialog).getByText('This adds 14 tasks to E-Commerce Website')
      ).toBeInTheDocument();

      // Click Apply Template
      const confirmBtn = screen.getByTestId('confirm-apply-template-btn');
      fireEvent.click(confirmBtn);

      // Board refreshes and fills with exactly 14 tasks!
      await waitFor(() => {
        expect(screen.getByText('E-Commerce Website Task 1')).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(screen.getByText('(14 tasks)')).toBeInTheDocument();
      expect(screen.getByText('E-Commerce Website Task 14')).toBeInTheDocument();

      // Empty state should be gone now that tasks exist
      expect(screen.queryByTestId('empty-board-state')).toBeNull();
    }, 20000);
  });
});
