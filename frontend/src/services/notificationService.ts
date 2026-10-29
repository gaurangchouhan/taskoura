import { apiClient } from './api';
import {
  Notification,
  RawNotification,
  normalizeNotification,
} from '../types/notification';

export const notificationService = {
  getNotifications: async (unreadOnly: boolean = false, isBackground: boolean = false): Promise<Notification[]> => {
    const headers: Record<string, string> = {};
    if (isBackground) {
      headers['X-Background-Request'] = 'true';
    }
    const { data } = await apiClient.get<RawNotification[]>('/notifications', {
      params: { unreadOnly },
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
    return (data || []).map(normalizeNotification);
  },

  markRead: async (id: string): Promise<Notification> => {
    const { data } = await apiClient.patch<RawNotification>(`/notifications/${id}/read`);
    return normalizeNotification(data);
  },
};

export default notificationService;
