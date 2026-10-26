import {
  getAttachments,
  uploadAttachment,
  deleteAttachment,
  validateAttachmentFile,
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
  DISALLOWED_EXTENSIONS,
} from '../features/attachments/api';
import { Attachment } from '../types/attachment';

export const attachmentService = {
  getAttachments: async (taskId: string): Promise<Attachment[]> => {
    return (await getAttachments(taskId)) as Attachment[];
  },

  uploadAttachment: async (
    taskId: string,
    file: File,
    onUploadProgress?: (percent: number, progressEvent: unknown) => void
  ): Promise<Attachment> => {
    return (await uploadAttachment(taskId, file, onUploadProgress)) as Attachment;
  },

  deleteAttachment: async (attachmentId: string): Promise<void> => {
    await deleteAttachment(attachmentId);
  },

  validateAttachmentFile,
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
  DISALLOWED_EXTENSIONS,
};

export default attachmentService;
