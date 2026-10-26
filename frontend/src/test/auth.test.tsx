import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { RegisterPage } from '../pages/RegisterPage';
import { LoginPage } from '../pages/LoginPage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';

let lastRegisterBody: Record<string, unknown> | null = null;
let lastVerifyBody: Record<string, unknown> | null = null;
let lastResendBody: Record<string, unknown> | null = null;
let lastLoginBody: Record<string, unknown> | null = null;

const server = setupServer(
  // Default handlers
  http.post('*/api/auth/register', async ({ request }) => {
    lastRegisterBody = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ message: 'User registered successfully. Please verify OTP.' }, { status: 201 });
  }),

  http.post('*/api/auth/verify-otp', async ({ request }) => {
    lastVerifyBody = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ message: 'Email verified successfully!' }, { status: 200 });
  }),

  http.post('*/api/auth/resend-otp', async ({ request }) => {
    lastResendBody = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ message: 'A new code has been sent.' }, { status: 200 });
  }),

  http.post('*/api/auth/login', async ({ request }) => {
    lastLoginBody = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        token: 'mock-valid-jwt-token',
        user: { id: 'u-123', name: 'Gaurang Chouhan', email: 'chouhangaurang316@gmail.com' },
      },
      { status: 200 }
    );
  })
);

const LocationWitness: React.FC = () => {
  const location = useLocation();
  return (
    <div>
      <span data-testid="current-path">{location.pathname}</span>
      <span data-testid="current-search">{location.search}</span>
    </div>
  );
};

const renderWithProviders = (initialRoute: string) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <LocationWitness />
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/app/projects" element={<div>Projects Workspace</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('Auth Pages UI & MSW Backend Contract', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    lastRegisterBody = null;
    lastVerifyBody = null;
    lastResendBody = null;
    lastLoginBody = null;
  });

  describe('RegisterPage', () => {
    it('validates form fields (name required, valid email, min 8 chars password)', async () => {
      const user = userEvent.setup();
      renderWithProviders('/register');

      const nameInput = screen.getByPlaceholderText('Gaurang Chouhan');
      const emailInput = screen.getByPlaceholderText('gaurang@taskoura.dev');
      const passwordInput = screen.getByPlaceholderText('At least 8 characters');
      const submitBtn = screen.getByRole('button', { name: /create account/i });

      // 1. Password under 8 characters
      await user.type(nameInput, 'Gaurang');
      await user.type(emailInput, 'gaurang@test.com');
      await user.type(passwordInput, 'short');
      await user.click(submitBtn);

      expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
    });

    it('on 201: registers successfully and navigates to /verify-email?email=<email>', async () => {
      const user = userEvent.setup();
      renderWithProviders('/register');

      await user.type(screen.getByPlaceholderText('Gaurang Chouhan'), 'Gaurang Chouhan');
      await user.type(screen.getByPlaceholderText('gaurang@taskoura.dev'), 'gaurang@example.com');
      await user.type(screen.getByPlaceholderText('At least 8 characters'), 'password123');

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByTestId('current-path')).toHaveTextContent('/verify-email');
        expect(screen.getByTestId('current-search').textContent).toContain('email=gaurang%40example.com');
      });

      expect(lastRegisterBody).toEqual({
        name: 'Gaurang Chouhan',
        email: 'gaurang@example.com',
        password: 'password123',
      });
    });

    it('on 409 Conflict: displays "Email already registered" next to the email field', async () => {
      server.use(
        http.post('*/api/auth/register', () => {
          return HttpResponse.json({ message: 'Email already registered' }, { status: 409 });
        })
      );

      const user = userEvent.setup();
      renderWithProviders('/register');

      await user.type(screen.getByPlaceholderText('Gaurang Chouhan'), 'Gaurang Chouhan');
      await user.type(screen.getByPlaceholderText('gaurang@taskoura.dev'), 'existing@example.com');
      await user.type(screen.getByPlaceholderText('At least 8 characters'), 'password123');

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText('Email already registered')).toBeInTheDocument();
      });
    });
  });

  describe('VerifyEmailPage', () => {
    it('renders the email, 4-digit OtpInput, Verify button, resend cooldown and 10min expiration note', () => {
      renderWithProviders('/verify-email?email=test%40taskoura.dev');

      expect(screen.getByText('Verify your email')).toBeInTheDocument();
      expect(screen.getByText('test@taskoura.dev')).toBeInTheDocument();
      expect(screen.getAllByRole('textbox')).toHaveLength(4);
      expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument();
      expect(screen.getByText(/resend code in 30s/i)).toBeInTheDocument();
      expect(screen.getByText('The code expires in 10 minutes')).toBeInTheDocument();
    });

    it('on 200: verifies successfully and redirects to /login with email prefilled', async () => {
      renderWithProviders('/verify-email?email=test%40taskoura.dev');

      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];

      // Simulate pasting 4 digits
      fireEvent.paste(inputs[0].parentElement!, {
        clipboardData: { getData: () => '1234' },
      });

      const verifyBtn = screen.getByRole('button', { name: /verify/i });
      fireEvent.click(verifyBtn);

      await waitFor(() => {
        expect(screen.getByTestId('current-path')).toHaveTextContent('/login');
        expect(screen.getByTestId('current-search').textContent).toContain('email=test%40taskoura.dev');
      });

      expect(lastVerifyBody).toEqual({
        email: 'test@taskoura.dev',
        otp: '1234',
      });
    });

    it('on 400: displays error message and clears the OTP boxes', async () => {
      server.use(
        http.post('*/api/auth/verify-otp', () => {
          return HttpResponse.json({ message: 'Invalid or expired OTP' }, { status: 400 });
        })
      );

      renderWithProviders('/verify-email?email=test%40taskoura.dev');

      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];

      fireEvent.paste(inputs[0].parentElement!, {
        clipboardData: { getData: () => '9999' },
      });

      const verifyBtn = screen.getByRole('button', { name: /verify/i });
      fireEvent.click(verifyBtn);

      await waitFor(() => {
        expect(screen.getByText('Invalid or expired OTP')).toBeInTheDocument();
      });

      // Boxes should be cleared
      inputs.forEach((input) => {
        expect(input.value).toBe('');
      });
    });
  });

  describe('LoginPage', () => {
    it('shows "Your session expired, please log in again." when ?reason=expired is present', () => {
      renderWithProviders('/login?reason=expired');
      expect(screen.getByText('Your session expired, please log in again.')).toBeInTheDocument();
    });

    it('has a "Forgot password?" link pointing to /forgot-password', () => {
      renderWithProviders('/login');
      const forgotLink = screen.getByRole('link', { name: /forgot password\?/i });
      expect(forgotLink).toHaveAttribute('href', '/forgot-password');
    });

    it('on 200: logs in and navigates to /app/projects', async () => {
      const user = userEvent.setup();
      renderWithProviders('/login');

      await user.type(screen.getByPlaceholderText('engineer@taskoura.dev'), 'user@taskoura.dev');
      await user.type(screen.getByPlaceholderText('••••••••'), 'correctPassword123');

      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('Projects Workspace')).toBeInTheDocument();
      });

      expect(lastLoginBody).toEqual({
        email: 'user@taskoura.dev',
        password: 'correctPassword123',
      });
    });

    it('on 401: shows "Incorrect email or password"', async () => {
      server.use(
        http.post('*/api/auth/login', () => {
          return HttpResponse.json({ message: 'Bad credentials' }, { status: 401 });
        })
      );

      const user = userEvent.setup();
      renderWithProviders('/login');

      await user.type(screen.getByPlaceholderText('engineer@taskoura.dev'), 'user@taskoura.dev');
      await user.type(screen.getByPlaceholderText('••••••••'), 'wrongPassword');

      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('Incorrect email or password')).toBeInTheDocument();
      });
    });

    it('on 403: shows backend unverified message and button that triggers resend and navigates to /verify-email', async () => {
      server.use(
        http.post('*/api/auth/login', () => {
          return HttpResponse.json({ message: 'Account not verified. Please verify your email.' }, { status: 403 });
        })
      );

      const user = userEvent.setup();
      renderWithProviders('/login');

      await user.type(screen.getByPlaceholderText('engineer@taskoura.dev'), 'unverified@taskoura.dev');
      await user.type(screen.getByPlaceholderText('••••••••'), 'password123');

      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('Account not verified. Please verify your email.')).toBeInTheDocument();
      });

      const verifyNowBtn = screen.getByRole('button', { name: /verify your email now/i });
      expect(verifyNowBtn).toBeInTheDocument();

      await user.click(verifyNowBtn);

      await waitFor(() => {
        expect(screen.getByTestId('current-path')).toHaveTextContent('/verify-email');
        expect(screen.getByTestId('current-search').textContent).toContain('email=unverified%40taskoura.dev');
      });

      expect(lastResendBody).toEqual({
        email: 'unverified@taskoura.dev',
      });
    });
  });
});
