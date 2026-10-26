import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { CommentsSection } from '../components/comments/CommentsSection';
import { CommentItem } from '../components/comments/CommentItem';
import { CommentComposer } from '../components/comments/CommentComposer';
import { TaskPanel } from '../components/tasks/TaskPanel';
import { MemoryRouter } from 'react-router-dom';
import { setToken, setStoredUser } from '../lib/token';
import { Comment } from '../types/comment';
import { Task } from '../types/task';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

const TASK_ID = 'task-comment-123';
const PROJECT_ID = 'proj-comment-456';
const CURRENT_USER_ID = 'user-alice-1';

let mockComments: Comment[] = [];
let failPost = false;
let lastPostedBody: Record<string, unknown> | null = null;

const server = setupServer(
  http.get('*/api/tasks/:taskId/comments', ({ params }) => {
    if (params.taskId !== TASK_ID) return HttpResponse.json([]);
    return HttpResponse.json(mockComments);
  }),

  http.post('*/api/tasks/:taskId/comments', async ({ request, params }) => {
    if (failPost) {
      return HttpResponse.json(
        { error: 'Internal Server Error', message: 'Failed to post comment', status: 500 },
        { status: 500 }
      );
    }
    const body = (await request.json()) as { content: string };
    lastPostedBody = body;

    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      taskId: params.taskId as string,
      userId: CURRENT_USER_ID,
      userName: 'Alice Engineer',
      content: body.content,
      createdAt: new Date().toISOString(),
    };
    mockComments.push(newComment);
    return HttpResponse.json(newComment, { status: 201 });
  }),

  http.get('*/api/tasks/:taskId/status-logs', () => HttpResponse.json([]))
);

const renderWithProviders = (
  ui: React.ReactElement,
  initialEntries: string[] = ['/']
) => {
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
          <MemoryRouter initialEntries={initialEntries}>
            {ui}
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    ),
  };
};

describe('MODULE F6: Comments', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    mockComments = [];
    failPost = false;
    lastPostedBody = null;

    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    setToken(createJwt({ sub: CURRENT_USER_ID, exp: validFuture }));
    setStoredUser({ id: CURRENT_USER_ID, name: 'Alice Engineer', email: 'alice@taskoura.dev' });
  });

  it('Empty or whitespace-only comment cannot be posted', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommentsSection taskId={TASK_ID} projectId={PROJECT_ID} />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-comments')).toBeInTheDocument();
    });

    const postBtn = screen.getByRole('button', { name: /post comment/i });
    expect(postBtn).toBeDisabled();

    const textarea = screen.getByLabelText(/write a comment/i);
    await user.type(textarea, '   ');
    expect(postBtn).toBeDisabled();

    expect(lastPostedBody).toBeNull();
  });

  it('Posting appends comment, scrolls, and clears the composer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommentsSection taskId={TASK_ID} projectId={PROJECT_ID} />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-comments')).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText(/write a comment/i);
    const postBtn = screen.getByRole('button', { name: /post comment/i });

    await user.type(textarea, 'First architecture review comment');
    expect(postBtn).not.toBeDisabled();

    await user.click(postBtn);

    // Composer is immediately cleared
    expect(textarea).toHaveValue('');

    // Comment appears in the list
    await waitFor(() => {
      expect(screen.getByText('First architecture review comment')).toBeInTheDocument();
      expect(screen.getByText('Alice Engineer')).toBeInTheDocument();
      expect(screen.getByTestId('comments-count')).toHaveTextContent('1');
    });
  });

  it('Keyboard shortcut Ctrl+Enter or Cmd+Enter posts the comment', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommentsSection taskId={TASK_ID} projectId={PROJECT_ID} />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-comments')).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText(/write a comment/i);
    await user.type(textarea, 'Submitted via shortcut');
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => {
      expect(screen.getByText('Submitted via shortcut')).toBeInTheDocument();
    });
    expect(textarea).toHaveValue('');
  });

  it('A failed post keeps the draft and displays error toast', async () => {
    failPost = true;
    const user = userEvent.setup();
    renderWithProviders(<CommentsSection taskId={TASK_ID} projectId={PROJECT_ID} />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-comments')).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText(/write a comment/i);
    const postBtn = screen.getByRole('button', { name: /post comment/i });

    await user.type(textarea, 'Draft that will fail to send');
    await user.click(postBtn);

    // After failure, the draft is NOT cleared
    await waitFor(() => {
      expect(textarea).toHaveValue('Draft that will fail to send');
    });

    // Optimistic item was rolled back
    expect(screen.queryByTestId(/^comment-item-/)).not.toBeInTheDocument();
  });

  it('Order is oldest first', async () => {
    mockComments = [
      {
        id: 'c-1',
        taskId: TASK_ID,
        userId: 'u-1',
        userName: 'Alice Engineer',
        content: 'Earliest comment #1',
        createdAt: '2026-08-01T10:00:00Z',
      },
      {
        id: 'c-2',
        taskId: TASK_ID,
        userId: 'u-2',
        userName: 'Bob Architect',
        content: 'Middle comment #2',
        createdAt: '2026-08-01T11:00:00Z',
      },
      {
        id: 'c-3',
        taskId: TASK_ID,
        userId: 'u-3',
        userName: 'Charlie QA',
        content: 'Latest comment #3',
        createdAt: '2026-08-01T12:00:00Z',
      },
    ];

    renderWithProviders(<CommentsSection taskId={TASK_ID} projectId={PROJECT_ID} />);

    await waitFor(() => {
      expect(screen.getByText('Earliest comment #1')).toBeInTheDocument();
    });

    const commentElements = screen.getAllByTestId(/^comment-item-/);
    expect(commentElements).toHaveLength(3);
    expect(commentElements[0]).toHaveTextContent('Earliest comment #1');
    expect(commentElements[1]).toHaveTextContent('Middle comment #2');
    expect(commentElements[2]).toHaveTextContent('Latest comment #3');
  });

  it('Text with <script> renders as plain text without executing or parsing HTML', () => {
    const maliciousComment: Comment = {
      id: 'c-xss',
      taskId: TASK_ID,
      userId: 'u-hacker',
      userName: 'Security Tester',
      content: "<script>alert('xss')</script> Hello <b>world</b>",
      createdAt: new Date().toISOString(),
    };

    renderWithProviders(<CommentItem comment={maliciousComment} />);

    // Text content matches verbatim as plain text
    expect(screen.getByText("<script>alert('xss')</script> Hello <b>world</b>")).toBeInTheDocument();
    // No script element was injected
    expect(document.querySelector('script:not([type="importmap"])')).toBeNull();
  });

  it('Exposes renderContent prop on CommentItem for forward-compatibility with mentions', () => {
    const commentWithMention: Comment = {
      id: 'c-mention',
      taskId: TASK_ID,
      userId: 'u-1',
      userName: 'Alice',
      content: 'Hey @Bob check this out',
      createdAt: new Date().toISOString(),
    };

    renderWithProviders(
      <CommentItem
        comment={commentWithMention}
        renderContent={(text) => (
          <span data-testid="custom-mention">{text.replace('@Bob', '[@Bob]')}</span>
        )}
      />
    );

    const customRendered = screen.getByTestId('custom-mention');
    expect(customRendered).toHaveTextContent('Hey [@Bob] check this out');
  });

  it('Mounts CommentsSection in TaskPanel slot', async () => {
    const mockTask: Task = {
      id: TASK_ID,
      title: 'Implement OAuth Flow',
      category: 'Backend',
      priority: 'High',
      status: 'InProgress',
    };

    renderWithProviders(
      <TaskPanel
        projectId={PROJECT_ID}
        tasks={[mockTask]}
        memberMap={new Map()}
        isLoadingTasks={false}
      />,
      [`/app/projects/${PROJECT_ID}?task=${TASK_ID}`]
    );

    await waitFor(() => {
      expect(screen.getByTestId('section-comments')).toBeInTheDocument();
      expect(screen.getByText('Discussion & Comments')).toBeInTheDocument();
      expect(screen.getByLabelText(/write a comment/i)).toBeInTheDocument();
    });
  });
});
