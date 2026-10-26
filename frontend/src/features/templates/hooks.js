import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { queryKeys } from '../../lib/queryKeys';
import { getTemplates, applyTemplate } from './api';

/**
 * Hook to retrieve all available project templates.
 * GET /api/templates
 */
export const useTemplates = () => {
  return useQuery({
    queryKey: queryKeys.templates.all,
    queryFn: getTemplates,
  });
};

/**
 * Hook to apply a template to a project.
 * POST /api/projects/{projectId}/templates/{key}/apply
 * 
 * - Disables double submission while pending
 * - On success: toasts createdCount, invalidates per invalidation map
 * - On 404: toasts "This template is no longer available"
 */
export const useApplyTemplate = (projectId, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables) => {
      let targetProjectId = projectId;
      let templateKey;

      if (typeof variables === 'string') {
        templateKey = variables;
      } else if (variables && typeof variables === 'object') {
        templateKey = variables.key || variables.templateKey;
        if (variables.projectId) {
          targetProjectId = variables.projectId;
        }
      }

      if (!targetProjectId) throw new Error('Project ID is required');
      if (!templateKey) throw new Error('Template key is required');

      return applyTemplate(targetProjectId, templateKey);
    },
    onSuccess: (data, variables) => {
      const createdCount = data?.createdCount ?? 0;
      const countLabel = `${createdCount} ${createdCount === 1 ? 'task' : 'tasks'}`;
      toast.success(`Successfully added ${countLabel}`);

      const targetProjectId =
        (typeof variables === 'object' && variables?.projectId) || projectId;

      if (targetProjectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list(targetProjectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(targetProjectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.dashboard(targetProjectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.calendar(targetProjectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.deadlines(targetProjectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.activity(targetProjectId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list() });

      options?.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      const status = error?.response?.status;
      if (status === 404) {
        toast.error('This template is no longer available');
      } else {
        const message =
          error?.response?.data?.message || error?.message || 'Failed to apply template';
        toast.error(message);
      }
      options?.onError?.(error, variables);
    },
  });
};

export default {
  useTemplates,
  useApplyTemplate,
};
