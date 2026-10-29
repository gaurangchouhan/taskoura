import { apiClient } from './api';
import { ActivityLog } from '../types/activity';

export const activityService = {
  getActivity: async (projectId: string, limit = 200): Promise<ActivityLog[]> => {
    const { data } = await apiClient.get<ActivityLog[]>(`/projects/${projectId}/activity`, {
      params: { limit },
    });
    return data || [];
  },
};

export default activityService;
