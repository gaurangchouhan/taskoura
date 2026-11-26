import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { setToken, clearToken } from '../lib/token';
import { BioLockDeviceCard } from '../features/profile/components/BioLockDeviceCard';
import { CreateProjectModal } from '../components/projects/CreateProjectModal';
import { DeleteProjectModal } from '../components/projects/DeleteProjectModal';
import { AttachmentItem } from '../features/attachments/components/AttachmentItem';
import { Project } from '../types/project';
import { Attachment } from '../types';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

describe('MODULE BL-5: Frontend Taskoura BioLock', () => {
  let biolockEnabled = true;
  let mockDevice: { id: string; name: string; online: boolean } | null = null;
  let mockCredential: { id: string; status: 'ACTIVE'; slot: number } | null = null;
  let enrollmentJobStatus = 'QUEUED';
  let enrollmentJobOutcome = '';
  let accessRequestCallCount = 0;
  let accessPollCallCount = 0;
  let lastCapturedPollHeaders: Headers | null = null;
  let capturedContentTokenHeader: string | null = null;
  let currentAccessState: 'LOCKED' | 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED' = 'LOCKED';
  let cancelCalled = false;

  const server = setupServer(
    http.get('*/api/biolock/status', () => {
      if (!biolockEnabled) {
        return HttpResponse.json({ enabled: false }, { status: 200 });
      }
      return HttpResponse.json({
        enabled: true,
        device: mockDevice,
        credential: mockCredential,
      });
    }),

    http.post('*/api/biolock/devices', async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { name?: string };
      mockDevice = {
        id: 'dev-1111-2222',
        name: body.name || 'Office Scanner',
        online: true,
      };
      return HttpResponse.json({
        deviceId: 'dev-1111-2222',
        deviceKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        keyVersion: 1,
      }, { status: 201 });
    }),

    http.post('*/api/biolock/devices/:id/rotate-key', () => {
      return HttpResponse.json({
        deviceId: 'dev-1111-2222',
        deviceKey: 'ffff0000aaaa11112222333344445555',
        keyVersion: 2,
      });
    }),

    http.delete('*/api/biolock/devices/:id', () => {
      mockDevice = null;
      return new HttpResponse(null, { status: 204 });
    }),

    http.post('*/api/biolock/enrollment', () => {
      enrollmentJobStatus = 'QUEUED';
      enrollmentJobOutcome = '';
      return HttpResponse.json({ jobId: 'job-enroll-123', status: 'QUEUED' });
    }),

    http.get('*/api/biolock/enrollment/:jobId', () => {
      return HttpResponse.json({
        jobId: 'job-enroll-123',
        status: enrollmentJobStatus,
        outcome: enrollmentJobOutcome,
      });
    }),

    http.delete('*/api/biolock/credential', () => {
      mockCredential = null;
      return new HttpResponse(null, { status: 204 });
    }),

    http.post('*/api/projects', async ({ request }) => {
      const body = await request.json() as { name: string };
      return HttpResponse.json({
        id: 'proj-new-789',
        name: body.name,
        role: 'Owner',
      });
    }),

    http.put('*/api/projects/:id/biolock', async ({ request }) => {
      const body = await request.json() as { enabled: boolean };
      return HttpResponse.json({ enabled: body.enabled, credentialId: 'cred-1' });
    }),

    http.put('*/api/attachments/:id/restricted', async ({ request }) => {
      const body = await request.json() as { restricted: boolean };
      return HttpResponse.json({
        id: 'att-1',
        fileName: 'confidential.pdf',
        restricted: body.restricted,
        locked: body.restricted,
        fileUrl: body.restricted ? null : 'https://example.com/confidential.pdf',
      });
    }),

    http.post('*/api/attachments/:id/access-request', () => {
      accessRequestCallCount++;
      currentAccessState = 'PENDING';
      return HttpResponse.json({
        requestId: 'req-access-456',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 120000).toISOString(),
        secondsRemaining: 120,
        deviceName: 'Alice Scanner',
        leaderNotified: true,
        deviceOnline: true,
      }, { status: 201 });
    }),

    http.get('*/api/attachments/:id/access', ({ request }) => {
      accessPollCallCount++;
      lastCapturedPollHeaders = request.headers;
      return HttpResponse.json({
        state: currentAccessState,
        requestId: 'req-access-456',
        secondsRemaining: 110,
        accessExpiresAt: currentAccessState === 'APPROVED' ? new Date(Date.now() + 900000).toISOString() : null,
        deviceOnline: true,
      });
    }),

    http.post('*/api/attachments/access-requests/:id/cancel', () => {
      cancelCalled = true;
      currentAccessState = 'LOCKED';
      return new HttpResponse(null, { status: 200 });
    }),

    http.get('*/api/attachments/:id/content', ({ request }) => {
      capturedContentTokenHeader = request.headers.get('authorization');
      return new HttpResponse(new Blob(['Secure file content bytes']), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'no-store',
        },
      });
    }),

    http.get('*/api/auth/me', () => {
      return HttpResponse.json({
        id: 'user-leader-1',
        name: 'Leader Alice',
        email: 'alice@example.com',
      });
    }),

    http.get('*/api/users/me', () => {
      return HttpResponse.json({
        id: 'user-leader-1',
        name: 'Leader Alice',
        email: 'alice@example.com',
      });
    })
  );

  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
    biolockEnabled = true;
    mockDevice = null;
    mockCredential = null;
    enrollmentJobStatus = 'QUEUED';
    enrollmentJobOutcome = '';
    accessRequestCallCount = 0;
    accessPollCallCount = 0;
    lastCapturedPollHeaders = null;
    capturedContentTokenHeader = null;
    currentAccessState = 'LOCKED';
    cancelCalled = false;

    const token = createJwt({
      sub: 'alice@example.com',
      name: 'Leader Alice',
      sid: 'sess-123',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    setToken(token);

    // Mock URL.createObjectURL and URL.revokeObjectURL in jsdom
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-blob-uuid');
    window.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    clearToken();
    vi.restoreAllMocks();
  });

  function renderWithProviders(ui: React.ReactElement) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  // ---------------------------------------------------------------------------
  // 1. FEATURE FLAG OFF HIDES EVERYTHING
  // ---------------------------------------------------------------------------
  it('1. Flag off: if GET /api/biolock/status says enabled=false, hides BioLock device card, project security toggle, and badges', async () => {
    biolockEnabled = false;

    // A. Profile Device Card
    const { container } = renderWithProviders(<BioLockDeviceCard />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });

    // B. CreateProjectModal
    renderWithProviders(<CreateProjectModal isOpen={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Initialize Project')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('fingerprint-security-section')).toBeNull();

    // C. AttachmentItem
    const attachment: Attachment = {
      id: 'att-1',
      taskId: 'task-1',
      uploadedBy: 'user-leader-1',
      uploadedByName: 'Leader Alice',
      fileUrl: 'https://example.com/doc.pdf',
      fileType: 'application/pdf',
      fileName: 'doc.pdf',
      uploadedAt: new Date().toISOString(),
    };
    renderWithProviders(<AttachmentItem attachment={attachment} isProjectOwner={true} />);
    expect(screen.queryByTestId('protect-toggle-att-1')).toBeNull();
    expect(screen.queryByTestId('restricted-badge-att-1')).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 2. DEVICE REGISTRATION & ONE-TIME KEY WARNING
  // ---------------------------------------------------------------------------
  it('2. Device card: register device shows one-time key with copy buttons and clear warning that it is shown once', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BioLockDeviceCard />);

    await waitFor(() => {
      expect(screen.getByText('Taskoura BioLock Hardware')).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/Device name/i);
    await user.type(nameInput, 'Desk Scanner 1');
    const registerBtn = screen.getByRole('button', { name: /Register Device/i });
    await user.click(registerBtn);

    // One-time key alert must be visible
    await waitFor(() => {
      expect(screen.getByTestId('one-time-key-alert')).toBeInTheDocument();
    });

    expect(screen.getByText(/never be shown again/i)).toBeInTheDocument();
    expect(screen.getByText('a1b2c3d4e5f60718293a4b5c6d7e8f90')).toBeInTheDocument();
    expect(screen.getAllByText('dev-1111-2222').length).toBeGreaterThanOrEqual(1);

    // Device online badge should now be present
    expect(screen.getByTestId('device-online-badge')).toHaveTextContent('Device Online');
  });

  // ---------------------------------------------------------------------------
  // 3. ENROLLMENT: POLLING AND NEVER TRUSTING FRONTEND SUCCESS FLAG
  // ---------------------------------------------------------------------------
  it('3. Enrollment: starts enrollment, shows "Place your finger on the device twice" and polls until ENROLLED', async () => {
    const user = userEvent.setup();
    mockDevice = { id: 'dev-1', name: 'My Scanner', online: true };

    renderWithProviders(<BioLockDeviceCard />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Enroll my fingerprint/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Enroll my fingerprint/i }));

    // Shows instruction banner
    await waitFor(() => {
      expect(screen.getByTestId('enrollment-progress-banner')).toBeInTheDocument();
    });
    expect(screen.getByText(/Place your finger on the device twice/i)).toBeInTheDocument();

    // Transition backend job to COMPLETED + ENROLLED
    enrollmentJobStatus = 'COMPLETED';
    enrollmentJobOutcome = 'ENROLLED';
    mockCredential = { id: 'cred-1', status: 'ACTIVE', slot: 3 };

    await waitFor(() => {
      expect(screen.getByText(/Fingerprint enrolled successfully/i)).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  // ---------------------------------------------------------------------------
  // 4. CREATEPROJECTMODAL & DELETEPROJECTMODAL
  // ---------------------------------------------------------------------------
  it('4. CreateProjectModal offers Fingerprint Security and DeleteProjectModal contains explanation sentence', async () => {
    const user = userEvent.setup();
    mockDevice = { id: 'dev-1', name: 'My Scanner', online: true };
    mockCredential = { id: 'cred-1', status: 'ACTIVE', slot: 2 };

    // A. CreateProjectModal with registered credential
    const handleClose = vi.fn();
    renderWithProviders(<CreateProjectModal isOpen={true} onClose={handleClose} />);
    await waitFor(() => {
      expect(screen.getByTestId('fingerprint-security-section')).toBeInTheDocument();
    });

    const toggle = screen.getByTestId('biolock-toggle');
    await user.click(toggle);

    expect(screen.getByText(/Fingerprint already registered/i)).toBeInTheDocument();

    // Fill project title and submit
    await user.type(screen.getByLabelText(/Project Title/i), 'Secure Research');
    await user.click(screen.getByRole('button', { name: /Initialize Project/i }));

    await waitFor(() => {
      expect(handleClose).toHaveBeenCalled();
    });

    // B. DeleteProjectModal
    const sampleProject: Project = {
      id: 'proj-1',
      name: 'Secure Research',
      role: 'Owner',
    };

    renderWithProviders(<DeleteProjectModal isOpen={true} onClose={() => {}} project={sampleProject} />);
    expect(screen.getByText(/This project's fingerprint protection will be removed and the fingerprint stays for the leader's other projects./i)).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // 5. RESTRICTED DOCUMENT STATES: LOCKED -> WAITING -> APPROVED -> VIEW & DOWNLOAD
  // ---------------------------------------------------------------------------
  it('5. Restricted document: member requests access, polls with background header, unlocks on approval without reload', async () => {
    const user = userEvent.setup();
    mockDevice = { id: 'dev-1', name: 'Alice Scanner', online: true };
    mockCredential = { id: 'cred-1', status: 'ACTIVE', slot: 1 };

    const restrictedAttachment: Attachment = {
      id: 'att-secure-1',
      taskId: 'task-1',
      uploadedBy: 'user-leader-1',
      uploadedByName: 'Leader Alice',
      fileUrl: '', // Direct URL is null for restricted
      fileType: 'application/pdf',
      fileName: 'blueprints.pdf',
      uploadedAt: new Date().toISOString(),
      restricted: true,
      locked: true,
    };

    renderWithProviders(
      <AttachmentItem
        attachment={restrictedAttachment}
        isProjectOwner={false} // Member view
      />
    );

    // Initial state: LOCKED with "Request Leader Fingerprint Access" button
    await waitFor(() => {
      expect(screen.getByTestId('access-locked-box')).toBeInTheDocument();
    });
    expect(screen.getByTestId('request-access-button')).toHaveTextContent('Request Leader Fingerprint Access');

    // No permanent download URL is exposed for restricted document
    expect(screen.queryByTestId('attachment-link-att-secure-1')).toBeNull();
    expect(screen.getByTestId('attachment-name-att-secure-1')).toHaveTextContent('blueprints.pdf');

    // Member clicks request access
    await user.click(screen.getByTestId('request-access-button'));

    // State transitions to WAITING_FOR_LEADER
    await waitFor(() => {
      expect(screen.getByTestId('access-waiting-box')).toBeInTheDocument();
    });
    expect(screen.getByText(/Waiting for Project Leader's fingerprint verification.../i)).toBeInTheDocument();
    expect(screen.getByTestId('leader-notified-badge')).toHaveTextContent('Your leader was emailed');
    expect(screen.getByTestId('cancel-access-request')).toBeInTheDocument();

    // Verify polling carried the X-Background-Request header
    await waitFor(() => {
      expect(accessPollCallCount).toBeGreaterThan(0);
    });
    expect(lastCapturedPollHeaders?.get('x-background-request')).toBe('true');

    // Simulate Leader placing fingerprint on device (backend state -> APPROVED)
    currentAccessState = 'APPROVED';

    // UI transitions to APPROVED without reload
    await waitFor(() => {
      expect(screen.getByTestId('access-approved-box')).toBeInTheDocument();
    }, { timeout: 4000 });

    expect(screen.getByText('Access Approved')).toBeInTheDocument();
    expect(screen.getByTestId('view-content-button')).toBeInTheDocument();
    expect(screen.getByTestId('download-content-button')).toBeInTheDocument();

    // Member clicks View -> fetches /content with auth token and shows modal
    await user.click(screen.getByTestId('view-content-button'));

    await waitFor(() => {
      expect(capturedContentTokenHeader).toContain('mockSignature');
      expect(capturedContentTokenHeader).toMatch(/^Bearer\s+/);
    });

    await waitFor(() => {
      expect(screen.getByTestId('document-preview-modal')).toBeInTheDocument();
    });

    // Close preview revokes URL
    await user.click(screen.getByTestId('close-preview-button'));
    await waitFor(() => {
      expect(screen.queryByTestId('document-preview-modal')).toBeNull();
    });
    expect(window.URL.revokeObjectURL).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 6. DENIED AND EXPIRED MESSAGES WITH REQUEST AGAIN
  // ---------------------------------------------------------------------------
  it('6. Denied and expired states render clear messages and "Request again" buttons', async () => {
    const user = userEvent.setup();
    const restrictedAttachment: Attachment = {
      id: 'att-denied-1',
      taskId: 'task-1',
      uploadedBy: 'user-leader-1',
      uploadedByName: 'Leader Alice',
      fileUrl: '',
      fileType: 'application/pdf',
      fileName: 'payroll.pdf',
      uploadedAt: new Date().toISOString(),
      restricted: true,
      locked: true,
    };

    currentAccessState = 'DENIED';

    renderWithProviders(<AttachmentItem attachment={restrictedAttachment} isProjectOwner={false} />);

    await waitFor(() => {
      expect(screen.getByTestId('access-denied-box')).toBeInTheDocument();
    });
    expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
    expect(screen.getByTestId('request-again-button')).toHaveTextContent('Request again');

    // Switch to EXPIRED
    currentAccessState = 'EXPIRED';
    await user.click(screen.getByTestId('request-again-button'));

    await waitFor(() => {
      expect(screen.getByTestId('access-waiting-box')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 7. REQUEST CANCELLATION
  // ---------------------------------------------------------------------------
  it('7. Requester can cancel pending request and return to locked state', async () => {
    const user = userEvent.setup();
    const restrictedAttachment: Attachment = {
      id: 'att-cancel-1',
      taskId: 'task-1',
      uploadedBy: 'user-leader-1',
      uploadedByName: 'Leader Alice',
      fileUrl: '',
      fileType: 'application/pdf',
      fileName: 'strategy.pdf',
      uploadedAt: new Date().toISOString(),
      restricted: true,
      locked: true,
    };

    renderWithProviders(<AttachmentItem attachment={restrictedAttachment} isProjectOwner={false} />);

    await waitFor(() => {
      expect(screen.getByTestId('request-access-button')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('request-access-button'));

    await waitFor(() => {
      expect(screen.getByTestId('access-waiting-box')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('cancel-access-request'));

    await waitFor(() => {
      expect(cancelCalled).toBe(true);
      expect(screen.getByTestId('access-locked-box')).toBeInTheDocument();
    });
  });
});
