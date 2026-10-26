import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ProtectedRoute } from '../routes/ProtectedRoute';
import { PublicOnlyRoute } from '../routes/PublicOnlyRoute';
import { setToken, getToken, clearToken, setStoredUser, getStoredUser } from '../lib/token';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

const LocationDisplay: React.FC = () => {
  const location = useLocation();
  return (
    <div>
      <span data-testid="pathname">{location.pathname}</span>
      <span data-testid="from-state">
        {(location.state as { from?: { pathname?: string } })?.from?.pathname || 'none'}
      </span>
    </div>
  );
};

const AuthTestConsumer: React.FC = () => {
  const { user, token, isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</span>
      <span data-testid="auth-user">{user?.name || 'no-user'}</span>
      <span data-testid="auth-token">{token || 'no-token'}</span>
      <button
        onClick={() =>
          login({
            token: 'new-valid-token',
            user: { id: 'u1', name: 'Alice', email: 'alice@test.com' },
          })
        }
      >
        Log In
      </button>
      <button onClick={logout}>Log Out</button>
    </div>
  );
};

describe('Route guards & AuthContext', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    queryClient = new QueryClient();
    vi.clearAllMocks();
  });

  it('ProtectedRoute redirects unauthenticated user to /login and preserves location in state', () => {
    clearToken();

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/app/projects']}>
            <Routes>
              <Route path="/login" element={<LocationDisplay />} />
              <Route
                path="/app/projects"
                element={
                  <ProtectedRoute>
                    <div>Secret Dashboard</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.queryByText('Secret Dashboard')).not.toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/login');
    expect(screen.getByTestId('from-state')).toHaveTextContent('/app/projects');
  });

  it('ProtectedRoute allows authenticated user to access protected route', () => {
    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    const token = createJwt({ sub: 'user-1', exp: validFuture });
    setToken(token);
    setStoredUser({ id: 'user-1', name: 'Test User', email: 'test@example.com' });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/app/projects']}>
            <Routes>
              <Route path="/login" element={<div>Login Page</div>} />
              <Route
                path="/app/projects"
                element={
                  <ProtectedRoute>
                    <div>Secret Dashboard</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('Secret Dashboard')).toBeInTheDocument();
  });

  it('PublicOnlyRoute redirects authenticated user to /app/projects', () => {
    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    const token = createJwt({ sub: 'user-1', exp: validFuture });
    setToken(token);
    setStoredUser({ id: 'user-1', name: 'Test User', email: 'test@example.com' });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route
                path="/login"
                element={
                  <PublicOnlyRoute>
                    <div>Public Login Page</div>
                  </PublicOnlyRoute>
                }
              />
              <Route path="/app/projects" element={<div>Projects App</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.queryByText('Public Login Page')).not.toBeInTheDocument();
    expect(screen.getByText('Projects App')).toBeInTheDocument();
  });

  it('treats an expired token as logged out on initialization', () => {
    const past = Math.floor(Date.now() / 1000) - 1000;
    const expiredToken = createJwt({ sub: 'user-expired', exp: past });
    setToken(expiredToken);
    setStoredUser({ id: 'user-expired', name: 'Expired User', email: 'exp@test.com' });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthTestConsumer />
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('auth-user')).toHaveTextContent('no-user');
    expect(screen.getByTestId('auth-token')).toHaveTextContent('no-token');
    expect(getToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  it('logout clears the token, the user and the react-query cache', () => {
    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    const validToken = createJwt({ sub: 'user-1', exp: validFuture });
    setToken(validToken);
    setStoredUser({ id: 'user-1', name: 'User One', email: 'u1@test.com' });

    const queryClearSpy = vi.spyOn(queryClient, 'clear');

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthTestConsumer />
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');

    // Click Log Out
    act(() => {
      screen.getByText('Log Out').click();
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('auth-user')).toHaveTextContent('no-user');
    expect(screen.getByTestId('auth-token')).toHaveTextContent('no-token');
    expect(getToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
    expect(queryClearSpy).toHaveBeenCalled();
  });
});
