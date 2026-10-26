import React from 'react';
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import {
  findActiveMention,
  tokenFor,
  parseMentions,
  renderMentionContent,
} from '../features/comments/mentions';
import { MentionPopover } from '../features/comments/components/MentionPopover';
import { CommentComposer } from '../components/comments/CommentComposer';
import { CommentItem } from '../components/comments/CommentItem';
import { CommentsSection } from '../components/comments/CommentsSection';
import { ProjectMember } from '../types/member';
import { Comment } from '../types/comment';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const mockMembers: ProjectMember[] = [
  {
    id: 'pm-1',
    userId: 'u-alice',
    userName: 'Alice Developer',
    userEmail: 'alice@company.com',
    role: 'Admin',
  },
  {
    id: 'pm-2',
    userId: 'u-bob',
    userName: 'Bob',
    userEmail: 'bob@company.com',
    role: 'Member',
  },
  {
    id: 'pm-3',
    userId: 'u-charlie',
    userName: 'Charlie Architect',
    userEmail: 'charlie@company.com',
    role: 'Member',
  },
];

const memberMap = new Map<string, ProjectMember>();
mockMembers.forEach((m) => memberMap.set(m.userId, m));

import { AuthProvider } from '../context/AuthContext';
import { setToken } from '../lib/token';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
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
};

describe('MODULE F15: Mentions', () => {
  describe('Unit: findActiveMention at different caret positions', () => {
    it('returns null when text is empty or caret is 0', () => {
      expect(findActiveMention('', 0)).toBeNull();
      expect(findActiveMention('Hello', 0)).toBeNull();
      expect(findActiveMention('@', 0)).toBeNull();
    });

    it('detects @ at start of text', () => {
      const active = findActiveMention('@', 1);
      expect(active).toEqual({ query: '', start: 0, end: 1 });
    });

    it('detects @ preceded by whitespace', () => {
      const active = findActiveMention('Hello @', 7);
      expect(active).toEqual({ query: '', start: 6, end: 7 });
    });

    it('detects partial query without spaces', () => {
      const active = findActiveMention('Hello @ali', 10);
      expect(active).toEqual({ query: 'ali', start: 6, end: 10 });
    });

    it('detects query with spaces for full names (e.g. "@Alice D")', () => {
      const active = findActiveMention('Hello @Alice D', 14);
      expect(active).toEqual({ query: 'Alice D', start: 6, end: 14 });
    });

    it('returns null when @ is preceded by a non-whitespace character (e.g. email address)', () => {
      expect(findActiveMention('user@example.com', 5)).toBeNull();
      expect(findActiveMention('user@example.com', 16)).toBeNull();
    });

    it('returns null when query spans multiple spaces (normal sentence continued)', () => {
      expect(findActiveMention('Hello @Alice Dev is here', 24)).toBeNull();
    });

    it('returns null when query spans across a newline', () => {
      expect(findActiveMention('Hello @\nAlice', 8)).toBeNull();
    });

    it('correctly tracks caret position when user moves cursor back inside query', () => {
      // Caret is right after "@Al" while text continues "ice is working"
      const text = 'Hello @Alice is working';
      const active = findActiveMention(text, 9);
      expect(active).toEqual({ query: 'Al', start: 6, end: 9 });
    });
  });

  describe('Unit: tokenFor and parseMentions', () => {
    it('generates token for member without spaces in name', () => {
      expect(tokenFor({ userName: 'Bob' })).toBe('@Bob');
    });

    it('generates token for member with spaces in name', () => {
      expect(tokenFor({ userName: 'Alice Developer' })).toBe('@Alice Developer');
    });

    it('falls back to email when name is not available', () => {
      expect(tokenFor({ userEmail: 'ghost@company.com' })).toBe('@ghost@company.com');
    });

    it('parses mentions from comment text including names with spaces', () => {
      const tokens = parseMentions('Hey @Alice Developer and @Bob, please check this out.');
      expect(tokens).toContain('@Alice Developer');
      expect(tokens).toContain('@Bob');
    });
  });

  describe('Unit: Mention Highlighting using mentionedUserIds & Regex Fallback', () => {
    it('highlights mentioned member tokens when user is in mentionedUserIds', () => {
      render(
        <div>
          {renderMentionContent('Hey @Alice Developer can you take a look?', {
            mentionedUserIds: ['u-alice'],
            memberMap,
          })}
        </div>
      );

      const highlights = screen.getAllByTestId('mention-highlight');
      expect(highlights).toHaveLength(1);
      expect(highlights[0]).toHaveTextContent('@Alice Developer');
    });

    it('does NOT highlight non-member mentions when mentionedUserIds does not contain them', () => {
      render(
        <div>
          {renderMentionContent('Hey @GhostUser what do you think?', {
            mentionedUserIds: [],
            memberMap,
          })}
        </div>
      );

      expect(screen.queryByTestId('mention-highlight')).not.toBeInTheDocument();
      expect(screen.getByText('Hey @GhostUser what do you think?')).toBeInTheDocument();
    });

    it('highlights only the real member when both real member and non-member are tagged', () => {
      render(
        <div>
          {renderMentionContent('Hey @Alice Developer and @GhostUser please review', {
            mentionedUserIds: ['u-alice'],
            memberMap,
          })}
        </div>
      );

      const highlights = screen.getAllByTestId('mention-highlight');
      expect(highlights).toHaveLength(1);
      expect(highlights[0]).toHaveTextContent('@Alice Developer');
      expect(screen.getByText(/@GhostUser/)).toBeInTheDocument();
    });

    it('uses regex fallback when mentionedUserIds is undefined', () => {
      render(
        <div>
          {renderMentionContent('Hey @Bob check this fallback', {
            memberMap,
          })}
        </div>
      );

      const highlights = screen.getAllByTestId('mention-highlight');
      expect(highlights).toHaveLength(1);
      expect(highlights[0]).toHaveTextContent('@Bob');
    });

    it('renders through CommentItem component with mention highlights', () => {
      const comment: Comment = {
        id: 'c-test-1',
        taskId: 't-1',
        userId: 'u-author',
        userName: 'Author',
        content: 'Review needed by @Alice Developer',
        createdAt: '2026-08-01T10:00:00Z',
        mentionedUserIds: ['u-alice'],
      };

      render(<CommentItem comment={comment} memberMap={memberMap} />);

      const highlight = screen.getByTestId('mention-highlight');
      expect(highlight).toHaveTextContent('@Alice Developer');
    });
  });

  describe('Component: MentionPopover & Keyboard Navigation', () => {
    it('renders filtered members with initial avatar and selection', () => {
      const onSelect = vi.fn();
      render(
        <MentionPopover
          isOpen={true}
          members={mockMembers}
          query="ali"
          activeIndex={0}
          onSelect={onSelect}
        />
      );

      expect(screen.getByTestId('mention-popover')).toBeInTheDocument();
      expect(screen.getByText('Alice Developer')).toBeInTheDocument();
      expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    });

    it('calls onSelect when an option is clicked', () => {
      const onSelect = vi.fn();
      render(
        <MentionPopover
          isOpen={true}
          members={mockMembers}
          query=""
          activeIndex={0}
          onSelect={onSelect}
        />
      );

      const aliceOption = screen.getByTestId('mention-option-u-alice');
      fireEvent.mouseDown(aliceOption);

      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ userName: 'Alice Developer' })
      );
    });

    it('shows no matching members message when filter yields 0 results', () => {
      render(
        <MentionPopover
          isOpen={true}
          members={mockMembers}
          query="nonexistent"
          activeIndex={0}
          onSelect={vi.fn()}
        />
      );

      expect(screen.getByTestId('mention-no-results')).toBeInTheDocument();
    });
  });

  describe('CommentComposer: Typing @, popover navigation, insertion, and Ctrl+Enter submit', () => {
    it('opens popover when @ is typed and inserts token with space on Enter', async () => {
      const onSubmit = vi.fn();
      render(<CommentComposer onSubmit={onSubmit} members={mockMembers} />);

      const textarea = screen.getByLabelText(/write a comment/i);

      // Type "@Ali"
      fireEvent.change(textarea, { target: { value: '@Ali', selectionStart: 4 } });

      await waitFor(() => {
        expect(screen.getByTestId('mention-popover')).toBeInTheDocument();
        expect(screen.getByText('Alice Developer')).toBeInTheDocument();
      });

      // Press Enter to select active item
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      // Alice Developer token inserted with trailing space
      expect(textarea).toHaveValue('@Alice Developer ');
      expect(screen.queryByTestId('mention-popover')).not.toBeInTheDocument();
    });

    it('allows navigating members with ArrowDown and ArrowUp', async () => {
      const onSubmit = vi.fn();
      render(<CommentComposer onSubmit={onSubmit} members={mockMembers} />);

      const textarea = screen.getByLabelText(/write a comment/i);

      // Type "@" to show all members
      fireEvent.change(textarea, { target: { value: '@', selectionStart: 1 } });

      await waitFor(() => {
        expect(screen.getByTestId('mention-popover')).toBeInTheDocument();
      });

      const options = screen.getAllByTestId('mention-option');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');

      // Press ArrowDown
      fireEvent.keyDown(textarea, { key: 'ArrowDown', code: 'ArrowDown' });
      expect(options[1]).toHaveAttribute('aria-selected', 'true');

      // Press Enter to select Bob
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });
      expect(textarea).toHaveValue('@Bob ');
    });

    it('closes popover on Escape key', async () => {
      render(<CommentComposer onSubmit={vi.fn()} members={mockMembers} />);

      const textarea = screen.getByLabelText(/write a comment/i);
      fireEvent.change(textarea, { target: { value: '@', selectionStart: 1 } });

      await waitFor(() => {
        expect(screen.getByTestId('mention-popover')).toBeInTheDocument();
      });

      fireEvent.keyDown(textarea, { key: 'Escape', code: 'Escape' });
      expect(screen.queryByTestId('mention-popover')).not.toBeInTheDocument();
    });

    it('Ctrl+Enter or Cmd+Enter submits the comment even if popover is currently active', async () => {
      const onSubmit = vi.fn();
      render(<CommentComposer onSubmit={onSubmit} members={mockMembers} />);

      const textarea = screen.getByLabelText(/write a comment/i);

      // Type "@" so popover is open
      fireEvent.change(textarea, { target: { value: 'Ping @', selectionStart: 6 } });

      await waitFor(() => {
        expect(screen.getByTestId('mention-popover')).toBeInTheDocument();
      });

      // Press Ctrl+Enter
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', ctrlKey: true });

      expect(onSubmit).toHaveBeenCalledWith('Ping @');
      expect(screen.queryByTestId('mention-popover')).not.toBeInTheDocument();
    });
  });

  describe('Integration: CommentsSection with mentions', () => {
    const server = setupServer(
      http.get('*/api/tasks/:taskId/comments', () => {
        return HttpResponse.json([
          {
            id: 'c-1',
            taskId: 't-1',
            userId: 'u-author',
            userName: 'Author',
            content: 'Hello @Alice Developer please inspect this task',
            createdAt: '2026-08-01T12:00:00Z',
            mentionedUserIds: ['u-alice'],
          },
          {
            id: 'c-2',
            taskId: 't-1',
            userId: 'u-author',
            userName: 'Author',
            content: 'Also tagged @GhostUser who is not in the project',
            createdAt: '2026-08-01T13:00:00Z',
            mentionedUserIds: [],
          },
        ]);
      }),
      http.get('*/api/projects/:projectId/members', () => {
        return HttpResponse.json(mockMembers);
      })
    );

    beforeEach(() => {
      server.listen({ onUnhandledRequest: 'bypass' });
      server.resetHandlers();
      localStorage.clear();
      setToken(createJwt({ sub: 'u-author', exp: Math.floor(Date.now() / 1000) + 3600 }));
    });

    afterAll(() => {
      server.close();
    });

    it('renders comments highlighting real mentions and leaving non-members unhighlighted', async () => {
      renderWithProviders(
        <CommentsSection
          taskId="t-1"
          projectId="proj-1"
          memberMap={memberMap}
          members={mockMembers}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Hello/)).toBeInTheDocument();
      });

      // Alice is in mentionedUserIds -> highlighted
      const highlights = screen.getAllByTestId('mention-highlight');
      expect(highlights).toHaveLength(1);
      expect(highlights[0]).toHaveTextContent('@Alice Developer');

      // GhostUser is in mentionedUserIds: [] -> NOT highlighted
      expect(screen.getByText(/Also tagged/)).toBeInTheDocument();
      expect(screen.getByText(/@GhostUser/)).not.toHaveAttribute('data-testid', 'mention-highlight');
    });
  });
});
