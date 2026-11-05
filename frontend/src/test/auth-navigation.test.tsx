import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { App } from '../App';
import { OAuthCallbackPage } from '../pages/OAuthCallbackPage';
import { getPostLoginPath } from '../lib/authRedirect';
import {
  HOME,
  LOGIN,
  REGISTER,
  OAUTH_CALLBACK,
  WORKSPACE,
  FORGOT_PASSWORD,
  RESET_PASSWORD,
  VERIFY_EMAIL,
} from '../routes/paths';

function createValidToken(userId: string = 'user-1'): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })
  );
  return `${header}.${payload}.signature`;
}

let exchangeCount = 0;
let lastCodeExchanged: string | null = null;
let currentProvider = 'google';
let isNewUser = false;
let shouldFailExchange = false;

const server = setupServer(
  http.get('*/api/health', () => HttpResponse.json({ status: 'UP' })),
  http.get('*/api/auth/oauth/providers', () =>
    HttpResponse.json({
      providers: [
        { key: 'google', label: 'Google', startUrl: '/oauth2/authorization/google' },
        { key: 'github', label: 'GitHub', startUrl: '/oauth2/authorization/github' },
      ],
    })
  ),
  http.post('*/api/auth/oauth/exchange', async ({ request }) => {
    exchangeCount++;
    const body = (await request.json()) as { code: string };
    lastCodeExchanged = body.code;

    if (shouldFailExchange || body.code === 'invalid-code' || body.code === 'reused-code') {
      return HttpResponse.json(
        { code: 'VALIDATION_FAILED', message: 'The one-time code has expired' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      token: createValidToken(isNewUser ? 'new-user-123' : 'existing-user-456'),
      user: {
        id: isNewUser ? 'new-user-123' : 'existing-user-456',
        name: isNewUser ? 'New Social User' : 'Existing Social User',
        email: isNewUser ? 'newuser@taskoura.dev' : 'existinguser@taskoura.dev',
        oauthProvider: currentProvider,
      },
      session: {
        idleExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        absoluteExpiresAt: new Date(Date.now() + 86400000).toISOString(),
        serverTime: new Date().toISOString(),
      },
    });
  }),
  http.post('*/api/auth/logout', () => HttpResponse.json({ message: 'Logged out successfully' })),
  http.get('*/api/projects', () => HttpResponse.json([])),
  http.get('*/api/notifications', () => HttpResponse.json([]))
);

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

const LocationWitness: React.FC = () => {
  const location = useLocation();
  return (
    <div data-testid="location-witness">
      <span data-testid="witness-path">{location.pathname}</span>
      <span data-testid="witness-search">{location.search}</span>
    </div>
  );
};

describe('Post-Login Navigation & Route Path Alignment', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'bypass' });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    sessionStorage.clear();
    exchangeCount = 0;
    lastCodeExchanged = null;
    currentProvider = 'google';
    isNewUser = false;
    shouldFailExchange = false;

    // Reset window.location
    delete (window as any).location;
    window.location = {
      href: 'http://localhost:3000/',
      pathname: '/',
      search: '',
      hash: '',
      assign: vi.fn(),
      replace: vi.fn(),
    } as any;
  });

  describe('1. getPostLoginPath(from) unit security rules', () => {
    it('returns WORKSPACE for empty, null, or undefined values', () => {
      expect(getPostLoginPath(null)).toBe(WORKSPACE);
      expect(getPostLoginPath(undefined)).toBe(WORKSPACE);
      expect(getPostLoginPath('')).toBe(WORKSPACE);
      expect(getPostLoginPath('   ')).toBe(WORKSPACE);
    });

    it('preserves valid same-site internal paths', () => {
      expect(getPostLoginPath('/app/projects')).toBe('/app/projects');
      expect(getPostLoginPath('/app/projects/123/board')).toBe('/app/projects/123/board');
      expect(getPostLoginPath('/app/profile?tab=security')).toBe('/app/profile?tab=security');
      expect(getPostLoginPath('/notifications')).toBe('/notifications');
    });

    it('rejects malicious external protocol and scheme URLs and falls back to WORKSPACE', () => {
      expect(getPostLoginPath('https://evil.com')).toBe(WORKSPACE);
      expect(getPostLoginPath('http://evil.com/app/projects')).toBe(WORKSPACE);
      expect(getPostLoginPath('javascript:alert(1)')).toBe(WORKSPACE);
      expect(getPostLoginPath('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(WORKSPACE);
    });

    it('rejects double-slash and backslash open-redirect bypass vectors', () => {
      expect(getPostLoginPath('//evil.com')).toBe(WORKSPACE);
      expect(getPostLoginPath('/\\evil.com')).toBe(WORKSPACE);
      expect(getPostLoginPath('/app/projects\\evil.com')).toBe(WORKSPACE);
      expect(getPostLoginPath('\\\\evil.com')).toBe(WORKSPACE);
    });

    it('rejects auth/registration/verification loops and falls back to WORKSPACE', () => {
      expect(getPostLoginPath(LOGIN)).toBe(WORKSPACE);
      expect(getPostLoginPath(REGISTER)).toBe(WORKSPACE);
      expect(getPostLoginPath(OAUTH_CALLBACK)).toBe(WORKSPACE);
      expect(getPostLoginPath(FORGOT_PASSWORD)).toBe(WORKSPACE);
      expect(getPostLoginPath(RESET_PASSWORD)).toBe(WORKSPACE);
      expect(getPostLoginPath(VERIFY_EMAIL)).toBe(WORKSPACE);
      expect(getPostLoginPath('/verify-otp')).toBe(WORKSPACE);
    });
  });

  describe('2. Route manifest test: Path constants render real pages (never NotFound)', () => {
    it('renders HOME ("/") without 404', () => {
      const qc = createTestQueryClient();
      render(
        <QueryClientProvider client={qc}>
          <AuthProvider>
            <MemoryRouter initialEntries={[HOME]}>
              <App />
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      expect(screen.queryByText(/Page Not Found/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/404/i)).not.toBeInTheDocument();
    });

    it('renders LOGIN ("/login") without 404', () => {
      const qc = createTestQueryClient();
      render(
        <QueryClientProvider client={qc}>
          <AuthProvider>
            <MemoryRouter initialEntries={[LOGIN]}>
              <App />
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      expect(screen.queryByText(/Page Not Found/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    });

    it('renders REGISTER ("/register") without 404', () => {
      const qc = createTestQueryClient();
      render(
        <QueryClientProvider client={qc}>
          <AuthProvider>
            <MemoryRouter initialEntries={[REGISTER]}>
              <App />
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      expect(screen.queryByText(/Page Not Found/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
    });

    it('renders WORKSPACE ("/app/projects") under authenticated state without 404', async () => {
      const validToken = createValidToken('user-manifest');
      localStorage.setItem('taskoura_token', validToken);
      localStorage.setItem('taskoura_user', JSON.stringify({ id: 'user-manifest', name: 'Manifest User', email: 'test@taskoura.dev' }));

      const qc = createTestQueryClient();
      render(
        <QueryClientProvider client={qc}>
          <AuthProvider>
            <MemoryRouter initialEntries={[WORKSPACE]}>
              <App />
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      expect(screen.queryByText(/Page Not Found/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/404/i)).not.toBeInTheDocument();
    });

    it('renders NotFoundPage only for actual unregistered routes', () => {
      const qc = createTestQueryClient();
      render(
        <QueryClientProvider client={qc}>
          <AuthProvider>
            <MemoryRouter initialEntries={['/some-unregistered-garbage-route']}>
              <App />
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      expect(screen.getByText(/Page Not Found/i)).toBeInTheDocument();
    });
  });

  describe('3. OAuth Callback Success & Navigation', () => {
    it('exchanges code once, calls login, navigates to WORKSPACE with replace, and strips code', async () => {
      const qc = createTestQueryClient();
      window.location.search = '?code=single-use-code-123';
      window.location.pathname = '/auth/callback';

      render(
        <QueryClientProvider client={qc}>
          <AuthProvider>
            <MemoryRouter initialEntries={['/auth/callback?code=single-use-code-123']}>
              <LocationWitness />
              <Routes>
                <Route path="/auth/callback" element={<OAuthCallbackPage />} />
                <Route path={WORKSPACE} element={<div data-testid="workspace-screen">Workspace Page</div>} />
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('witness-path')).toHaveTextContent(WORKSPACE);
      });

      expect(exchangeCount).toBe(1);
      expect(lastCodeExchanged).toBe('single-use-code-123');
      expect(screen.getByTestId('witness-search')).toHaveTextContent('');
      expect(localStorage.getItem('taskoura_token')).toBeTruthy();
    });

    it('navigates to saved from destination when valid same-site path', async () => {
      sessionStorage.setItem('taskoura_auth_from', '/app/projects/custom-project-99');
      const qc = createTestQueryClient();

      render(
        <QueryClientProvider client={qc}>
          <AuthProvider>
            <MemoryRouter initialEntries={['/auth/callback?code=valid-code-redirect']}>
              <LocationWitness />
              <Routes>
                <Route path="/auth/callback" element={<OAuthCallbackPage />} />
                <Route path="/app/projects/custom-project-99" element={<div>Custom Project Screen</div>} />
                <Route path={WORKSPACE} element={<div>Fallback Workspace</div>} />
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('witness-path')).toHaveTextContent('/app/projects/custom-project-99');
      });

      expect(sessionStorage.getItem('taskoura_auth_from')).toBeNull();
    });
  });

  describe('4. Invalid or reused code handling', () => {
    it('shows error state and does not authenticate user when exchange fails', async () => {
      shouldFailExchange = true;
      const qc = createTestQueryClient();

      render(
        <QueryClientProvider client={qc}>
          <AuthProvider>
            <MemoryRouter initialEntries={['/auth/callback?code=reused-code']}>
              <OAuthCallbackPage />
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      expect(await screen.findByText(/This sign-in link expired or was already used/i)).toBeInTheDocument();
      expect(localStorage.getItem('taskoura_token')).toBeNull();
    });
  });

  describe('5. Reload on WORKSPACE keeps user signed in & Logout works', () => {
    const LogoutConsumer: React.FC = () => {
      const { user, logout, isAuthenticated } = useAuth();
      return (
        <div>
          <span data-testid="auth-status">{isAuthenticated ? 'AUTHENTICATED' : 'ANONYMOUS'}</span>
          <span data-testid="user-name">{user?.name}</span>
          <button onClick={() => logout()} data-testid="logout-btn">
            Log Out
          </button>
        </div>
      );
    };

    it('keeps user signed in after reload and successfully logs out', async () => {
      const token = createValidToken('user-persistent');
      localStorage.setItem('taskoura_token', token);
      localStorage.setItem(
        'taskoura_user',
        JSON.stringify({ id: 'user-persistent', name: 'Persistent User', email: 'pers@taskoura.dev' })
      );

      const qc = createTestQueryClient();
      render(
        <QueryClientProvider client={qc}>
          <AuthProvider>
            <MemoryRouter initialEntries={[WORKSPACE]}>
              <Routes>
                <Route path={WORKSPACE} element={<LogoutConsumer />} />
                <Route path={LOGIN} element={<div data-testid="login-screen">Login Screen</div>} />
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('auth-status')).toHaveTextContent('AUTHENTICATED');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Persistent User');

      // Click logout
      const user = userEvent.setup();
      await user.click(screen.getByTestId('logout-btn'));

      await waitFor(() => {
        expect(localStorage.getItem('taskoura_token')).toBeNull();
      });
    });
  });

  describe('6. All four OAuth cases end on WORKSPACE', () => {
    const testCases = [
      { label: 'New Google user', provider: 'google', isNew: true },
      { label: 'Existing Google user', provider: 'google', isNew: false },
      { label: 'New GitHub user', provider: 'github', isNew: true },
      { label: 'Existing GitHub user', provider: 'github', isNew: false },
    ];

    for (const tc of testCases) {
      it(`Case: ${tc.label} ends on WORKSPACE`, async () => {
        currentProvider = tc.provider;
        isNewUser = tc.isNew;
        const qc = createTestQueryClient();

        render(
          <QueryClientProvider client={qc}>
            <AuthProvider>
              <MemoryRouter initialEntries={[`/auth/callback?code=${tc.provider}-${tc.isNew ? 'new' : 'existing'}`]}>
                <LocationWitness />
                <Routes>
                  <Route path="/auth/callback" element={<OAuthCallbackPage />} />
                  <Route path={WORKSPACE} element={<div>Workspace Target</div>} />
                </Routes>
              </MemoryRouter>
            </AuthProvider>
          </QueryClientProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('witness-path')).toHaveTextContent(WORKSPACE);
        });

        expect(localStorage.getItem('taskoura_token')).toBeTruthy();
      });
    }
  });
});

