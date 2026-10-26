export interface Attachment {
  id: string;
  taskId: string;
  uploadedBy: string;
  uploadedByName: string;
  fileUrl: string;
  fileType: string;
  fileName: string;
  uploadedAt: string;
  fileSize?: number;
  size?: number;
}
