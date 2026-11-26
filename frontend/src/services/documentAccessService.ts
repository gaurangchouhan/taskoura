import { apiClient } from './api';
import {
  DocumentAccessRequestResponse,
  DocumentAccessStateResponse,
} from '../types/biolock';
import { Attachment } from '../types';

export const documentAccessService = {
  restrictAttachment: async (attachmentId: string, restricted: boolean): Promise<Attachment> => {
    const { data } = await apiClient.put<Attachment>(`/attachments/${attachmentId}/restricted`, {
      restricted,
    });
    return data;
  },

  requestAccess: async (attachmentId: string): Promise<DocumentAccessRequestResponse> => {
    const { data } = await apiClient.post<DocumentAccessRequestResponse>(
      `/attachments/${attachmentId}/access-request`
    );
    return data;
  },

  getAccessState: async (
    attachmentId: string,
    isBackground: boolean = false
  ): Promise<DocumentAccessStateResponse> => {
    const headers: Record<string, string> = {};
    if (isBackground) {
      headers['X-Background-Request'] = 'true';
    }
    const { data } = await apiClient.get<DocumentAccessStateResponse>(
      `/attachments/${attachmentId}/access`,
      {
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      }
    );
    return data;
  },

  cancelAccessRequest: async (requestId: string): Promise<void> => {
    await apiClient.post(`/attachments/access-requests/${requestId}/cancel`);
  },

  fetchContentBlob: async (attachmentId: string): Promise<Blob> => {
    const response = await apiClient.get(`/attachments/${attachmentId}/content`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export default documentAccessService;
