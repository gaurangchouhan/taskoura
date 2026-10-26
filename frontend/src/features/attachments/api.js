import { apiClient } from '../../services/api';

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const DISALLOWED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'bin', 'msi', 'com', 'vbs', 'ps1', 'app', 'jar', 'war', 'dll', 'so', 'dmg'
]);

export const ALLOWED_EXTENSIONS = new Set([
  // Images
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico',
  // Documents
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'odt', 'ods', 'odp',
  // Data / Code / Archives
  'json', 'xml', 'yaml', 'yml', 'md', 'zip', 'tar', 'gz', '7z'
]);

/**
 * Validates file size (10MB limit) and file extension before sending to the backend.
 * Returns { valid: boolean, error?: string }
 */
export function validateAttachmentFile(file) {
  if (!file) {
    return { valid: false, error: 'Please select a file to upload.' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File size exceeds 10MB limit. Please choose a smaller file.',
    };
  }

  const name = file.name || '';
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1 || lastDot === name.length - 1) {
    return {
      valid: false,
      error: 'File name must include a valid extension.',
    };
  }

  const ext = name.substring(lastDot + 1).toLowerCase();

  if (DISALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Disallowed executable/script file type: .${ext}`,
    };
  }

  if (file.type) {
    const lowerType = file.type.toLowerCase();
    if (
      lowerType.includes('x-msdownload') ||
      lowerType.includes('x-sh') ||
      lowerType.includes('x-bat') ||
      lowerType.includes('x-executable')
    ) {
      return {
        valid: false,
        error: `Disallowed executable content type: ${file.type}`,
      };
    }
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Disallowed file type: .${ext}. Allowed formats include images, PDFs, office docs, and archives.`,
    };
  }

  return { valid: true };
}

/**
 * GET /api/tasks/{taskId}/attachments -> Attachment[]
 */
export async function getAttachments(taskId) {
  if (!taskId) throw new Error('Task ID is required');
  const response = await apiClient.get(`/api/tasks/${taskId}/attachments`);
  return response.data;
}

/**
 * POST /api/tasks/{taskId}/attachments (multipart, field "file")
 * Sends FormData with field "file" without manually setting Content-Type.
 */
export async function uploadAttachment(taskId, file, onUploadProgress) {
  if (!taskId) throw new Error('Task ID is required');
  if (!file) throw new Error('File is required');

  const formData = new FormData();
  formData.append('file', file);

  const config = {};
  if (typeof onUploadProgress === 'function') {
    config.onUploadProgress = (progressEvent) => {
      if (progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onUploadProgress(percent, progressEvent);
      } else {
        onUploadProgress(100, progressEvent);
      }
    };
  }

  // Do NOT pass headers: { 'Content-Type': 'multipart/form-data' } manually
  const response = await apiClient.post(
    `/api/tasks/${taskId}/attachments`,
    formData,
    config
  );
  return response.data;
}

/**
 * DELETE /api/attachments/{attachmentId} -> 204
 */
export async function deleteAttachment(attachmentId) {
  if (!attachmentId) throw new Error('Attachment ID is required');
  const response = await apiClient.delete(`/api/attachments/${attachmentId}`);
  return response.data;
}

export const attachmentApi = {
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
  DISALLOWED_EXTENSIONS,
  validateAttachmentFile,
  getAttachments,
  uploadAttachment,
  deleteAttachment,
};

export default attachmentApi;
