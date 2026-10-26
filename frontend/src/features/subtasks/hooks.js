import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { queryKeys } from '../../lib/queryKeys';
import { getErrorMessage } from '../../lib/errors';
import { getSubtasks, createSubtask } from './api';

/**
 * Hook to retrieve subtasks for a parent task.
 * GET /api/tasks/{parentTaskId}/subtasks
 */
export const useSubtasks = (taskId) => {
  return useQuery({
    queryKey: queryKeys.tasks.subtasks(taskId || ''),
    queryFn: () => getSubtasks(taskId),
    enabled: Boolean(taskId),
  });
};

/**
 * Hook to create a subtask under a parent task.
 * POST /api/tasks/{parentId}/subtasks
 */
export const useCreateSubtask = (parentId, projectId, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => {
      const targetParentId = payload?.parentId || parentId;
      if (!targetParentId) throw new Error('Parent task ID is required');
      return createSubtask(targetParentId, payload);
    },
    onSuccess: (data, variables) => {
      toast.success('Subtask created successfully');

      const targetParentId = variables?.parentId || parentId;
      const targetProjectId = variables?.projectId || projectId;

      if (targetParentId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.tasks.subtasks(targetParentId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.tasks.detail(targetParentId),
        });
      }

      if (targetProjectId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.tasks.list(targetProjectId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.detail(targetProjectId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.dashboard(targetProjectId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.activity(targetProjectId),
        });
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list() });

      options?.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      const message =
        error?.response?.data?.message ||
        getErrorMessage(error) ||
        'Failed to create subtask';
      toast.error(message);
      options?.onError?.(error, variables);
    },
  });
};

export default {
  useSubtasks,
  useCreateSubtask,
};
