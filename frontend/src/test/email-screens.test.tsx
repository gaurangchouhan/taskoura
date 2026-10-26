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
import { VerifyEmailPage } from '../pages/VerifyEmailPage';
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage';
import { ProfilePage } from '../features/profile/pages/ProfilePage';
import { TimeZoneProvider } from '../lib/datetime';

let registerCalls = 0;
let verifyCalls = 0;
let resendCalls = 0;
let forgotPasswordCalls = 0;
let resetPasswordCalls = 0;

const server = setupServer(
  http.get('*/api/users/me', () => {
    return HttpResponse.json({
      id: 'usr-1',
      name: 'Test Engineer',
      email: 'engineer@taskoura.dev',
      verified: true,
      createdAt: '2026-01-01T00:00:00Z',
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
      providers: [],
    });
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
        <TimeZoneProvider>
          <MemoryRouter initialEntries={[initialRoute]}>
            <LocationWitness />
            <Routes>
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/login" element={<div>Sign In Screen</div>} />
            </Routes>
          </MemoryRouter>
        </TimeZoneProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('PHASE 6 (frontend): F6 Email Screens & OTP Hardening', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    registerCalls = 0;
    verifyCalls = 0;
    resendCalls = 0;
    forgotPasswordCalls = 0;
    resetPasswordCalls = 0;
  });

  // ---------------------------------------------------------------------------
  // 1. VerifyEmailPage Tests
  // ---------------------------------------------------------------------------
  describe('VerifyEmailPage', () => {
    it('on normal wrong OTP: shows 400 VALIDATION_FAILED message and clears boxes', async () => {
      server.use(
        http.post('*/api/auth/verify-otp', () => {
          verifyCalls++;
          return HttpResponse.json(
            {
              status: 400,
              code: 'VALIDATION_FAILED',
              message: 'Invalid or expired OTP',
            },
            { status: 400 }
          );
        })
      );

      renderWithProviders('/verify-email?email=alice%40example.com');

      const inputs = screen.getAllByRole('textbox');
      expect(inputs).toHaveLength(4);

      // Enter 4 digits
      fireEvent.change(inputs[0], { target: { value: '1' } });
      fireEvent.change(inputs[1], { target: { value: '2' } });
      fireEvent.change(inputs[2], { target: { value: '3' } });
      fireEvent.change(inputs[3], { target: { value: '4' } });

      const verifyBtn = screen.getByRole('button', { name: /verify/i });
      fireEvent.click(verifyBtn);

      await waitFor(() => {
        expect(screen.getByText('Invalid or expired OTP')).toBeInTheDocument();
      });

      // Assert boxes are cleared
      inputs.forEach((input) => {
        expect(input).toHaveValue('');
      });
      expect(screen.getByTestId('current-path')).toHaveTextContent('/verify-email');
    });

    it('on OTP_ATTEMPTS_EXCEEDED: clears boxes, shows message and enables "Request a new code"', async () => {
      server.use(
        http.post('*/api/auth/verify-otp', () => {
          verifyCalls++;
          return HttpResponse.json(
            {
              status: 400,
              code: 'OTP_ATTEMPTS_EXCEEDED',
              message: 'Too many attempts. Request a new code.',
            },
            { status: 400 }
          );
        })
      );

      renderWithProviders('/verify-email?email=alice%40example.com');

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: '9' } });
      fireEvent.change(inputs[1], { target: { value: '9' } });
      fireEvent.change(inputs[2], { target: { value: '9' } });
      fireEvent.change(inputs[3], { target: { value: '9' } });

      const verifyBtn = screen.getByRole('button', { name: /verify/i });
      fireEvent.click(verifyBtn);

      await waitFor(() => {
        expect(screen.getByText('Too many attempts. Request a new code.')).toBeInTheDocument();
      });

      // Boxes cleared
      inputs.forEach((input) => {
        expect(input).toHaveValue('');
      });

      // "Request a new code" is enabled immediately
      const resendBtn = screen.getByRole('button', { name: /request a new code/i });
      expect(resendBtn).toBeEnabled();
    });

    it('on RATE_LIMITED: starts resend countdown from retryAfterSeconds', async () => {
      server.use(
        http.post('*/api/auth/resend-otp', () => {
          resendCalls++;
          return HttpResponse.json(
            {
              status: 429,
              code: 'RATE_LIMITED',
              message: 'Please wait before requesting another code.',
              retryAfterSeconds: 24,
            },
            { status: 429 }
          );
        })
      );

      renderWithProviders('/verify-email?email=alice%40example.com');

      // Click resend when enabled (or simulate it being ready)
      const resendBtn = screen.getByRole('button', { name: /resend code/i });
      // If countdown is active, let's force click or test resend mutation directly
      fireEvent.click(resendBtn);

      // Verify the countdown was initialized or updated with retryAfterSeconds (24)
      await waitFor(() => {
        // If resend was called or cooldown started
        expect(screen.getByRole('button', { name: /resend code in 2/i })).toBeInTheDocument();
      });
    });

    it('on EMAIL_DELIVERY_FAILED: shows message with Retry button and does not navigate', async () => {
      server.use(
        http.post('*/api/auth/verify-otp', () => {
          verifyCalls++;
          return HttpResponse.json(
            {
              status: 502,
              code: 'EMAIL_DELIVERY_FAILED',
              message: 'We could not send the email. Please try again.',
            },
            { status: 502 }
          );
        })
      );

      renderWithProviders('/verify-email?email=alice%40example.com');

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: '1' } });
      fireEvent.change(inputs[1], { target: { value: '2' } });
      fireEvent.change(inputs[2], { target: { value: '3' } });
      fireEvent.change(inputs[3], { target: { value: '4' } });

      const verifyBtn = screen.getByRole('button', { name: /verify/i });
      fireEvent.click(verifyBtn);

      await waitFor(() => {
        expect(screen.getByText('We could not send the email. Please try again.')).toBeInTheDocument();
      });

      const retryBtn = screen.getByTestId('btn-verify-retry');
      expect(retryBtn).toBeInTheDocument();
      expect(screen.getByTestId('current-path')).toHaveTextContent('/verify-email');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. ForgotPasswordPage Tests
  // ---------------------------------------------------------------------------
  describe('ForgotPasswordPage', () => {
    it('successful submit navigates to /reset-password', async () => {
      server.use(
        http.post('*/api/auth/forgot-password', () => {
          forgotPasswordCalls++;
          return HttpResponse.json({ message: 'Reset code sent.' }, { status: 200 });
        })
      );

      renderWithProviders('/forgot-password');

      const emailInput = screen.getByTestId('input-forgot-email');
      fireEvent.change(emailInput, { target: { value: 'bob@example.com' } });

      const submitBtn = screen.getByTestId('btn-forgot-submit');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('current-path')).toHaveTextContent('/reset-password');
        expect(screen.getByTestId('current-search')).toHaveTextContent('email=bob%40example.com');
      });
      expect(forgotPasswordCalls).toBe(1);
    });

    it('on failed request (EMAIL_DELIVERY_FAILED): does NOT navigate, shows message with Retry button', async () => {
      server.use(
        http.post('*/api/auth/forgot-password', () => {
          forgotPasswordCalls++;
          return HttpResponse.json(
            {
              status: 502,
              code: 'EMAIL_DELIVERY_FAILED',
              message: 'We could not send the email. Please try again.',
            },
            { status: 502 }
          );
        })
      );

      renderWithProviders('/forgot-password');

      const emailInput = screen.getByTestId('input-forgot-email');
      fireEvent.change(emailInput, { target: { value: 'bob@example.com' } });

      const submitBtn = screen.getByTestId('btn-forgot-submit');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-error')).toHaveTextContent(
          'We could not send the email. Please try again.'
        );
      });

      // Stays on /forgot-password
      expect(screen.getByTestId('current-path')).toHaveTextContent('/forgot-password');

      // Retry button is present and clickable
      const retryBtn = screen.getByTestId('btn-forgot-retry');
      expect(retryBtn).toBeInTheDocument();

      fireEvent.click(retryBtn);
      await waitFor(() => {
        expect(forgotPasswordCalls).toBe(2);
      });
    });

    it('on RATE_LIMITED: starts resend countdown from retryAfterSeconds and disables submit', async () => {
      server.use(
        http.post('*/api/auth/forgot-password', () => {
          forgotPasswordCalls++;
          return HttpResponse.json(
            {
              status: 429,
              code: 'RATE_LIMITED',
              message: 'Please wait before requesting another code.',
              retryAfterSeconds: 19,
            },
            { status: 429 }
          );
        })
      );

      renderWithProviders('/forgot-password');

      const emailInput = screen.getByTestId('input-forgot-email');
      fireEvent.change(emailInput, { target: { value: 'bob@example.com' } });

      const submitBtn = screen.getByTestId('btn-forgot-submit');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-error')).toHaveTextContent(
          'Please wait before requesting another code.'
        );
      });

      // Submit button reflects countdown and is disabled
      await waitFor(() => {
        expect(screen.getByText(/resend in 1/i)).toBeInTheDocument();
      });
      expect(screen.getByTestId('btn-forgot-submit')).toBeDisabled();
      expect(screen.getByTestId('current-path')).toHaveTextContent('/forgot-password');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. ResetPasswordPage Tests
  // ---------------------------------------------------------------------------
  describe('ResetPasswordPage', () => {
    it('on OTP_ATTEMPTS_EXCEEDED: clears boxes, shows message and enables "Request a new code"', async () => {
      server.use(
        http.post('*/api/auth/reset-password', () => {
          resetPasswordCalls++;
          return HttpResponse.json(
            {
              status: 400,
              code: 'OTP_ATTEMPTS_EXCEEDED',
              message: 'Too many attempts. Request a new code.',
            },
            { status: 400 }
          );
        })
      );

      renderWithProviders('/reset-password?email=carol%40example.com');

      const otpInputs = screen.getAllByRole('textbox').slice(1); // skip email input
      otpInputs.forEach((input, i) => {
        fireEvent.change(input, { target: { value: String(i + 1) } });
      });

      const newPassInput = screen.getByTestId('input-new-password');
      const confirmPassInput = screen.getByTestId('input-confirm-password');
      fireEvent.change(newPassInput, { target: { value: 'NewSecurePass123!' } });
      fireEvent.change(confirmPassInput, { target: { value: 'NewSecurePass123!' } });

      const submitBtn = screen.getByTestId('btn-reset-submit');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('reset-password-error')).toHaveTextContent(
          'Too many attempts. Request a new code.'
        );
      });

      // Boxes cleared
      otpInputs.forEach((input) => {
        expect(input).toHaveValue('');
      });

      // "Request a new code" button enabled
      const resendBtn = screen.getByTestId('btn-resend-code');
      expect(resendBtn).toHaveTextContent('Request a new code');
      expect(resendBtn).toBeEnabled();
    });

    it('on RATE_LIMITED during resend: starts resend countdown from retryAfterSeconds', async () => {
      server.use(
        http.post('*/api/auth/forgot-password', () => {
          forgotPasswordCalls++;
          return HttpResponse.json(
            {
              status: 429,
              code: 'RATE_LIMITED',
              message: 'Please wait before requesting another code.',
              retryAfterSeconds: 27,
            },
            { status: 429 }
          );
        })
      );

      renderWithProviders('/reset-password?email=carol%40example.com');

      const resendBtn = screen.getByTestId('btn-resend-code');
      fireEvent.click(resendBtn);

      await waitFor(() => {
        expect(screen.getByTestId('reset-password-error')).toHaveTextContent(
          'Please wait before requesting another code.'
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('btn-resend-code')).toHaveTextContent(/resend code in 2/i);
      });
      expect(screen.getByTestId('btn-resend-code')).toBeDisabled();
    });

    it('on EMAIL_DELIVERY_FAILED: shows message with Retry button', async () => {
      server.use(
        http.post('*/api/auth/forgot-password', () => {
          forgotPasswordCalls++;
          return HttpResponse.json(
            {
              status: 502,
              code: 'EMAIL_DELIVERY_FAILED',
              message: 'We could not send the email. Please try again.',
            },
            { status: 502 }
          );
        })
      );

      renderWithProviders('/reset-password?email=carol%40example.com');

      const resendBtn = screen.getByTestId('btn-resend-code');
      fireEvent.click(resendBtn);

      await waitFor(() => {
        expect(screen.getByTestId('reset-password-error')).toHaveTextContent(
          'We could not send the email. Please try again.'
        );
      });

      const retryBtn = screen.getByTestId('btn-reset-retry');
      expect(retryBtn).toBeInTheDocument();
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(forgotPasswordCalls).toBe(2);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 4. RegisterPage Tests
  // ---------------------------------------------------------------------------
  describe('RegisterPage', () => {
    it('failed registration does NOT navigate to /verify-email', async () => {
      server.use(
        http.post('*/api/auth/register', () => {
          registerCalls++;
          return HttpResponse.json(
            {
              status: 502,
              code: 'EMAIL_DELIVERY_FAILED',
              message: 'We could not send the email. Please try again.',
            },
            { status: 502 }
          );
        })
      );

      renderWithProviders('/register');

      const nameInput = screen.getByPlaceholderText('Gaurang Chouhan');
      const emailInput = screen.getByPlaceholderText('gaurang@taskoura.dev');
      const passwordInput = screen.getByPlaceholderText('At least 8 characters');

      fireEvent.change(nameInput, { target: { value: 'Dave Dev' } });
      fireEvent.change(emailInput, { target: { value: 'dave@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Password123!' } });

      const submitBtn = screen.getByRole('button', { name: /create account/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('We could not send the email. Please try again.')).toBeInTheDocument();
      });

      // Does not navigate to /verify-email
      expect(screen.getByTestId('current-path')).toHaveTextContent('/register');

      // Retry button is available
      const retryBtn = screen.getByTestId('btn-register-retry');
      expect(retryBtn).toBeInTheDocument();

      fireEvent.click(retryBtn);
      await waitFor(() => {
        expect(registerCalls).toBe(2);
      });
    });

    it('successful registration navigates to /verify-email?email=...', async () => {
      server.use(
        http.post('*/api/auth/register', () => {
          registerCalls++;
          return HttpResponse.json({ message: 'Registered successfully.' }, { status: 201 });
        })
      );

      renderWithProviders('/register');

      const nameInput = screen.getByPlaceholderText('Gaurang Chouhan');
      const emailInput = screen.getByPlaceholderText('gaurang@taskoura.dev');
      const passwordInput = screen.getByPlaceholderText('At least 8 characters');

      fireEvent.change(nameInput, { target: { value: 'Dave Dev' } });
      fireEvent.change(emailInput, { target: { value: 'dave@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Password123!' } });

      const submitBtn = screen.getByRole('button', { name: /create account/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('current-path')).toHaveTextContent('/verify-email');
        expect(screen.getByTestId('current-search')).toHaveTextContent('email=dave%40example.com');
      });
      expect(registerCalls).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. ProfilePage Notification Preferences Note
  // ---------------------------------------------------------------------------
  describe('ProfilePage Notification Preferences Note', () => {
    it('renders the note "Account and security emails are always sent."', async () => {
      renderWithProviders('/profile');

      await waitFor(() => {
        expect(screen.getByText('Account and security emails are always sent.')).toBeInTheDocument();
      });
    });
  });
});
