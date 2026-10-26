import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { activityService } from '../services/activityService';
import { ActivityLog } from '../types/activity';

export const useActivity = (projectId?: string, limit = 200) => {
  return useQuery<ActivityLog[], Error>({
    queryKey: projectId ? queryKeys.projects.activity(projectId) : ['projects', 'null', 'activity'],
    queryFn: () => {
      if (!projectId) throw new Error('Project ID is required');
      return activityService.getActivity(projectId, limit);
    },
    enabled: Boolean(projectId),
  });
};
