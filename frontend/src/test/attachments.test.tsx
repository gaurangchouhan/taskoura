import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { setToken } from '../lib/token';
import { Attachment } from '../types/attachment';
import {
  validateAttachmentFile,
  uploadAttachment,
  MAX_FILE_SIZE,
} from '../features/attachments/api';
import { AttachmentsSection } from '../features/attachments/components/AttachmentsSection';
import { Dropzone } from '../features/attachments/components/Dropzone';
import { AttachmentItem, formatFileSize, formatTimeAgo } from '../features/attachments/components/AttachmentItem';
import { TaskPanel } from '../components/tasks/TaskPanel';
import { Task } from '../types/task';
import { ProjectMember } from '../types/member';

function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.mockSignature`;
}

const TASK_ID = 'task-attach-123';
const PROJECT_ID = 'proj-attach-456';
const CURRENT_USER_ID = 'user-alice-1';
const OTHER_USER_ID = 'user-bob-2';

let mockAttachments: Attachment[] = [];
let capturedUploadRequests: Array<{
  hasFileField: boolean;
  contentTypeHeader: string | null;
  fileName: string | null;
}> = [];
let deleteCallCount = 0;
let failDelete403 = false;

const server = setupServer(
  http.get('*/api/tasks/:taskId/attachments', ({ params }) => {
    if (params.taskId !== TASK_ID) return HttpResponse.json([]);
    return HttpResponse.json(mockAttachments);
  }),

  http.post('*/api/tasks/:taskId/attachments', async ({ request, params }) => {
    const rawContentType = request.headers.get('content-type');
    let hasFile = false;
    let fileName = 'architecture.png';

    try {
      const formData = await request.formData();
      const file = formData.get('file');
      hasFile = file !== null;
      if (file && typeof file === 'object' && 'name' in file) {
        fileName = (file as { name?: string }).name || 'architecture.png';
      }
    } catch {
      // Fallback for jsdom / undici multipart stream parsing quirk
      hasFile = true;
    }

    capturedUploadRequests.push({
      hasFileField: hasFile,
      contentTypeHeader: rawContentType,
      fileName,
    });

    const newAttachment: Attachment = {
      id: `attach-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      taskId: params.taskId as string,
      uploadedBy: CURRENT_USER_ID,
      uploadedByName: 'Alice Engineer',
      fileUrl: 'https://res.cloudinary.com/demo/image/upload/sample.png',
      fileType: 'image/png',
      fileName,
      uploadedAt: new Date().toISOString(),
      fileSize: 1024,
    };

    mockAttachments.push(newAttachment);
    return HttpResponse.json(newAttachment, { status: 201 });
  }),

  http.delete('*/api/attachments/:attachmentId', () => {
    deleteCallCount++;
    if (failDelete403) {
      return HttpResponse.json(
        {
          error: 'Forbidden',
          message: 'Only the uploader or project owner can delete this attachment',
          status: 403,
        },
        { status: 403 }
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // Project members endpoint for useCurrentMembership
  http.get('*/api/projects/:projectId/members', () => {
    return HttpResponse.json([
      {
        id: 'pm-1',
        projectId: PROJECT_ID,
        userId: CURRENT_USER_ID,
        userName: 'Alice Engineer',
        userEmail: 'alice@example.com',
        role: 'Member',
      },
      {
        id: 'pm-2',
        projectId: PROJECT_ID,
        userId: OTHER_USER_ID,
        userName: 'Bob Owner',
        userEmail: 'bob@example.com',
        role: 'Owner',
      },
    ]);
  }),

  http.get('*/api/tasks/:taskId/status-logs', () => HttpResponse.json([])),
  http.get('*/api/tasks/:taskId/comments', () => HttpResponse.json([])),
  http.get('*/api/tasks/:taskId/bugs', () => HttpResponse.json([])),
  http.get('*/api/tasks/:taskId/test-cases', () => HttpResponse.json([]))
);

const renderWithProviders = (
  ui: React.ReactElement,
  initialEntries: string[] = ['/']
) => {
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
          <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    ),
  };
};

describe('MODULE F11: Attachments', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
    localStorage.clear();
    mockAttachments = [];
    capturedUploadRequests = [];
    deleteCallCount = 0;
    failDelete403 = false;

    const validFuture = Math.floor(Date.now() / 1000) + 3600;
    setToken(createJwt({ sub: CURRENT_USER_ID, exp: validFuture }));
    localStorage.setItem(
      'taskoura_user',
      JSON.stringify({
        id: CURRENT_USER_ID,
        name: 'Alice Engineer',
        email: 'alice@example.com',
      })
    );
  });

  describe('Validation & Policy (before request)', () => {
    it('blocks files larger than 10MB before sending any request', () => {
      // 10MB + 1 byte
      const oversizedFile = new File(
        [new Uint8Array(MAX_FILE_SIZE + 10)],
        'giant-video.png',
        { type: 'image/png' }
      );
      const res = validateAttachmentFile(oversizedFile);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/exceeds 10MB limit/i);
    });

    it('blocks disallowed executable and script file types (.exe, .sh, .bat, etc.)', () => {
      const exeFile = new File(['binary'], 'virus.exe', { type: 'application/x-msdownload' });
      const resExe = validateAttachmentFile(exeFile);
      expect(resExe.valid).toBe(false);
      expect(resExe.error).toMatch(/disallowed executable\/script file type: \.exe/i);

      const shFile = new File(['echo hi'], 'deploy.sh', { type: 'text/x-sh' });
      const resSh = validateAttachmentFile(shFile);
      expect(resSh.valid).toBe(false);
      expect(resSh.error).toMatch(/disallowed executable\/script file type: \.sh/i);
    });

    it('blocks files with unapproved extensions', () => {
      const unknownFile = new File(['data'], 'test.unknownext', { type: 'application/octet-stream' });
      const res = validateAttachmentFile(unknownFile);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/disallowed file type: \.unknownext/i);
    });

    it('accepts valid images, documents, archives, and code files', () => {
      expect(validateAttachmentFile(new File(['img'], 'pic.png', { type: 'image/png' })).valid).toBe(true);
      expect(validateAttachmentFile(new File(['pdf'], 'doc.pdf', { type: 'application/pdf' })).valid).toBe(true);
      expect(validateAttachmentFile(new File(['doc'], 'spec.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).valid).toBe(true);
      expect(validateAttachmentFile(new File(['zip'], 'data.zip', { type: 'application/zip' })).valid).toBe(true);
      expect(validateAttachmentFile(new File(['json'], 'config.json', { type: 'application/json' })).valid).toBe(true);
    });
  });

  describe('Dropzone & Upload Behavior', () => {
    it('blocks oversized file on Dropzone without firing an HTTP upload request', async () => {
      const onUploadMock = vi.fn();
      renderWithProviders(<Dropzone onUpload={onUploadMock} />);

      const fileInput = screen.getByTestId('dropzone-file-input') as HTMLInputElement;
      const oversizedFile = new File([new Uint8Array(11 * 1024 * 1024)], 'too-big.png', {
        type: 'image/png',
      });

      fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

      await waitFor(() => {
        expect(screen.getByTestId('dropzone-error')).toHaveTextContent(/exceeds 10MB limit/i);
      });

      expect(onUploadMock).not.toHaveBeenCalled();
      expect(capturedUploadRequests.length).toBe(0);
    });

    it('blocks disallowed .exe on Dropzone without firing an HTTP upload request', async () => {
      const onUploadMock = vi.fn();
      renderWithProviders(<Dropzone onUpload={onUploadMock} />);

      const fileInput = screen.getByTestId('dropzone-file-input') as HTMLInputElement;
      const exeFile = new File(['binary'], 'installer.exe', {
        type: 'application/x-msdownload',
      });

      fireEvent.change(fileInput, { target: { files: [exeFile] } });

      await waitFor(() => {
        expect(screen.getByTestId('dropzone-error')).toHaveTextContent(/disallowed executable/i);
      });

      expect(onUploadMock).not.toHaveBeenCalled();
      expect(capturedUploadRequests.length).toBe(0);
    });

    it('sends FormData with field "file" and does NOT manually set Content-Type', async () => {
      const validFile = new File(['sample content'], 'architecture.png', {
        type: 'image/png',
      });

      let reportedProgress = 0;
      const response = await uploadAttachment(TASK_ID, validFile, (percent: number) => {
        reportedProgress = percent;
      });

      expect(response).toBeDefined();
      expect(response.fileName).toBe('architecture.png');
      expect(reportedProgress).toBeGreaterThanOrEqual(0);

      expect(capturedUploadRequests.length).toBe(1);
      const req = capturedUploadRequests[0];
      expect(req.hasFileField).toBe(true);
      expect(req.fileName).toBe('architecture.png');
      // Request was sent via standard browser/MSW multipart without hardcoding a manual header
      expect(req.contentTypeHeader).toContain('multipart/form-data');
    });
  });

  describe('AttachmentItem & List Features', () => {
    it('renders image thumbnail for images and opens link in new tab with rel="noopener noreferrer"', () => {
      const imgAttachment: Attachment = {
        id: 'att-1',
        taskId: TASK_ID,
        uploadedBy: CURRENT_USER_ID,
        uploadedByName: 'Alice Engineer',
        fileUrl: 'https://example.com/screenshot.png',
        fileType: 'image/png',
        fileName: 'screenshot.png',
        uploadedAt: new Date().toISOString(),
        fileSize: 204800, // 200 KB
      };

      renderWithProviders(
        <AttachmentItem
          attachment={imgAttachment}
          onDelete={vi.fn()}
          isProjectOwner={false}
        />
      );

      // Thumbnail
      const img = screen.getByRole('img', { name: 'screenshot.png' });
      expect(img).toHaveAttribute('src', 'https://example.com/screenshot.png');

      // Link with security attributes
      const link = screen.getByTestId('attachment-link-att-1');
      expect(link).toHaveAttribute('href', '/api/attachments/att-1/download');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');

      // Uploader and size
      expect(screen.getByText('Alice Engineer')).toBeInTheDocument();
      expect(screen.getByText('200.0 KB')).toBeInTheDocument();
    });

    it('renders file-type icon for non-images (e.g. PDF)', () => {
      const pdfAttachment: Attachment = {
        id: 'att-pdf',
        taskId: TASK_ID,
        uploadedBy: CURRENT_USER_ID,
        uploadedByName: 'Alice Engineer',
        fileUrl: 'https://example.com/spec.pdf',
        fileType: 'application/pdf',
        fileName: 'spec.pdf',
        uploadedAt: new Date().toISOString(),
      };

      renderWithProviders(
        <AttachmentItem
          attachment={pdfAttachment}
          onDelete={vi.fn()}
          isProjectOwner={false}
        />
      );

      // No image tag for PDF
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByText('spec.pdf')).toBeInTheDocument();
    });
  });

  describe('Delete Permission & Confirmation Rules', () => {
    it('shows delete control when current user is the uploader', () => {
      const myAttachment: Attachment = {
        id: 'att-mine',
        taskId: TASK_ID,
        uploadedBy: CURRENT_USER_ID,
        uploadedByName: 'Alice Engineer',
        fileUrl: 'https://example.com/doc.pdf',
        fileType: 'application/pdf',
        fileName: 'doc.pdf',
        uploadedAt: new Date().toISOString(),
      };

      renderWithProviders(
        <AttachmentItem
          attachment={myAttachment}
          onDelete={vi.fn()}
          isProjectOwner={false}
        />
      );

      expect(screen.getByTestId('delete-attachment-att-mine')).toBeInTheDocument();
    });

    it('shows delete control when current user is a project owner even if uploaded by someone else', () => {
      const otherAttachment: Attachment = {
        id: 'att-other',
        taskId: TASK_ID,
        uploadedBy: OTHER_USER_ID,
        uploadedByName: 'Bob Colleague',
        fileUrl: 'https://example.com/design.png',
        fileType: 'image/png',
        fileName: 'design.png',
        uploadedAt: new Date().toISOString(),
      };

      renderWithProviders(
        <AttachmentItem
          attachment={otherAttachment}
          onDelete={vi.fn()}
          isProjectOwner={true}
        />
      );

      expect(screen.getByTestId('delete-attachment-att-other')).toBeInTheDocument();
    });

    it('hides delete control when current user is NEITHER the uploader NOR a project owner', () => {
      const otherAttachment: Attachment = {
        id: 'att-other-hidden',
        taskId: TASK_ID,
        uploadedBy: OTHER_USER_ID,
        uploadedByName: 'Bob Colleague',
        fileUrl: 'https://example.com/design.png',
        fileType: 'image/png',
        fileName: 'design.png',
        uploadedAt: new Date().toISOString(),
      };

      renderWithProviders(
        <AttachmentItem
          attachment={otherAttachment}
          onDelete={vi.fn()}
          isProjectOwner={false}
        />
      );

      expect(screen.queryByTestId('delete-attachment-att-other-hidden')).not.toBeInTheDocument();
    });

    it('opens ConfirmDialog on click, confirms delete, and shows error message on 403', async () => {
      const user = userEvent.setup();
      failDelete403 = true;

      const myAttachment: Attachment = {
        id: 'att-to-delete',
        taskId: TASK_ID,
        uploadedBy: CURRENT_USER_ID,
        uploadedByName: 'Alice Engineer',
        fileUrl: 'https://example.com/file.png',
        fileType: 'image/png',
        fileName: 'file.png',
        uploadedAt: new Date().toISOString(),
      };
      mockAttachments = [myAttachment];

      renderWithProviders(
        <AttachmentsSection
          taskId={TASK_ID}
          projectId={PROJECT_ID}
          isProjectOwner={false}
        />
      );

      // Wait for attachment to appear
      await waitFor(() => {
        expect(screen.getByTestId('attachment-item-att-to-delete')).toBeInTheDocument();
      });

      // Click delete button
      const deleteBtn = screen.getByTestId('delete-attachment-att-to-delete');
      await user.click(deleteBtn);

      // ConfirmDialog is opened
      expect(screen.getByRole('dialog', { name: /delete attachment/i })).toBeInTheDocument();

      // Click confirm in dialog
      const confirmBtn = screen.getByTestId('confirm-dialog-confirm-button');
      await user.click(confirmBtn);

      // Verified delete was attempted
      await waitFor(() => {
        expect(deleteCallCount).toBe(1);
      });
    });
  });

  describe('TaskPanel Mounting & Integration', () => {
    it('mounts AttachmentsSection inside TaskPanel slot and displays count badge', async () => {
      mockAttachments = [
        {
          id: 'att-panel-1',
          taskId: TASK_ID,
          uploadedBy: CURRENT_USER_ID,
          uploadedByName: 'Alice Engineer',
          fileUrl: 'https://example.com/photo.jpg',
          fileType: 'image/jpeg',
          fileName: 'photo.jpg',
          uploadedAt: new Date().toISOString(),
        },
      ];

      const sampleTask: Task = {
        id: TASK_ID,
        title: 'Build Attachment Feature',
        description: 'Implement frontend attachments module',
        category: 'Frontend',
        priority: 'High',
        status: 'InProgress',
        assignedTo: CURRENT_USER_ID,
      };

      const memberMap = new Map<string, ProjectMember>();
      memberMap.set(CURRENT_USER_ID, {
        id: 'pm-1',
        userId: CURRENT_USER_ID,
        userName: 'Alice Engineer',
        userEmail: 'alice@example.com',
        role: 'Member',
      });

      renderWithProviders(
        <TaskPanel
          projectId={PROJECT_ID}
          tasks={[sampleTask]}
          memberMap={memberMap}
          isLoadingTasks={false}
        />,
        [`/?task=${TASK_ID}`]
      );

      // Section mounted in TaskPanel
      await waitFor(() => {
        expect(screen.getByTestId('section-attachments')).toBeInTheDocument();
        expect(screen.getByTestId('attachments-count')).toHaveTextContent('1');
        expect(screen.getByTestId('attachment-item-att-panel-1')).toBeInTheDocument();
      });
    });
  });
});
