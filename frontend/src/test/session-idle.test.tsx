import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

import { AuthProvider, useAuth } from '../context/AuthContext';
import { NotificationBell } from '../components/notifications/NotificationBell';
import { notificationService } from '../services/notificationService';
import { LoginPage } from '../pages/LoginPage';
import { apiClient } from '../services/api';
import {
  setToken,
  getToken,
  setStoredUser,
  setStoredSession,
  getStoredSession,
  clearToken,
} from '../lib/token';
import { sessionChannel, SessionChannelManager, AuthSyncEvent } from '../lib/sessionChannel';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

// Track captured requests in MSW
let capturedNotificationsHeaders: Headers | null = null;
let capturedLogoutCount = 0;
let capturedHeartbeatCount = 0;

const server = setupServer(
  http.get('*/api/notifications', ({ request }) => {
    capturedNotificationsHeaders = request.headers;
    return HttpResponse.json([
      { id: 'n1', title: 'Task assigned', message: 'Assigned to task 1', isRead: false, createdAt: new Date().toISOString() },
    ]);
  }),

  http.patch('*/api/notifications/:id/read', ({ request }) => {
    return HttpResponse.json({ id: 'n1', title: 'Task assigned', message: 'Assigned', isRead: true });
  }),

  http.post('*/api/auth/session/heartbeat', () => {
    capturedHeartbeatCount++;
    const now = new Date();
    const newIdle = new Date(now.getTime() + 120 * 1000).toISOString();
    const newAbs = new Date(now.getTime() + 3600 * 1000).toISOString();
    return HttpResponse.json({
      idleExpiresAt: newIdle,
      absoluteExpiresAt: newAbs,
      serverTime: now.toISOString(),
    });
  }),

  http.post('*/api/auth/logout', () => {
    capturedLogoutCount++;
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('*/api/test-401-idle', () => {
    return HttpResponse.json(
      { code: 'SESSION_EXPIRED', reason: 'IDLE_TIMEOUT', message: 'Session timed out due to inactivity' },
      { status: 401 }
    );
  }),

  http.get('*/api/test-401-abs', () => {
    return HttpResponse.json(
      { code: 'SESSION_EXPIRED', reason: 'ABSOLUTE_TIMEOUT', message: 'Session expired due to maximum duration' },
      { status: 401 }
    );
  }),

  http.get('*/api/test-401-revoked', () => {
    return HttpResponse.json(
      { code: 'SESSION_EXPIRED', reason: 'REVOKED', message: 'Session has been revoked' },
      { status: 401 }
    );
  }),

  http.get('*/api/projects', () => {
    return HttpResponse.json([{ id: 'p1', name: 'Project Alpha' }]);
  })
);

const AuthConsumerView: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();

  return (
    <div>
      <div data-testid="auth-state">{isAuthenticated ? 'logged-in' : 'logged-out'}</div>
      <div data-testid="user-name">{user?.name || 'none'}</div>
      <div data-testid="current-path">{location.pathname + location.search}</div>
      <button onClick={() => logout()} data-testid="logout-btn">
        Logout Button
      </button>
    </div>
  );
};

describe('F4: Idle warning and automatic logout', () => {
  let queryClient: QueryClient;
  const originalLocation = window.location;

  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    sessionStorage.clear();
    capturedNotificationsHeaders = null;
    capturedLogoutCount = 0;
    capturedHeartbeatCount = 0;

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    delete (window as unknown as Record<string, unknown>).location;
    window.location = {
      href: 'http://localhost:5173/app/projects',
      pathname: '/app/projects',
      search: '',
    } as unknown as Location;
  });

  afterEach(() => {
    window.location = originalLocation;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const setupAuthSession = (idleSeconds = 120, warningSeconds = 30) => {
    const now = Date.now();
    const token = createJwt({ sub: 'user-1', exp: Math.floor(now / 1000) + 3600 });
    setToken(token);
    setStoredUser({ id: 'user-1', name: 'Gaurang', email: 'gaurang@taskoura.dev' });
    setStoredSession({
      idleTimeoutSeconds: idleSeconds,
      warningSeconds: warningSeconds,
      serverTime: new Date(now).toISOString(),
      idleExpiresAt: new Date(now + idleSeconds * 1000).toISOString(),
      absoluteExpiresAt: new Date(now + 3600 * 1000).toISOString(),
    });
  };

  it('1. No notification or alert is shown to the user while session is active', async () => {
    vi.useFakeTimers();
    setupAuthSession(3600, 0);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/app/projects']}>
          <AuthProvider>
            <AuthConsumerView />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('auth-state')).toHaveTextContent('logged-in');
    // Initially, no warning modal or alert
    expect(screen.queryByTestId('session-warning-modal')).not.toBeInTheDocument();

    // Advance to 50 minutes (3000 seconds) -> still no alert or notification
    act(() => {
      vi.advanceTimersByTime(50 * 60 * 1000);
    });
    expect(screen.queryByTestId('session-warning-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('auth-state')).toHaveTextContent('logged-in');

    // Advance to 59 minutes (3540 seconds) -> still no alert or notification
    act(() => {
      vi.advanceTimersByTime(9 * 60 * 1000);
    });
    expect(screen.queryByTestId('session-warning-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('auth-state')).toHaveTextContent('logged-in');
  });

  it('2. Automatically logs out after 1 hour without requiring user clicks on Stay Logged In or Sign In', async () => {
    vi.useFakeTimers();
    setupAuthSession(3600, 0);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/app/projects']}>
          <AuthProvider>
            <AuthConsumerView />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('auth-state')).toHaveTextContent('logged-in');

    // Advance timers by exactly 1 hour (3600 seconds)
    await act(async () => {
      vi.advanceTimersByTime(3600 * 1000 + 1000);
    });

    // Automatically logged out without any prompt or click
    expect(getToken()).toBeNull();
    expect(getStoredSession()).toBeNull();
    expect(screen.getByTestId('auth-state')).toHaveTextContent('logged-out');
    expect(capturedLogoutCount).toBe(1);
  });

  it('3. Expiry logs out, clears cache, and redirects to /login?reason=timeout remembering from path', async () => {
    vi.useFakeTimers();
    setupAuthSession(120, 30);

    const clearCacheSpy = vi.spyOn(queryClient, 'clear');

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/app/projects/secret-board']}>
          <Routes>
            <Route
              path="/app/projects/secret-board"
              element={
                <AuthProvider>
                  <AuthConsumerView />
                </AuthProvider>
              }
            />
            <Route
              path="/login"
              element={<div data-testid="login-page-rendered">Login Screen</div>}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('auth-state')).toHaveTextContent('logged-in');

    // Advance timers through warning and right past 120s expiry
    await act(async () => {
      vi.advanceTimersByTime(121000);
    });

    // Best-effort logout was called
    expect(capturedLogoutCount).toBe(1);

    // Tokens and session in storage were wiped
    expect(getToken()).toBeNull();
    expect(getStoredSession()).toBeNull();

    // Query client cache was cleared
    expect(clearCacheSpy).toHaveBeenCalled();

    // User is redirected to login with reason=timeout
    expect(screen.getByTestId('login-page-rendered')).toBeInTheDocument();

    // Preserved the current path in sessionStorage for the "from" mechanism
    expect(sessionStorage.getItem('taskoura_auth_from')).toBe('/app/projects/secret-board');
  });

  it('4. Background requests carry X-Background-Request: true and user requests do not', async () => {
    setupAuthSession();

    // 1. Notification bell poll (background request)
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NotificationBell />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(capturedNotificationsHeaders).not.toBeNull();
    });

    expect(capturedNotificationsHeaders?.get('x-background-request')).toBe('true');

    // 2. User-triggered request (e.g. standard project list or direct notification service call)
    let userReqHeaders: Headers | null = null;
    server.use(
      http.get('*/api/notifications', ({ request }) => {
        userReqHeaders = request.headers;
        return HttpResponse.json([
          { id: 'n1', title: 'Task assigned', message: 'Assigned', isRead: false, createdAt: new Date().toISOString() },
        ]);
      })
    );
    await notificationService.getNotifications(false, false);
    expect((userReqHeaders as Headers | null)?.get('x-background-request')).toBeNull();

    // User project API request
    let capturedProjectsBgHeader: string | null = 'not-called';
    server.use(
      http.get('*/api/projects', ({ request }) => {
        capturedProjectsBgHeader = request.headers.get('x-background-request');
        return HttpResponse.json([{ id: 'p1' }]);
      })
    );
    await apiClient.get('/api/projects');
    expect(capturedProjectsBgHeader).toBeNull();
  });

  it('5. Two tabs: logout in one tab logs out the other tab', async () => {
    setupAuthSession();

    const tab2Channel = new SessionChannelManager();
    let tab2LoggedOut = false;
    const tab2Unsubscribe = tab2Channel.subscribe((event: AuthSyncEvent) => {
      if (event.type === 'logout') {
        clearToken();
        tab2LoggedOut = true;
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/app/projects']}>
          <AuthProvider>
            <AuthConsumerView />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('auth-state')).toHaveTextContent('logged-in');

    // Click logout button in Tab 1
    const logoutBtn = screen.getByTestId('logout-btn');
    await act(async () => {
      logoutBtn.click();
    });

    // Tab 1 is logged out
    expect(screen.getByTestId('auth-state')).toHaveTextContent('logged-out');
    expect(capturedLogoutCount).toBe(1);

    // Tab 2 received logout event and was logged out as well
    expect(tab2LoggedOut).toBe(true);

    tab2Unsubscribe();
    tab2Channel.destroy();
  });

  it('6. Interceptor: a 401 with SESSION_EXPIRED logs out and LoginPage shows appropriate message per reason', async () => {
    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    setToken(createJwt({ sub: 'user-1', exp: validFuture }));

    // Test 401 with IDLE_TIMEOUT
    await expect(apiClient.get('/api/test-401-idle')).rejects.toThrow();
    expect(getToken()).toBeNull();
    expect(window.location.href).toContain('/login?reason=timeout&sessionReason=IDLE_TIMEOUT');

    // Render LoginPage with reason=timeout -> idle inactivity message
    const { unmount: unmount1 } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login?reason=timeout']}>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('You were signed out due to inactivity. Please log in again.')).toBeInTheDocument();
    unmount1();

    // Render LoginPage with reason=session_too_old / ABSOLUTE_TIMEOUT
    const { unmount: unmount2 } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login?reason=timeout&sessionReason=ABSOLUTE_TIMEOUT']}>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('Your session was too old and has ended. Please log in again.')).toBeInTheDocument();
    unmount2();

    // Render LoginPage with REVOKED (signed out elsewhere)
    const { unmount: unmount3 } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login?reason=timeout&sessionReason=REVOKED']}>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('You were signed out elsewhere. Please log in again.')).toBeInTheDocument();
    unmount3();

    // Render LoginPage with expired / LEGACY_TOKEN
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login?reason=expired']}>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('Your session expired, please log in again.')).toBeInTheDocument();
  });

  it('7. A tab that sat idle in the background still expires on time', async () => {
    vi.useFakeTimers();
    setupAuthSession(120, 30);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/app/projects']}>
          <AuthProvider>
            <AuthConsumerView />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('auth-state')).toHaveTextContent('logged-in');

    // Simulate sitting in background idle for the full duration: no mousemove or keydown events fired
    await act(async () => {
      vi.advanceTimersByTime(125000);
    });

    // Session has expired automatically
    expect(getToken()).toBeNull();
    expect(screen.getByTestId('auth-state')).toHaveTextContent('logged-out');
  });

  it('8. Absolute expiry automatically logs out after timeout without any warning popup', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    const token = createJwt({ sub: 'user-1', exp: Math.floor(now / 1000) + 7200 });
    setToken(token);
    setStoredUser({ id: 'user-1', name: 'Gaurang', email: 'gaurang@taskoura.dev' });
    setStoredSession({
      idleTimeoutSeconds: 3600,
      warningSeconds: 0,
      serverTime: new Date(now).toISOString(),
      idleExpiresAt: new Date(now + 3600 * 1000).toISOString(),
      absoluteExpiresAt: new Date(now + 3600 * 1000).toISOString(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/app/projects']}>
          <AuthProvider>
            <AuthConsumerView />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // At T=0, no modal
    expect(screen.queryByTestId('session-warning-modal')).not.toBeInTheDocument();

    // Advance 59 minutes -> no modal at all
    act(() => {
      vi.advanceTimersByTime(59 * 60 * 1000);
    });
    expect(screen.queryByTestId('session-warning-modal')).not.toBeInTheDocument();

    // Advance past 60 minutes -> automatically logged out without popup
    await act(async () => {
      vi.advanceTimersByTime(61 * 1000);
    });
    expect(screen.queryByTestId('session-warning-modal')).not.toBeInTheDocument();
    expect(getToken()).toBeNull();
    expect(screen.getByTestId('auth-state')).toHaveTextContent('logged-out');
  });
});
