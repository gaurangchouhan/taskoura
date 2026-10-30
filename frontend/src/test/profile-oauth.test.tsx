import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AuthProvider } from '../context/AuthContext';
import { TimeZoneProvider } from '../lib/datetime';
import { setToken, setStoredUser } from '../lib/token';
import { ProfilePage } from '../features/profile/pages/ProfilePage';
import { UserProfileResponse } from '../types/profile';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

const BASE_USER: UserProfileResponse = {
  id: 'usr-oauth-100',
  name: 'Ada Lovelace',
  email: 'ada@taskoura.dev',
  verified: true,
  createdAt: '2026-01-15T10:00:00Z',
  profile: {
    phone: null,
    phoneVerified: false,
    organization: null,
    department: null,
    jobTitle: null,
    graduationYear: null,
    githubUrl: null,
    linkedinUrl: null,
    bio: null,
    skills: [],
    timeZone: 'UTC',
    avatarUrl: null,
    notificationPrefs: {
      taskAssigned: true,
      deadlineReminders: true,
      mentions: true,
      projectInvites: true,
      statusChanges: false,
    },
  },
  providers: [
    {
      provider: 'google',
      email: 'ada.google@gmail.com',
      linkedAt: '2026-02-01T12:00:00Z',
    },
  ],
  passwordLoginEnabled: true,
};

let currentUser: UserProfileResponse = { ...BASE_USER };
let availableProviders = [
  { key: 'google', label: 'Google', startUrl: '/oauth2/authorization/google' },
  { key: 'github', label: 'GitHub', startUrl: '/oauth2/authorization/github' },
];
let lastLinkStartBody: any = null;
let lastDisconnectedProvider: string | null = null;
let disconnectShouldReturn409 = false;

const server = setupServer(
  http.get('*/api/users/me', () => {
    return HttpResponse.json(currentUser);
  }),

  http.get('*/api/auth/oauth/providers', () => {
    return HttpResponse.json({ providers: availableProviders });
  }),

  http.post('*/api/auth/oauth/link/start', async ({ request }) => {
    const body = (await request.json()) as any;
    lastLinkStartBody = body;
    return HttpResponse.json({ url: `/oauth2/authorization/${body.provider}` });
  }),

  http.delete('*/api/users/me/providers/:provider', ({ params }) => {
    lastDisconnectedProvider = params.provider as string;
    if (disconnectShouldReturn409) {
      return HttpResponse.json(
        {
          code: 'LAST_LOGIN_METHOD',
          message: 'Cannot disconnect your only sign-in method',
          status: 409,
        },
        { status: 409 }
      );
    }
    currentUser = {
      ...currentUser,
      providers: currentUser.providers.filter((p) => p.provider !== params.provider),
    };
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('*/api/notifications*', () => HttpResponse.json([]))
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());

beforeEach(() => {
  server.resetHandlers();
  currentUser = JSON.parse(JSON.stringify(BASE_USER));
  availableProviders = [
    { key: 'google', label: 'Google', startUrl: '/oauth2/authorization/google' },
    { key: 'github', label: 'GitHub', startUrl: '/oauth2/authorization/github' },
  ];
  lastLinkStartBody = null;
  lastDisconnectedProvider = null;
  disconnectShouldReturn409 = false;

  localStorage.clear();
  const token = createJwt({ sub: 'ada@taskoura.dev', exp: Math.floor(Date.now() / 1000) + 3600 });
  setToken(token);
  setStoredUser({
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
  });

  vi.restoreAllMocks();
});

function renderProfilePage(initialEntries = ['/app/profile']) {
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
          <TimeZoneProvider>
            <MemoryRouter initialEntries={initialEntries}>
              <Routes>
                <Route path="/app/profile" element={<ProfilePage />} />
                <Route path="/forgot-password" element={<div data-testid="forgot-password-page">Forgot Password Mock</div>} />
              </Routes>
            </MemoryRouter>
          </TimeZoneProvider>
        </AuthProvider>
      </QueryClientProvider>
    ),
  };
}

describe('PHASE 7B: Connected accounts on Profile', () => {
  it('renders one row for each configured provider returned by /api/auth/oauth/providers', async () => {
    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByTestId('provider-row-google')).toBeInTheDocument();
      expect(screen.getByTestId('provider-row-github')).toBeInTheDocument();
    });

    // Google is connected: shows email, connected date, and Disconnect button
    const googleRow = screen.getByTestId('provider-row-google');
    expect(googleRow).toHaveTextContent('ada.google@gmail.com');
    expect(googleRow).toHaveTextContent('Connected on February 1, 2026');
    expect(screen.getByTestId('disconnect-provider-google')).toBeInTheDocument();

    // GitHub is not connected: shows 'Not connected' and Connect button
    const githubRow = screen.getByTestId('provider-row-github');
    expect(githubRow).toHaveTextContent('Not connected');
    expect(screen.getByTestId('connect-provider-github')).toBeInTheDocument();
  });

  it('only renders providers returned by /api/auth/oauth/providers', async () => {
    // Only GitHub configured
    availableProviders = [
      { key: 'github', label: 'GitHub', startUrl: '/oauth2/authorization/github' },
    ];

    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByTestId('provider-row-github')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('provider-row-google')).not.toBeInTheDocument();
  });

  it('connect calls /api/auth/oauth/link/start and navigates via window.location.assign', async () => {
    const user = userEvent.setup();
    const assignMock = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, assign: assignMock, pathname: '/app/profile' },
    });

    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByTestId('connect-provider-github')).toBeInTheDocument();
    });

    const connectBtn = screen.getByTestId('connect-provider-github');
    await user.click(connectBtn);

    await waitFor(() => {
      expect(lastLinkStartBody).toEqual({ provider: 'github' });
      expect(assignMock).toHaveBeenCalledWith('/oauth2/authorization/github');
    });
  });

  it('disconnect opens ConfirmDialog, cancels without deleting', async () => {
    const user = userEvent.setup();
    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByTestId('disconnect-provider-google')).toBeInTheDocument();
    });

    // Click disconnect button
    await user.click(screen.getByTestId('disconnect-provider-google'));

    // Confirm dialog must appear
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Disconnect Google/i)).toBeInTheDocument();

    // Click cancel in dialog
    await user.click(screen.getByTestId('confirm-dialog-cancel-button'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(lastDisconnectedProvider).toBeNull();
  });

  it('disconnect confirms and handles successful 204 removal', async () => {
    const user = userEvent.setup();
    const toastSpy = vi.spyOn(toast, 'success');

    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByTestId('disconnect-provider-google')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('disconnect-provider-google'));
    await user.click(screen.getByTestId('confirm-dialog-confirm-button'));

    await waitFor(() => {
      expect(lastDisconnectedProvider).toBe('google');
      expect(toastSpy).toHaveBeenCalledWith('Disconnected Google');
    });

    // Row should transition to not connected
    await waitFor(() => {
      expect(screen.getByTestId('connect-provider-google')).toBeInTheDocument();
    });
  });

  it('disconnect handles 409 LAST_LOGIN_METHOD with explanation and prefilled forgot-password link', async () => {
    const user = userEvent.setup();
    disconnectShouldReturn409 = true;
    const toastErrorSpy = vi.spyOn(toast, 'error');

    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByTestId('disconnect-provider-google')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('disconnect-provider-google'));
    await user.click(screen.getByTestId('confirm-dialog-confirm-button'));

    await waitFor(() => {
      expect(lastDisconnectedProvider).toBe('google');
      expect(screen.getByTestId('last-login-method-alert')).toBeInTheDocument();
    });

    const alert = screen.getByTestId('last-login-method-alert');
    expect(alert).toHaveTextContent('Set a password first so you can still sign in');
    expect(toastErrorSpy).toHaveBeenCalledWith('Set a password first so you can still sign in');

    // Link must point to /forgot-password prefilled with user email
    const link = alert.querySelector('a');
    expect(link).toBeInTheDocument();
    expect(link?.getAttribute('href')).toBe('/forgot-password?email=ada%40taskoura.dev');
  });

  it('shows success toast on return with ?linked=<provider> and cleans query string', async () => {
    const toastSpy = vi.spyOn(toast, 'success');
    renderProfilePage(['/app/profile?linked=google']);

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith('Successfully connected Google!');
    });
  });

  it('maps return error codes (?link_error=<CODE>) to friendly messages and cleans query string', async () => {
    const errorCodes = [
      { code: 'ACCESS_DENIED', expected: 'Connection request was cancelled or access was denied.' },
      { code: 'ALREADY_LINKED', expected: 'This provider account is already connected to your profile.' },
      { code: 'IDENTITY_LINKED_TO_OTHER_ACCOUNT', expected: 'This account is already linked to another Taskoura user.' },
      { code: 'PROVIDER_ERROR', expected: 'An error occurred with the authentication provider. Please try again.' },
      { code: 'LINK_EXPIRED', expected: 'The account linking session expired. Please try connecting again.' },
    ];

    for (const { code, expected } of errorCodes) {
      const toastErrorSpy = vi.spyOn(toast, 'error');
      const { unmount } = renderProfilePage([`/app/profile?link_error=${code}`]);

      await waitFor(() => {
        expect(toastErrorSpy).toHaveBeenCalledWith(expected);
      });

      expect(screen.getByTestId('link-error-alert')).toHaveTextContent(expected);
      unmount();
    }
  });

  it('shows note when passwordLoginEnabled is false with prefilled forgot-password link', async () => {
    currentUser.passwordLoginEnabled = false;

    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByTestId('no-password-login-note')).toBeInTheDocument();
    });

    const note = screen.getByTestId('no-password-login-note');
    expect(note).toHaveTextContent('You sign in with Google or GitHub. You can add a password with Forgot password.');

    const link = note.querySelector('a');
    expect(link).toBeInTheDocument();
    expect(link?.getAttribute('href')).toBe('/forgot-password?email=ada%40taskoura.dev');
  });

  it('does not show note when passwordLoginEnabled is true', async () => {
    currentUser.passwordLoginEnabled = true;

    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByTestId('connected-accounts')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('no-password-login-note')).not.toBeInTheDocument();
  });
});
