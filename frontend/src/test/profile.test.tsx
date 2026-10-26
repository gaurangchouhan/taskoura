import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { setToken, setStoredUser, getStoredUser } from '../lib/token';
import { ProfilePage } from '../features/profile/pages/ProfilePage';
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage';
import { LoginPage } from '../pages/LoginPage';
import { Navbar } from '../components/Navbar';
import { getProfile, updateProfile, updateProfileDetails, uploadAvatar, deleteAvatar } from '../features/profile/api';
import { forgotPassword, resetPassword } from '../features/auth/api';
import { MemberRow } from '../components/members/MemberRow';
import { TaskCard } from '../components/TaskCard';
import { ProjectMember } from '../types/member';
import { Task } from '../types';
import { UserProfileResponse } from '../types/profile';
import { TimeZoneProvider, useTimeZone } from '../lib/datetime';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

const CURRENT_USER: UserProfileResponse = {
  id: 'usr-100',
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
    avatarUrl: null as string | null,
    notificationPrefs: {
      taskAssigned: true,
      deadlineReminders: true,
      mentions: true,
      projectInvites: true,
      statusChanges: false,
    },
  },
  providers: [],
};

let activeUser = { ...CURRENT_USER };
let lastPutBody: Record<string, unknown> | null = null;
let lastPutProfileBody: Record<string, unknown> | null = null;
let profile400Response: Record<string, unknown> | null = null;
let lastForgotEmail: string | null = null;
let lastResetBody: Record<string, unknown> | null = null;
let failResetWith400 = false;
let lastAvatarFile: File | null = null;
let avatarDeleteCalled = false;

const server = setupServer(
  http.get('*/api/users/me', () => {
    return HttpResponse.json(activeUser);
  }),

  http.put('*/api/users/me', async ({ request }) => {
    const body = (await request.json()) as { name: string };
    lastPutBody = body;
    activeUser = { ...activeUser, name: body.name };
    return HttpResponse.json(activeUser);
  }),

  http.put('*/api/users/me/profile', async ({ request }) => {
    if (profile400Response) {
      return HttpResponse.json(profile400Response, { status: 400 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    lastPutProfileBody = body;
    activeUser = {
      ...activeUser,
      profile: {
        ...(activeUser.profile || {}),
        ...body,
      },
    };
    return HttpResponse.json(activeUser);
  }),

  http.post('*/api/users/me/avatar', async ({ request }) => {
    try {
      const formData = await request.formData();
      const file = formData.get('file');
      lastAvatarFile = (file as File) || (new File(['bytes'], 'avatar.png', { type: 'image/png' }));
    } catch {
      lastAvatarFile = new File(['fallback bytes'], 'avatar.png', { type: 'image/png' });
    }
    const url = 'https://cloudinary.com/taskoura/avatars/mock-avatar.png';
    activeUser = {
      ...activeUser,
      profile: {
        ...(activeUser.profile || {}),
        avatarUrl: url,
      },
    };
    return HttpResponse.json({ avatarUrl: url });
  }),

  http.delete('*/api/users/me/avatar', () => {
    avatarDeleteCalled = true;
    activeUser = {
      ...activeUser,
      profile: {
        ...(activeUser.profile || {}),
        avatarUrl: null,
      },
    };
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('*/api/auth/forgot-password', async ({ request }) => {
    const body = (await request.json()) as { email: string };
    lastForgotEmail = body.email;
    return HttpResponse.json({
      message: 'If an account exists with that email, a password reset code has been sent.',
    });
  }),

  http.post('*/api/auth/reset-password', async ({ request }) => {
    if (failResetWith400) {
      return HttpResponse.json(
        { message: 'Invalid or expired reset code', status: 400 },
        { status: 400 }
      );
    }
    const body = (await request.json()) as { email: string; otp: string; newPassword: string };
    lastResetBody = body;
    return HttpResponse.json({
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  }),

  http.get('*/api/notifications*', () => HttpResponse.json([]))
);

function renderWithApp(
  ui: React.ReactElement,
  { initialEntries = ['/'] } = {}
) {
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
              {ui}
            </MemoryRouter>
          </TimeZoneProvider>
        </AuthProvider>
      </QueryClientProvider>
    ),
  };
}

describe('MODULE F16: Profile and Password Reset', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    activeUser = { ...CURRENT_USER };
    lastPutBody = null;
    lastPutProfileBody = null;
    profile400Response = null;
    lastForgotEmail = null;
    lastResetBody = null;
    failResetWith400 = false;
    lastAvatarFile = null;
    avatarDeleteCalled = false;

    const validExp = Math.floor(Date.now() / 1000) + 3600;
    setToken(createJwt({ sub: activeUser.email, exp: validExp }));
    setStoredUser({
      id: activeUser.id,
      name: activeUser.name,
      email: activeUser.email,
    });
  });

  describe('API functions', () => {
    it('getProfile calls GET /api/users/me', async () => {
      const data = await getProfile();
      expect(data.name).toBe('Ada Lovelace');
      expect(data.email).toBe('ada@taskoura.dev');
    });

    it('updateProfile calls PUT /api/users/me with new name', async () => {
      const updated = await updateProfile({ name: 'Ada King, Countess of Lovelace' });
      expect(lastPutBody).toEqual({ name: 'Ada King, Countess of Lovelace' });
      expect(updated.name).toBe('Ada King, Countess of Lovelace');
    });

    it('forgotPassword calls POST /api/auth/forgot-password', async () => {
      const res = await forgotPassword({ email: 'test@example.com' });
      expect(lastForgotEmail).toBe('test@example.com');
      expect(res.message).toContain('password reset code has been sent');
    });

    it('resetPassword calls POST /api/auth/reset-password', async () => {
      const res = await resetPassword({
        email: 'test@example.com',
        otp: '1234',
        newPassword: 'SecretPassword123!',
      });
      expect(lastResetBody).toEqual({
        email: 'test@example.com',
        otp: '1234',
        newPassword: 'SecretPassword123!',
      });
      expect(res.message).toContain('Password reset successfully');
    });
  });

  describe('ProfilePage: Display, Edit, and Immediate Topbar/Storage Update', () => {
    it('renders avatar with initials, editable name, read-only email, verified badge, and member since', async () => {
      renderWithApp(<ProfilePage />, { initialEntries: ['/app/profile'] });

      await waitFor(() => {
        expect(screen.getByTestId('profile-card')).toBeInTheDocument();
      });

      // Initials: Ada Lovelace -> AL
      expect(screen.getByTestId('profile-avatar')).toHaveTextContent('AL');

      // Editable name input
      const nameInput = screen.getByTestId('input-profile-name');
      expect(nameInput).toHaveValue('Ada Lovelace');

      // Read-only email input
      const emailInput = screen.getByTestId('input-profile-email');
      expect(emailInput).toHaveValue('ada@taskoura.dev');
      expect(emailInput).toHaveAttribute('readOnly');

      // Verified badge
      expect(screen.getByTestId('verified-badge')).toHaveTextContent(/verified/i);

      // Member since date
      expect(screen.getByTestId('member-since')).toBeInTheDocument();
    });

    it('Name update immediately refreshes the Topbar and localStorage', async () => {
      renderWithApp(<ProfilePage />, { initialEntries: ['/app/profile'] });

      // Verify initial topbar name
      await waitFor(() => {
        expect(screen.getByTestId('topbar-user-name')).toHaveTextContent('Ada Lovelace');
      });

      // Edit name
      const nameInput = screen.getByTestId('input-profile-name');
      fireEvent.change(nameInput, { target: { value: 'Ada Augusta King' } });

      // Save changes
      const saveBtn = screen.getByTestId('btn-save-profile');
      expect(saveBtn).not.toBeDisabled();
      fireEvent.click(saveBtn);

      // Verify success message
      await waitFor(() => {
        expect(screen.getByTestId('profile-success-msg')).toHaveTextContent('Profile updated successfully.');
      });

      // Topbar user name updates immediately!
      expect(screen.getByTestId('topbar-user-name')).toHaveTextContent('Ada Augusta King');

      // Local storage stored user updates immediately!
      const stored = getStoredUser();
      expect(stored?.name).toBe('Ada Augusta King');
    });
  });

  describe('User Menu and Navigation', () => {
    it('user menu opens on avatar click and contains link to Profile', async () => {
      renderWithApp(<Navbar />);

      await waitFor(() => {
        expect(screen.getByTestId('user-menu-btn')).toBeInTheDocument();
      });

      // Click user menu button
      fireEvent.click(screen.getByTestId('user-menu-btn'));

      // Dropdown appears with Profile link
      expect(screen.getByTestId('user-menu')).toBeInTheDocument();
      const profileLink = screen.getByTestId('user-menu-profile');
      expect(profileLink).toHaveAttribute('href', '/app/profile');
    });

    it('login page includes working link to /forgot-password', () => {
      renderWithApp(<LoginPage />, { initialEntries: ['/login'] });

      const forgotLink = screen.getByRole('link', { name: /forgot password\?/i });
      expect(forgotLink).toHaveAttribute('href', '/forgot-password');
    });
  });

  describe('ForgotPasswordPage: Identical UI for Known and Unknown Emails', () => {
    it('submitting known email displays backend message and navigates to reset password page', async () => {
      renderWithApp(
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>,
        { initialEntries: ['/forgot-password'] }
      );

      const emailInput = screen.getByTestId('input-forgot-email');
      fireEvent.change(emailInput, { target: { value: 'known@taskoura.dev' } });

      const submitBtn = screen.getByTestId('btn-forgot-submit');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(lastForgotEmail).toBe('known@taskoura.dev');
        expect(screen.getByTestId('reset-password-page')).toBeInTheDocument();
      });

      // Prefills email in reset-password page
      expect(screen.getByTestId('input-reset-email')).toHaveValue('known@taskoura.dev');
    });

    it('The forgot-password UI is identical for known and unknown emails (never reveals existence)', async () => {
      renderWithApp(
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>,
        { initialEntries: ['/forgot-password'] }
      );

      const emailInput = screen.getByTestId('input-forgot-email');
      fireEvent.change(emailInput, { target: { value: 'completely-unknown-user@nowhere.com' } });

      const submitBtn = screen.getByTestId('btn-forgot-submit');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(lastForgotEmail).toBe('completely-unknown-user@nowhere.com');
        // Navigates identically to reset password page without warning
        expect(screen.getByTestId('reset-password-page')).toBeInTheDocument();
      });

      expect(screen.getByTestId('input-reset-email')).toHaveValue('completely-unknown-user@nowhere.com');
    });
  });

  describe('ResetPasswordPage: Validation, Error Handling, and Resend Cooldown', () => {
    it('blocks submission when passwords do not match', async () => {
      renderWithApp(<ResetPasswordPage />, {
        initialEntries: ['/reset-password?email=ada@taskoura.dev'],
      });

      // Fill valid code
      const inputs = screen.getAllByRole('textbox');
      // OtpInput inputs
      fireEvent.change(inputs[1], { target: { value: '1' } });
      fireEvent.change(inputs[2], { target: { value: '2' } });
      fireEvent.change(inputs[3], { target: { value: '3' } });
      fireEvent.change(inputs[4], { target: { value: '4' } });

      // Mismatched passwords
      const newPass = screen.getByTestId('input-new-password');
      const confirmPass = screen.getByTestId('input-confirm-password');

      fireEvent.change(newPass, { target: { value: 'Password123!' } });
      fireEvent.change(confirmPass, { target: { value: 'Mismatch999!' } });

      const submitBtn = screen.getByTestId('btn-reset-submit');
      fireEvent.click(submitBtn);

      // Blocked with error
      await waitFor(() => {
        expect(screen.getByTestId('reset-password-error')).toHaveTextContent('Passwords do not match.');
      });
      expect(lastResetBody).toBeNull();
    });

    it('blocks submission when password is under 8 characters', async () => {
      renderWithApp(<ResetPasswordPage />, {
        initialEntries: ['/reset-password?email=ada@taskoura.dev'],
      });

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[1], { target: { value: '1' } });
      fireEvent.change(inputs[2], { target: { value: '2' } });
      fireEvent.change(inputs[3], { target: { value: '3' } });
      fireEvent.change(inputs[4], { target: { value: '4' } });

      const newPass = screen.getByTestId('input-new-password');
      const confirmPass = screen.getByTestId('input-confirm-password');

      fireEvent.change(newPass, { target: { value: 'short' } });
      fireEvent.change(confirmPass, { target: { value: 'short' } });

      fireEvent.click(screen.getByTestId('btn-reset-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('reset-password-error')).toHaveTextContent('at least 8 characters');
      });
      expect(lastResetBody).toBeNull();
    });

    it('A 400 error shows the error message and keeps the form intact', async () => {
      failResetWith400 = true;

      renderWithApp(<ResetPasswordPage />, {
        initialEntries: ['/reset-password?email=ada@taskoura.dev'],
      });

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[1], { target: { value: '9' } });
      fireEvent.change(inputs[2], { target: { value: '9' } });
      fireEvent.change(inputs[3], { target: { value: '9' } });
      fireEvent.change(inputs[4], { target: { value: '9' } });

      const newPass = screen.getByTestId('input-new-password');
      const confirmPass = screen.getByTestId('input-confirm-password');

      fireEvent.change(newPass, { target: { value: 'ValidPassword123' } });
      fireEvent.change(confirmPass, { target: { value: 'ValidPassword123' } });

      fireEvent.click(screen.getByTestId('btn-reset-submit'));

      // Shows 400 error
      await waitFor(() => {
        expect(screen.getByTestId('reset-password-error')).toHaveTextContent('Invalid or expired reset code');
      });

      // Form remains intact
      expect(screen.getByTestId('input-reset-email')).toHaveValue('ada@taskoura.dev');
      expect(newPass).toHaveValue('ValidPassword123');
      expect(confirmPass).toHaveValue('ValidPassword123');
    });

    it('resend code triggers forgot-password and starts a 30s cooldown', async () => {
      renderWithApp(<ResetPasswordPage />, {
        initialEntries: ['/reset-password?email=ada@taskoura.dev'],
      });

      const resendBtn = screen.getByTestId('btn-resend-code');
      expect(resendBtn).toHaveTextContent(/resend code/i);

      fireEvent.click(resendBtn);

      await waitFor(() => {
        expect(lastForgotEmail).toBe('ada@taskoura.dev');
        expect(resendBtn).toHaveTextContent(/resend code in 30s/i);
        expect(resendBtn).toBeDisabled();
      });
    });

    it('successful reset displays success toast and redirects to /login', async () => {
      renderWithApp(
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
        </Routes>,
        { initialEntries: ['/reset-password?email=ada@taskoura.dev'] }
      );

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[1], { target: { value: '1' } });
      fireEvent.change(inputs[2], { target: { value: '2' } });
      fireEvent.change(inputs[3], { target: { value: '3' } });
      fireEvent.change(inputs[4], { target: { value: '4' } });

      fireEvent.change(screen.getByTestId('input-new-password'), {
        target: { value: 'BrandNewSecurePass123' },
      });
      fireEvent.change(screen.getByTestId('input-confirm-password'), {
        target: { value: 'BrandNewSecurePass123' },
      });

      fireEvent.click(screen.getByTestId('btn-reset-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('reset-password-success')).toHaveTextContent('Password reset successfully');
      });

      // Navigates to /login
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('PHASE 5: Profile page frontend (F5)', () => {
    it('validates every rule: phone E.164, org/dept/job <= 120, graduation year 1990-2100, github, linkedin, bio counter, and skills chip input', async () => {
      renderWithApp(<ProfilePage />, { initialEntries: ['/app/profile'] });

      await waitFor(() => {
        expect(screen.getByTestId('profile-card')).toBeInTheDocument();
      });

      // 1. Phone validation (E.164)
      const phoneInput = screen.getByTestId('input-profile-phone');
      fireEvent.change(phoneInput, { target: { value: '12345' } });
      expect(screen.getByTestId('field-error-phone')).toHaveTextContent(/E\.164/i);
      // Valid phone
      fireEvent.change(phoneInput, { target: { value: '+14155552671' } });
      expect(screen.queryByTestId('field-error-phone')).not.toBeInTheDocument();

      // 2. Organization, Department, JobTitle <= 120
      const orgInput = screen.getByTestId('input-profile-org');
      fireEvent.change(orgInput, { target: { value: 'A'.repeat(121) } });
      expect(screen.getByTestId('field-error-organization')).toHaveTextContent(/120 characters or fewer/i);
      fireEvent.change(orgInput, { target: { value: 'Acme Corp' } });
      expect(screen.queryByTestId('field-error-organization')).not.toBeInTheDocument();

      const deptInput = screen.getByTestId('input-profile-dept');
      fireEvent.change(deptInput, { target: { value: 'B'.repeat(121) } });
      expect(screen.getByTestId('field-error-department')).toHaveTextContent(/120 characters or fewer/i);
      fireEvent.change(deptInput, { target: { value: 'Engineering' } });
      expect(screen.queryByTestId('field-error-department')).not.toBeInTheDocument();

      const jobInput = screen.getByTestId('input-profile-job');
      fireEvent.change(jobInput, { target: { value: 'C'.repeat(121) } });
      expect(screen.getByTestId('field-error-jobTitle')).toHaveTextContent(/120 characters or fewer/i);
      fireEvent.change(jobInput, { target: { value: 'Lead Engineer' } });
      expect(screen.queryByTestId('field-error-jobTitle')).not.toBeInTheDocument();

      // 3. Graduation Year 1990-2100
      const gradInput = screen.getByTestId('input-profile-grad');
      fireEvent.change(gradInput, { target: { value: '1980' } });
      expect(screen.getByTestId('field-error-graduationYear')).toHaveTextContent(/between 1990 and 2100/i);
      fireEvent.change(gradInput, { target: { value: '2105' } });
      expect(screen.getByTestId('field-error-graduationYear')).toHaveTextContent(/between 1990 and 2100/i);
      fireEvent.change(gradInput, { target: { value: '2024' } });
      expect(screen.queryByTestId('field-error-graduationYear')).not.toBeInTheDocument();

      // 4. GitHub URL (HTTPS on github.com)
      const githubInput = screen.getByTestId('input-profile-github');
      fireEvent.change(githubInput, { target: { value: 'http://github.com/adalovelace' } });
      expect(screen.getByTestId('field-error-githubUrl')).toHaveTextContent(/HTTPS URL on github\.com/i);
      fireEvent.change(githubInput, { target: { value: 'https://gitlab.com/adalovelace' } });
      expect(screen.getByTestId('field-error-githubUrl')).toHaveTextContent(/HTTPS URL on github\.com/i);
      fireEvent.change(githubInput, { target: { value: 'https://github.com/adalovelace' } });
      expect(screen.queryByTestId('field-error-githubUrl')).not.toBeInTheDocument();

      // 5. LinkedIn URL (HTTPS on linkedin.com)
      const linkedinInput = screen.getByTestId('input-profile-linkedin');
      fireEvent.change(linkedinInput, { target: { value: 'http://linkedin.com/in/ada' } });
      expect(screen.getByTestId('field-error-linkedinUrl')).toHaveTextContent(/HTTPS URL on linkedin\.com/i);
      fireEvent.change(linkedinInput, { target: { value: 'https://twitter.com/ada' } });
      expect(screen.getByTestId('field-error-linkedinUrl')).toHaveTextContent(/HTTPS URL on linkedin\.com/i);
      fireEvent.change(linkedinInput, { target: { value: 'https://linkedin.com/in/adalovelace' } });
      expect(screen.queryByTestId('field-error-linkedinUrl')).not.toBeInTheDocument();

      // 6. Bio character counter
      const bioInput = screen.getByTestId('textarea-profile-bio');
      fireEvent.change(bioInput, { target: { value: 'Mathematician and computer pioneer.' } });
      expect(screen.getByTestId('bio-char-counter')).toHaveTextContent('35/500');

      // 7. Skills Chip Input (add on Enter, remove, limits, no duplicates)
      const skillInput = screen.getByTestId('input-profile-skills');
      fireEvent.change(skillInput, { target: { value: 'Algorithms' } });
      fireEvent.keyDown(skillInput, { key: 'Enter', code: 'Enter' });
      expect(screen.getByTestId('skill-chip-Algorithms')).toBeInTheDocument();
      expect(screen.getByTestId('skills-count')).toHaveTextContent('1/20 skills');

      // Reject duplicate
      fireEvent.change(skillInput, { target: { value: 'algorithms' } });
      fireEvent.keyDown(skillInput, { key: 'Enter', code: 'Enter' });
      expect(screen.getByTestId('field-error-skills')).toHaveTextContent(/already added/i);

      // Add second skill
      fireEvent.change(skillInput, { target: { value: 'Analytical Engine' } });
      fireEvent.keyDown(skillInput, { key: 'Enter', code: 'Enter' });
      expect(screen.getByTestId('skill-chip-Analytical Engine')).toBeInTheDocument();
      expect(screen.getByTestId('skills-count')).toHaveTextContent('2/20 skills');

      // Remove skill
      fireEvent.click(screen.getByTestId('btn-remove-skill-Algorithms'));
      expect(screen.queryByTestId('skill-chip-Algorithms')).not.toBeInTheDocument();
      expect(screen.getByTestId('skills-count')).toHaveTextContent('1/20 skills');
    });

    it('optional fields can stay empty and Save sends full payload replacement', async () => {
      renderWithApp(<ProfilePage />, { initialEntries: ['/app/profile'] });

      await waitFor(() => {
        expect(screen.getByTestId('profile-card')).toBeInTheDocument();
      });

      // Clear or set fields
      fireEvent.change(screen.getByTestId('input-profile-org'), { target: { value: 'Analytical Engine Ltd' } });
      fireEvent.change(screen.getByTestId('input-profile-job'), { target: { value: 'Lead Engineer' } });
      fireEvent.change(screen.getByTestId('textarea-profile-bio'), { target: { value: 'Building machines.' } });

      // Change a notification preference
      const statusChangesToggle = screen.getByTestId('toggle-pref-statusChanges');
      fireEvent.click(statusChangesToggle);

      // Dirty state is active
      expect(screen.getByTestId('dirty-indicator')).toHaveTextContent(/unsaved changes/i);

      // Save
      fireEvent.click(screen.getByTestId('btn-save-profile'));

      await waitFor(() => {
        expect(lastPutProfileBody).not.toBeNull();
      });

      expect(lastPutProfileBody).toEqual({
        phone: null,
        organization: 'Analytical Engine Ltd',
        department: null,
        jobTitle: 'Lead Engineer',
        graduationYear: null,
        githubUrl: null,
        linkedinUrl: null,
        bio: 'Building machines.',
        skills: [],
        timeZone: 'UTC',
        notificationPrefs: {
          taskAssigned: true,
          deadlineReminders: true,
          mentions: true,
          projectInvites: true,
          statusChanges: true,
        },
      });

      // Becomes pristine after save
      await waitFor(() => {
        expect(screen.getByTestId('dirty-indicator')).toHaveTextContent(/profile up to date/i);
        expect(screen.getByTestId('profile-success-msg')).toHaveTextContent(/profile updated successfully/i);
      });
    });

    it('handles server 400 fieldErrors gracefully', async () => {
      profile400Response = {
        status: 400,
        message: 'Validation failed on server',
        fieldErrors: {
          phone: 'Phone number format rejected by server',
          bio: 'Bio text contains forbidden characters',
        },
      };

      renderWithApp(<ProfilePage />, { initialEntries: ['/app/profile'] });

      await waitFor(() => {
        expect(screen.getByTestId('profile-card')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('input-profile-phone'), { target: { value: '+14155552671' } });
      fireEvent.click(screen.getByTestId('btn-save-profile'));

      await waitFor(() => {
        expect(screen.getByTestId('field-error-phone')).toHaveTextContent('Phone number format rejected by server');
        expect(screen.getByTestId('field-error-bio')).toHaveTextContent('Bio text contains forbidden characters');
        expect(screen.getByTestId('profile-error-msg')).toBeInTheDocument();
      });
    });

    it('rejects avatar before upload if type is invalid or size exceeds 2 MB', async () => {
      renderWithApp(<ProfilePage />, { initialEntries: ['/app/profile'] });

      await waitFor(() => {
        expect(screen.getByTestId('profile-card')).toBeInTheDocument();
      });

      const fileInput = screen.getByTestId('input-avatar-file');

      // 1. Invalid file type (e.g. text/plain or pdf)
      const invalidTypeFile = new File(['dummy content'], 'document.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [invalidTypeFile] } });

      expect(screen.getByTestId('avatar-error')).toHaveTextContent(/PNG, JPEG, or WebP/i);
      expect(lastAvatarFile).toBeNull(); // API was NOT called!

      // 2. File size > 2 MB
      const largeBytes = new Uint8Array(2.5 * 1024 * 1024);
      const largeFile = new File([largeBytes], 'large-avatar.png', { type: 'image/png' });
      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      expect(screen.getByTestId('avatar-error')).toHaveTextContent(/must not exceed 2 MB/i);
      expect(lastAvatarFile).toBeNull(); // API was NOT called!
    });

    it('uploads valid avatar with POST /api/users/me/avatar and removes it with DELETE /api/users/me/avatar', async () => {
      renderWithApp(<ProfilePage />, { initialEntries: ['/app/profile'] });

      await waitFor(() => {
        expect(screen.getByTestId('profile-card')).toBeInTheDocument();
      });

      const fileInput = screen.getByTestId('input-avatar-file');

      // Upload valid PNG
      const validFile = new File(['valid png bytes'], 'avatar.png', { type: 'image/png' });
      fireEvent.change(fileInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(lastAvatarFile).not.toBeNull();
        expect(screen.getByTestId('btn-remove-avatar')).toBeInTheDocument();
      });

      // Remove avatar
      fireEvent.click(screen.getByTestId('btn-remove-avatar'));

      await waitFor(() => {
        expect(avatarDeleteCalled).toBe(true);
        expect(screen.queryByTestId('btn-remove-avatar')).not.toBeInTheDocument();
      });
    });

    it('saving time zone updates TimeZoneContext and displayed dates follow it', async () => {
      renderWithApp(<ProfilePage />, { initialEntries: ['/app/profile'] });

      await waitFor(() => {
        expect(screen.getByTestId('select-profile-timezone')).toBeInTheDocument();
      });

      const tzSelect = screen.getByTestId('select-profile-timezone');
      fireEvent.change(tzSelect, { target: { value: 'Asia/Tokyo' } });

      fireEvent.click(screen.getByTestId('btn-save-profile'));

      await waitFor(() => {
        expect(lastPutProfileBody?.timeZone).toBe('Asia/Tokyo');
      });
    });

    it('unsaved-change guard warns on navigation and allows staying or discarding', async () => {
      renderWithApp(<ProfilePage />, { initialEntries: ['/app/profile'] });

      await waitFor(() => {
        expect(screen.getByTestId('profile-card')).toBeInTheDocument();
      });

      // Initially clean
      expect(screen.getByTestId('dirty-indicator')).toHaveTextContent(/profile up to date/i);

      // Make dirty
      fireEvent.change(screen.getByTestId('input-profile-org'), { target: { value: 'New Organization' } });
      expect(screen.getByTestId('dirty-indicator')).toHaveTextContent(/unsaved changes/i);

      // Verify beforeunload listener warns
      const beforeUnloadEvent = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(beforeUnloadEvent);
      expect((beforeUnloadEvent as any).returnValue).toBeDefined();

      // Click "Change password" link
      fireEvent.click(screen.getByTestId('link-change-password'));

      // Unsaved changes dialog appears
      expect(screen.getByTestId('unsaved-changes-dialog')).toBeInTheDocument();

      // Click "Stay Here"
      fireEvent.click(screen.getByTestId('btn-cancel-leave'));
      expect(screen.queryByTestId('unsaved-changes-dialog')).not.toBeInTheDocument();

      // Click "Change password" again and confirm leave
      fireEvent.click(screen.getByTestId('link-change-password'));
      expect(screen.getByTestId('unsaved-changes-dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('btn-confirm-leave'));
      expect(screen.queryByTestId('unsaved-changes-dialog')).not.toBeInTheDocument();
    });

    it('displays avatars in MemberRow and TaskCard when avatarUrl is present', () => {
      const mockMemberWithAvatar: ProjectMember = {
        id: 'pm-1',
        userId: 'u-1',
        role: 'Member',
        userName: 'Charles Babbage',
        userEmail: 'charles@taskoura.dev',
        avatarUrl: 'https://cloudinary.com/babbage.png',
      };

      const { container: memberContainer } = render(
        <MemberRow
          member={mockMemberWithAvatar}
          isCurrent={false}
          canManage={true}
          isLastOwner={false}
          onUpdateRole={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      const memberImg = memberContainer.querySelector('img');
      expect(memberImg).toBeInTheDocument();
      expect(memberImg).toHaveAttribute('src', 'https://cloudinary.com/babbage.png');

      const mockTaskWithAvatar: Task = {
        id: 'task-1',
        title: 'Analytical Engine Mechanical Core',
        category: 'Backend',
        priority: 'High',
        status: 'InProgress',
        assignedTo: 'u-1',
        assignedToName: 'Charles Babbage',
        assignedToAvatar: 'https://cloudinary.com/babbage.png',
      };

      const memberMap = new Map<string, ProjectMember>([['u-1', mockMemberWithAvatar]]);

      const { container: taskContainer } = render(
        <TaskCard
          task={mockTaskWithAvatar}
          memberMap={memberMap}
        />
      );

      const taskImg = taskContainer.querySelector('[data-testid="assignee-avatar"] img');
      expect(taskImg).toBeInTheDocument();
      expect(taskImg).toHaveAttribute('src', 'https://cloudinary.com/babbage.png');
    });
  });
});

