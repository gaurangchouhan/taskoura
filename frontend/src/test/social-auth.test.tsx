import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { SocialAuthButtons } from '../components/auth/SocialAuthButtons';
import { OAuthCallbackPage } from '../pages/OAuthCallbackPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';

function createValidTestToken(): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 })
  );
  return `${header}.${payload}.signature`;
}

let mockProvidersList: Array<{ key: string; label: string; startUrl: string }> = [
  { key: 'google', label: 'Google', startUrl: '/oauth2/authorization/google' },
  { key: 'github', label: 'GitHub', startUrl: '/oauth2/authorization/github' },
];

let exchangeCallCount = 0;
let lastExchangeCode: string | null = null;
let returnExchange400 = false;
let providersStatus = 200;

const server = setupServer(
  http.get('*/api/health', () => {
    return HttpResponse.json({ status: 'UP', service: 'taskoura-backend' });
  }),

  http.get('*/api/auth/oauth/providers', () => {
    if (providersStatus === 404) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({ providers: mockProvidersList });
  }),

  http.post('*/api/auth/oauth/exchange', async ({ request }) => {
    exchangeCallCount++;
    const body = (await request.json()) as { code: string };
    lastExchangeCode = body.code;

    if (returnExchange400 || body.code === 'expired-code') {
      return HttpResponse.json(
        { code: 'VALIDATION_FAILED', message: 'The one-time code has expired' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      token: createValidTestToken(),
      user: {
        id: 'u-social-1',
        name: 'Gaurang Social',
        email: 'gaurang@taskoura.dev',
        oauthProvider: 'google',
      },
      session: {
        idleExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        absoluteExpiresAt: new Date(Date.now() + 86400000).toISOString(),
        serverTime: new Date().toISOString(),
      },
    });
  })
);

const LocationWitness: React.FC = () => {
  const location = useLocation();
  return (
    <div data-testid="location-witness">
      <span data-testid="current-path">{location.pathname}</span>
      <span data-testid="current-search">{location.search}</span>
    </div>
  );
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

describe('F-SOCIAL: SocialAuthButtons & OAuthCallbackPage', () => {
  let mockAssign: any;
  let mockReplaceState: any;
  const originalEnv = { ...import.meta.env };

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
    exchangeCallCount = 0;
    lastExchangeCode = null;
    returnExchange400 = false;
    providersStatus = 200;
    mockProvidersList = [
      { key: 'google', label: 'Google', startUrl: '/oauth2/authorization/google' },
      { key: 'github', label: 'GitHub', startUrl: '/oauth2/authorization/github' },
    ];

    mockAssign = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...window.location,
        assign: mockAssign,
        origin: 'http://localhost:3000',
        search: '',
        pathname: '/auth/callback',
      },
    });

    mockReplaceState = vi.fn();
    window.history.replaceState = mockReplaceState;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.assign(import.meta.env, originalEnv);
  });

  // Test 1: Renders both buttons when providers endpoint returns google and github
  it('1. Renders both buttons when providers endpoint returns google and github', async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <SocialAuthButtons action="signin" />
      </QueryClientProvider>
    );

    const googleBtn = await screen.findByTestId('social-btn-google');
    const githubBtn = await screen.findByTestId('social-btn-github');

    expect(googleBtn).toBeInTheDocument();
    expect(googleBtn).toHaveTextContent('Google');
    expect(githubBtn).toBeInTheDocument();
    expect(githubBtn).toHaveTextContent('GitHub');
    expect(screen.getByText('OR CONTINUE WITH')).toBeInTheDocument();
  });

  // Test 2: Renders only Google when only google is returned
  it('2. Renders only Google when only google is returned', async () => {
    mockProvidersList = [
      { key: 'google', label: 'Google', startUrl: '/oauth2/authorization/google' },
    ];
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <SocialAuthButtons action="signin" />
      </QueryClientProvider>
    );

    const googleBtn = await screen.findByTestId('social-btn-google');
    expect(googleBtn).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('social-btn-github')).not.toBeInTheDocument();
    });
  });

  // Test 3: Renders the fallback when the endpoint returns 404 (falls back to both default startUrls)
  it('3. Renders the fallback when the endpoint returns 404', async () => {
    providersStatus = 404;
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <SocialAuthButtons action="signin" />
      </QueryClientProvider>
    );

    const googleBtn = await screen.findByTestId('social-btn-google');
    const githubBtn = await screen.findByTestId('social-btn-github');

    expect(googleBtn).toBeInTheDocument();
    expect(githubBtn).toBeInTheDocument();
  });

  // Test 4: Renders the muted "Social sign-in is not available right now" when the providers list is empty
  it('4. Renders the muted "Social sign-in is not available right now" when providers list is empty', async () => {
    mockProvidersList = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <SocialAuthButtons action="signin" />
      </QueryClientProvider>
    );

    const emptyNotice = await screen.findByText(/Social sign-in is not available right now/i);
    expect(emptyNotice).toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Social sign-in is not available right now')
    );
  });

  // Test 5: Clicking a button navigates the browser to the absolute backend URL
  it('5. Clicking a button navigates the browser to the absolute backend URL', async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <SocialAuthButtons action="signin" />
      </QueryClientProvider>
    );

    const googleBtn = await screen.findByTestId('social-btn-google');
    await user.click(googleBtn);

    expect(mockAssign).toHaveBeenCalledTimes(1);
    const assignedUrl = mockAssign.mock.calls[0][0];
    expect(assignedUrl).toMatch(/^https?:\/\//);
    expect(assignedUrl).toContain('/oauth2/authorization/google');
  });

  // Test 6: Shows error if VITE_API_URL is missing in production
  it('6. Shows error if VITE_API_URL is missing in production', async () => {
    (import.meta.env as any).PROD = true;
    (import.meta.env as any).VITE_API_URL = '';

    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <SocialAuthButtons action="signin" />
      </QueryClientProvider>
    );

    const googleBtn = await screen.findByTestId('social-btn-google');
    await user.click(googleBtn);

    expect(await screen.findByText(/Social login is not configured/i)).toBeInTheDocument();
    expect(mockAssign).not.toHaveBeenCalled();
  });

  // Test 7: Successful exchange logs user in (AuthContext.login called) and navigates to WORKSPACE (/app/projects)
  it('7. Successful exchange logs the user in and navigates to WORKSPACE (/app/projects)', async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/auth/callback?code=valid-exchange-code']}>
            <LocationWitness />
            <Routes>
              <Route path="/auth/callback" element={<OAuthCallbackPage />} />
              <Route path="/app/projects" element={<div data-testid="app-screen">Workspace Projects Screen</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-path')).toHaveTextContent('/app/projects');
    });

    expect(lastExchangeCode).toBe('valid-exchange-code');
    expect(localStorage.getItem('taskoura_token')).toBeTruthy();
    expect(localStorage.getItem('taskoura_user')).toContain('Gaurang Social');
  });

  // Test 8: Strips code from the URL immediately on mount
  it('8. Strips code from the URL immediately on mount', async () => {
    window.location.search = '?code=secret-token-code';
    window.location.pathname = '/auth/callback';

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/auth/callback?code=secret-token-code']}>
            <Routes>
              <Route path="/auth/callback" element={<OAuthCallbackPage />} />
              <Route path="/app/projects" element={<div>Workspace Projects</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(mockReplaceState).toHaveBeenCalledWith({}, document.title, '/auth/callback');
  });

  // Test 9: StrictMode does not call exchange twice
  it('9. StrictMode does not call exchange twice', async () => {
    const queryClient = createTestQueryClient();
    render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={['/auth/callback?code=strict-mode-code']}>
              <Routes>
                <Route path="/auth/callback" element={<OAuthCallbackPage />} />
                <Route path="/app/projects" element={<div>Workspace Projects</div>} />
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      </React.StrictMode>
    );

    await waitFor(() => {
      expect(lastExchangeCode).toBe('strict-mode-code');
    });

    expect(exchangeCallCount).toBe(1);
  });

  // Test 10: Displays the specific friendly message when error=ACCOUNT_EXISTS_USE_PASSWORD
  it('10. Displays the specific friendly message when error=ACCOUNT_EXISTS_USE_PASSWORD', async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/auth/callback?error=ACCOUNT_EXISTS_USE_PASSWORD']}>
            <Routes>
              <Route path="/auth/callback" element={<OAuthCallbackPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    const friendlyMsg = await screen.findByText(
      'An account with this email already exists. Log in with your password, then connect Google or GitHub from your profile'
    );
    expect(friendlyMsg).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Account with Email/i })).toBeInTheDocument();
  });

  it('displays correct messages for ACCOUNT_EXISTS_UNVERIFIED and for each methods value', async () => {
    const testCases = [
      {
        entries: ['/auth/callback?error=ACCOUNT_EXISTS_UNVERIFIED'],
        expected: 'An account with this email exists but was never verified. Verify it with the code we emailed you (use Resend code), then try again',
      },
      {
        entries: ['/auth/callback?error=ACCOUNT_EXISTS_USE_PASSWORD&methods=password'],
        expected: 'An account with this email already exists. Log in with your password, then connect Google or GitHub from your profile',
      },
      {
        entries: ['/auth/callback?error=ACCOUNT_EXISTS_USE_PASSWORD&methods=google,password'],
        expected: 'An account with this email already exists. Log in with your password, then connect Google or GitHub from your profile',
      },
      {
        entries: ['/auth/callback?error=ACCOUNT_EXISTS_USE_PASSWORD&methods=google'],
        expected: 'This email is already registered with Google. Sign in with that provider, then connect the other one from your profile',
      },
      {
        entries: ['/auth/callback?error=ACCOUNT_EXISTS_USE_PASSWORD&methods=github'],
        expected: 'This email is already registered with GitHub. Sign in with that provider, then connect the other one from your profile',
      },
      {
        entries: ['/auth/callback?error=ACCOUNT_EXISTS_USE_PASSWORD&methods=google,github'],
        expected: 'This email is already registered with Google and GitHub. Sign in with that provider, then connect the other one from your profile',
      },
      {
        entries: ['/auth/callback?error=ACCOUNT_EXISTS_USE_PASSWORD&methods=unknown_method'],
        expected: 'An account with this email already exists. Log in with your password, then connect Google or GitHub from your profile',
      },
      {
        entries: ['/auth/callback?error=SOME_UNKNOWN_CODE_999'],
        expected: 'Sign-in failed. Please try again.',
      },
    ];

    for (const tc of testCases) {
      const queryClient = createTestQueryClient();
      const { unmount } = render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={tc.entries}>
              <Routes>
                <Route path="/auth/callback" element={<OAuthCallbackPage />} />
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      );

      const msg = await screen.findByText(tc.expected);
      expect(msg).toBeInTheDocument();
      // Verify raw code is never shown
      expect(screen.queryByText(/SOME_UNKNOWN_CODE_999/)).not.toBeInTheDocument();
      unmount();
    }
  });

  // Test 11: Displays the expired message when exchange returns 400 VALIDATION_FAILED
  it('11. Displays the expired message when exchange returns 400 VALIDATION_FAILED', async () => {
    returnExchange400 = true;
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/auth/callback?code=expired-code']}>
            <Routes>
              <Route path="/auth/callback" element={<OAuthCallbackPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    const expiredNotice = await screen.findByText(
      'This sign-in link expired or was already used. Please try again.'
    );
    expect(expiredNotice).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
  });

  // Test 12: Redirects to /login if no params are present
  it('12. Redirects to /login if no params are present', async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/auth/callback']}>
            <LocationWitness />
            <Routes>
              <Route path="/auth/callback" element={<OAuthCallbackPage />} />
              <Route path="/login" element={<div data-testid="login-screen">Login</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-path')).toHaveTextContent('/login');
    });
  });

  // Extra verification: LoginPage and RegisterPage render SocialAuthButtons below main action
  it('renders SocialAuthButtons on LoginPage below the Sign In form and warms up health endpoint', async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/login']}>
            <LoginPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    const submitBtn = screen.getByRole('button', { name: /Sign In/i });
    const prefillBtn = screen.getByRole('button', { name: /Prefill with standard credentials/i });
    const googleBtn = await screen.findByTestId('social-btn-google');

    expect(submitBtn).toBeInTheDocument();
    expect(googleBtn).toBeInTheDocument();
    expect(prefillBtn).toBeInTheDocument();

    // Verify ordering: submitBtn appears before googleBtn, which appears before prefillBtn
    expect(submitBtn.compareDocumentPosition(googleBtn)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(googleBtn.compareDocumentPosition(prefillBtn)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('renders SocialAuthButtons on RegisterPage below the Create Account button', async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/register']}>
            <RegisterPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    const createAccountBtn = screen.getByRole('button', { name: /Create Account/i });
    const googleBtn = await screen.findByTestId('social-btn-google');
    const signInLink = screen.getByRole('link', { name: /Sign In/i });

    expect(createAccountBtn).toBeInTheDocument();
    expect(googleBtn).toBeInTheDocument();
    expect(signInLink).toBeInTheDocument();

    expect(createAccountBtn.compareDocumentPosition(googleBtn)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(googleBtn.compareDocumentPosition(signInLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
