import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { normalizeNotification, RawNotification, Notification } from '../types/notification';
import { NotificationBell } from '../components/notifications/NotificationBell';
import { NotificationList } from '../components/notifications/NotificationList';
import { NotificationsPage } from '../pages/NotificationsPage';
import { ActivityFeed } from '../components/activity/ActivityFeed';
import { ActivityLog } from '../types/activity';
import { ProjectMember } from '../types/member';
import { setToken, setStoredUser } from '../lib/token';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

let mockNotifications: Notification[] = [];
let mockActivities: ActivityLog[] = [];
let markReadCalls: string[] = [];

const server = setupServer(
  http.get('*/api/notifications', ({ request }) => {
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const result = unreadOnly
      ? mockNotifications.filter((n) => !n.isRead)
      : mockNotifications;
    return HttpResponse.json(result);
  }),

  http.patch('*/api/notifications/:id/read', ({ params }) => {
    const id = params.id as string;
    markReadCalls.push(id);
    const item = mockNotifications.find((n) => n.id === id);
    if (item) {
      item.isRead = true;
      return HttpResponse.json(item);
    }
    return HttpResponse.json({ id, message: 'Not found', isRead: true, createdAt: new Date().toISOString() });
  }),

  http.get('*/api/projects/:projectId/activity', () => {
    return HttpResponse.json(mockActivities);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());

beforeEach(() => {
  server.resetHandlers();
  markReadCalls = [];
  mockNotifications = [];
  mockActivities = [];

  const token = createJwt({
    sub: 'user-bob-1',
    name: 'Bob Tester',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  setToken(token);
  setStoredUser({
    id: 'user-bob-1',
    name: 'Bob Tester',
    email: 'bob@example.com',
  });
});

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Module F9: Notifications Normalizer', () => {
  it('normalizes notifications with isRead property', () => {
    const raw: RawNotification = {
      id: 'n-1',
      message: 'Task assigned to you',
      isRead: true,
      createdAt: '2026-10-22T10:00:00Z',
    };
    const normalized = normalizeNotification(raw);
    expect(normalized.id).toBe('n-1');
    expect(normalized.message).toBe('Task assigned to you');
    expect(normalized.isRead).toBe(true);
    expect(normalized.createdAt).toBe('2026-10-22T10:00:00Z');
  });

  it('normalizes notifications with read property (Jackson boolean convention)', () => {
    const raw: RawNotification = {
      id: 'n-2',
      message: 'Bug reported by Alice',
      read: true,
      createdAt: '2026-10-22T11:00:00Z',
    };
    const normalized = normalizeNotification(raw);
    expect(normalized.id).toBe('n-2');
    expect(normalized.message).toBe('Bug reported by Alice');
    expect(normalized.isRead).toBe(true);
  });

  it('normalizes unread notifications with isRead: false or read: false', () => {
    const raw1: RawNotification = {
      id: 'n-3',
      message: 'Status changed',
      isRead: false,
      createdAt: '2026-10-22T12:00:00Z',
    };
    const raw2: RawNotification = {
      id: 'n-4',
      message: 'Comment posted',
      read: false,
      createdAt: '2026-10-22T13:00:00Z',
    };
    expect(normalizeNotification(raw1).isRead).toBe(false);
    expect(normalizeNotification(raw2).isRead).toBe(false);
  });

  it('handles empty or malformed objects gracefully', () => {
    const normalized = normalizeNotification({} as RawNotification);
    expect(normalized.id).toBe('');
    expect(normalized.message).toBe('');
    expect(normalized.isRead).toBe(false);
    expect(normalized.createdAt).toBe('');
  });
});

describe('Module F9: NotificationBell Badge', () => {
  it('hides the badge when unread count is zero', async () => {
    mockNotifications = [
      { id: '1', message: 'All read 1', isRead: true, createdAt: new Date().toISOString() },
      { id: '2', message: 'All read 2', isRead: true, createdAt: new Date().toISOString() },
    ];

    renderWithClient(<NotificationBell />);

    expect(screen.getByTestId('notification-bell-btn')).toBeInTheDocument();
    // Badge should not be rendered
    await waitFor(() => {
      expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument();
    });
  });

  it('displays the exact unread count when under 100', async () => {
    mockNotifications = [
      { id: '1', message: 'Task 1', isRead: false, createdAt: new Date().toISOString() },
      { id: '2', message: 'Task 2', isRead: false, createdAt: new Date().toISOString() },
      { id: '3', message: 'Task 3', isRead: false, createdAt: new Date().toISOString() },
    ];

    renderWithClient(<NotificationBell />);

    const badge = await screen.findByTestId('unread-badge');
    expect(badge).toHaveTextContent('3');
  });

  it('caps the badge display at 99+ when unread count exceeds 99', async () => {
    mockNotifications = Array.from({ length: 120 }, (_, i) => ({
      id: `n-${i}`,
      message: `Mass notification ${i}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    }));

    renderWithClient(<NotificationBell />);

    const badge = await screen.findByTestId('unread-badge');
    expect(badge).toHaveTextContent('99+');
  });
});

describe('Module F9: NotificationBell Dropdown & Mark Read', () => {
  it('opens dropdown, shows latest 8 notifications, and marks an item read on click', async () => {
    const user = userEvent.setup();

    // 10 notifications (latest should only show 8)
    mockNotifications = Array.from({ length: 10 }, (_, i) => ({
      id: `item-${i}`,
      message: `Notification number ${i}`,
      isRead: i !== 0, // item-0 is unread
      createdAt: new Date(Date.now() - i * 60000).toISOString(),
    }));

    renderWithClient(<NotificationBell />);

    // Click bell to open dropdown
    const bellBtn = screen.getByTestId('notification-bell-btn');
    await user.click(bellBtn);

    const dropdown = await screen.findByTestId('notification-dropdown');
    expect(dropdown).toBeInTheDocument();

    // Item-0 through item-7 should be visible (latest 8)
    expect(screen.getByTestId('notification-item-item-0')).toBeInTheDocument();
    expect(screen.getByTestId('notification-item-item-7')).toBeInTheDocument();
    expect(screen.queryByTestId('notification-item-item-8')).not.toBeInTheDocument();

    // Clicking unread item-0 triggers markRead
    await user.click(screen.getByTestId('notification-item-item-0'));

    await waitFor(() => {
      expect(markReadCalls).toContain('item-0');
    });
  });
});

describe('Module F9: NotificationsPage Tabs & List', () => {
  it('renders all notifications, filters by unread tab, and marks read via button', async () => {
    const user = userEvent.setup();

    mockNotifications = [
      { id: 'notif-1', message: 'First unread alert', isRead: false, createdAt: new Date().toISOString() },
      { id: 'notif-2', message: 'Second read message', isRead: true, createdAt: new Date().toISOString() },
    ];

    renderWithClient(<NotificationsPage />);

    // In All tab, both rows should appear
    expect(await screen.findByText('First unread alert')).toBeInTheDocument();
    expect(screen.getByText('Second read message')).toBeInTheDocument();

    // Click mark read button for notif-1
    const markReadBtn = screen.getByTestId('mark-read-btn-notif-1');
    await user.click(markReadBtn);

    await waitFor(() => {
      expect(markReadCalls).toContain('notif-1');
    });

    // Switch to Unread tab
    const unreadTabBtn = screen.getByTestId('tab-unread-notifications');
    await user.click(unreadTabBtn);

    // After notif-1 is marked read and notif-2 is read, unread tab should show empty state
    await waitFor(() => {
      expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
    });
  });

  it('renders empty state when there are no notifications', () => {
    renderWithClient(
      <NotificationList
        notifications={[]}
        onMarkRead={() => {}}
        emptyMessage="No notifications in your box."
      />
    );

    expect(screen.getByTestId('empty-notifications')).toBeInTheDocument();
    expect(screen.getByText('No notifications in your box.')).toBeInTheDocument();
  });
});

describe('Module F9: ActivityFeed Grouping & Fallback Icon', () => {
  const memberMap = new Map<string, ProjectMember>([
    [
      'user-alice-1',
      {
        id: 'mem-1',
        userId: 'user-alice-1',
        userName: 'Alice Engineer',
        userEmail: 'alice@example.com',
        role: 'Owner',
      },
    ],
  ]);

  it('groups activity entries by day and resolves member names', () => {
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const activities: ActivityLog[] = [
      {
        id: 'act-1',
        projectId: 'p-1',
        userId: 'user-alice-1',
        userName: 'Alice',
        actionType: 'TASK_CREATED',
        description: 'Created task "Setup database schema"',
        createdAt: today,
      },
      {
        id: 'act-2',
        projectId: 'p-1',
        userId: 'user-stranger-2',
        userName: 'Bob Guest',
        actionType: 'TASK_STATUS_CHANGED',
        description: 'Moved task "Login flow" to IN_PROCESS',
        createdAt: yesterday,
      },
    ];

    renderWithClient(<ActivityFeed activities={activities} memberMap={memberMap} />);

    // Day groups should exist
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();

    // Actor name resolved via memberMap
    expect(screen.getByText('Alice Engineer')).toBeInTheDocument();
    // Actor name fallback when not in memberMap
    expect(screen.getByText('Bob Guest')).toBeInTheDocument();

    // Descriptions
    expect(screen.getByText('Created task "Setup database schema"')).toBeInTheDocument();
    expect(screen.getByText('Moved task "Login flow" to IN_PROCESS')).toBeInTheDocument();
  });

  it('shows the generic fallback icon for an unknown actionType', () => {
    const activities: ActivityLog[] = [
      {
        id: 'act-unknown',
        projectId: 'p-1',
        userId: 'user-alice-1',
        userName: 'Alice Engineer',
        actionType: 'CUSTOM_SYSTEM_RELOAD_ACTION',
        description: 'Triggered custom maintenance action',
        createdAt: new Date().toISOString(),
      },
    ];

    renderWithClient(<ActivityFeed activities={activities} memberMap={memberMap} />);

    // Fallback icon should be rendered
    const fallbackIcon = screen.getByTestId('fallback-activity-icon');
    expect(fallbackIcon).toBeInTheDocument();
  });

  it('shows empty state when activities array is empty', () => {
    renderWithClient(<ActivityFeed activities={[]} memberMap={memberMap} />);

    expect(screen.getByTestId('empty-activity-feed')).toBeInTheDocument();
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });
});
