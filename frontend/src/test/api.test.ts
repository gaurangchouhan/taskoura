import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { apiClient } from '../services/api';
import { setToken, getToken, clearToken } from '../lib/token';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

let capturedLoginAuthHeader: string | null = null;
let capturedProjectsAuthHeader: string | null = null;
let capturedHealthAuthHeader: string | null = null;

const server = setupServer(
  http.post('*/api/auth/login', ({ request }) => {
    capturedLoginAuthHeader = request.headers.get('authorization');
    return HttpResponse.json({ token: 'login-token-123', user: { id: '1', name: 'User', email: 'u@test.com' } });
  }),

  http.get('*/api/health', ({ request }) => {
    capturedHealthAuthHeader = request.headers.get('authorization');
    return HttpResponse.json({ status: 'UP', service: 'taskoura-backend' });
  }),

  http.get('*/api/projects', ({ request }) => {
    capturedProjectsAuthHeader = request.headers.get('authorization');
    return HttpResponse.json([{ id: 'proj-1', name: 'Project 1' }]);
  }),

  http.get('*/api/test-401', () => {
    return HttpResponse.json({ error: 'Unauthorized', message: 'Token invalid' }, { status: 401 });
  }),

  http.get('*/api/test-401-unauthenticated', () => {
    return HttpResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHENTICATED', message: 'Token invalid' },
      { status: 401 }
    );
  }),

  http.get('*/api/test-401-session-expired', () => {
    return HttpResponse.json(
      { error: 'Unauthorized', code: 'SESSION_EXPIRED', message: 'Session has timed out' },
      { status: 401 }
    );
  }),

  http.get('*/api/test-403', () => {
    return HttpResponse.json({ error: 'Forbidden', message: 'Access denied' }, { status: 403 });
  })
);

describe('apiClient interceptors & authentication flow (msw)', () => {
  const originalLocation = window.location;

  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    capturedLoginAuthHeader = null;
    capturedProjectsAuthHeader = null;
    capturedHealthAuthHeader = null;

    // Mock window.location
    delete (window as unknown as Record<string, unknown>).location;
    window.location = {
      href: 'http://localhost:5173/dashboard',
    } as unknown as Location;
  });

  afterEach(() => {
    window.location = originalLocation;
    vi.restoreAllMocks();
  });

  it('attaches Authorization header on protected URLs, but not on /api/auth/login or /api/health', async () => {
    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    const testToken = createJwt({ sub: 'user-1', exp: validFuture });
    setToken(testToken);

    // 1. Calling /api/auth/login should NOT attach Authorization header
    await apiClient.post('/api/auth/login', { email: 'test@example.com', password: 'pass' });
    expect(capturedLoginAuthHeader).toBeNull();

    // 2. Calling /api/health should NOT attach Authorization header
    await apiClient.get('/api/health');
    expect(capturedHealthAuthHeader).toBeNull();

    // 3. Calling protected URL /api/projects SHOULD attach Authorization header
    await apiClient.get('/api/projects');
    expect(capturedProjectsAuthHeader).toBe(`Bearer ${testToken}`);
  });

  it('does NOT attach token to the nine public requests', async () => {
    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    const testToken = createJwt({ sub: 'user-1', exp: validFuture });
    setToken(testToken);

    const publicEndpoints = [
      { method: 'post', url: '/api/auth/register' },
      { method: 'post', url: '/api/auth/verify-otp' },
      { method: 'post', url: '/api/auth/resend-otp' },
      { method: 'post', url: '/api/auth/login' },
      { method: 'post', url: '/api/auth/forgot-password' },
      { method: 'post', url: '/api/auth/reset-password' },
      { method: 'post', url: '/api/auth/oauth/exchange' },
      { method: 'get', url: '/api/auth/oauth/providers' },
      { method: 'get', url: '/api/health' },
    ];

    for (const ep of publicEndpoints) {
      let capturedHeader: string | null = 'not-called';
      server.use(
        ep.method === 'post'
          ? http.post(`*${ep.url}`, ({ request }) => {
              capturedHeader = request.headers.get('authorization');
              return HttpResponse.json({ ok: true });
            })
          : http.get(`*${ep.url}`, ({ request }) => {
              capturedHeader = request.headers.get('authorization');
              return HttpResponse.json({ ok: true });
            })
      );

      if (ep.method === 'post') {
        await apiClient.post(ep.url, {});
      } else {
        await apiClient.get(ep.url);
      }

      expect(capturedHeader, `Header should be null for public request ${ep.method.toUpperCase()} ${ep.url}`).toBeNull();
    }
  });

  it('attaches token to link/start, heartbeat, session and logout', async () => {
    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    const testToken = createJwt({ sub: 'user-1', exp: validFuture });
    setToken(testToken);

    const authenticatedEndpoints = [
      { method: 'post', url: '/api/auth/oauth/link/start' },
      { method: 'post', url: '/api/auth/session/heartbeat' },
      { method: 'get', url: '/api/auth/session' },
      { method: 'post', url: '/api/auth/logout' },
    ];

    for (const ep of authenticatedEndpoints) {
      let capturedHeader: string | null = null;
      server.use(
        ep.method === 'post'
          ? http.post(`*${ep.url}`, ({ request }) => {
              capturedHeader = request.headers.get('authorization');
              return HttpResponse.json({ ok: true });
            })
          : http.get(`*${ep.url}`, ({ request }) => {
              capturedHeader = request.headers.get('authorization');
              return HttpResponse.json({ ok: true });
            })
      );

      if (ep.method === 'post') {
        await apiClient.post(ep.url, {});
      } else {
        await apiClient.get(ep.url);
      }

      expect(capturedHeader, `Header should be Bearer token for ${ep.method.toUpperCase()} ${ep.url}`).toBe(`Bearer ${testToken}`);
    }
  });

  it('a request to an unknown /api/auth/ URL gets the token', async () => {
    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    const testToken = createJwt({ sub: 'user-1', exp: validFuture });
    setToken(testToken);

    let capturedHeader: string | null = null;
    server.use(
      http.post('*/api/auth/custom-action', ({ request }) => {
        capturedHeader = request.headers.get('authorization');
        return HttpResponse.json({ success: true });
      })
    );

    await apiClient.post('/api/auth/custom-action', { some: 'payload' });
    expect(capturedHeader).toBe(`Bearer ${testToken}`);
  });

  it('on 401 response: clears storage and redirects to /login?reason=expired by default', async () => {
    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    const testToken = createJwt({ sub: 'user-1', exp: validFuture });
    setToken(testToken);
    expect(getToken()).toBe(testToken);

    await expect(apiClient.get('/api/test-401')).rejects.toThrow();

    // Verify token was wiped
    expect(getToken()).toBeNull();
    // Verify redirect happened
    expect(window.location.href).toBe('/login?reason=expired');
  });

  it('on 401 response with UNAUTHENTICATED: clears storage and redirects with ?reason=expired', async () => {
    const testToken = createJwt({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 });
    setToken(testToken);

    await expect(apiClient.get('/api/test-401-unauthenticated')).rejects.toThrow();

    expect(getToken()).toBeNull();
    expect(window.location.href).toBe('/login?reason=expired');
  });

  it('on 401 response with SESSION_EXPIRED: clears storage and redirects with ?reason=timeout', async () => {
    const testToken = createJwt({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 });
    setToken(testToken);

    await expect(apiClient.get('/api/test-401-session-expired')).rejects.toThrow();

    expect(getToken()).toBeNull();
    expect(window.location.href).toBe('/login?reason=timeout');
  });

  it('on 403 with a valid token: does not log out and does not redirect', async () => {
    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    const validToken = createJwt({ sub: 'user-valid', exp: validFuture });
    setToken(validToken);

    await expect(apiClient.get('/api/test-403')).rejects.toThrow();

    // Token must STILL be present
    expect(getToken()).toBe(validToken);
    // Location must NOT be changed to login expired
    expect(window.location.href).toBe('http://localhost:5173/dashboard');
  });

  it('on 403 with an expired token: clears storage and redirects to /login?reason=expired', async () => {
    const pastTimestamp = Math.floor(Date.now() / 1000) - 3600;
    const expiredToken = createJwt({ sub: 'user-expired', exp: pastTimestamp });
    setToken(expiredToken);

    await expect(apiClient.get('/api/test-403')).rejects.toThrow();

    // Expired token should be cleared
    expect(getToken()).toBeNull();
    // Redirect to login expired
    expect(window.location.href).toBe('/login?reason=expired');
  });

  it('on 403 when token is missing: clears storage and redirects to /login?reason=expired', async () => {
    clearToken();
    expect(getToken()).toBeNull();

    await expect(apiClient.get('/api/test-403')).rejects.toThrow();

    expect(window.location.href).toBe('/login?reason=expired');
  });
});
