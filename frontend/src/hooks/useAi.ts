import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { queryKeys } from '../lib/queryKeys';
import { aiService } from '../services/aiService';
import {
  ConfirmProjectPlanRequest,
  ConfirmProjectPlanResponse,
  GenerateProjectPlanResponse,
  GenerateTestCasesResponse,
  NextTaskRecommendationResponse,
} from '../types/ai';

export const useGenerateTestCases = (taskId?: string) => {
  return useMutation<GenerateTestCasesResponse, Error, void>({
    mutationFn: () => {
      if (!taskId) throw new Error('Task ID is required');
      return aiService.generateTestCases(taskId);
    },
    retry: false,
  });
};

export const useGeneratePlan = (projectId?: string) => {
  return useMutation<GenerateProjectPlanResponse, Error, void>({
    mutationFn: () => {
      if (!projectId) throw new Error('Project ID is required');
      return aiService.generatePlan(projectId);
    },
    retry: false,
  });
};

export const useConfirmPlan = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation<ConfirmProjectPlanResponse, Error, ConfirmProjectPlanRequest>({
    mutationFn: (payload: ConfirmProjectPlanRequest) => {
      return aiService.confirmPlan(payload);
    },
    onSuccess: (data) => {
      toast.success(`Created ${data.createdCount} tasks from AI plan`);
      // Invalidation per map
      queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.list(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.activity(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.dashboard(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.detail(projectId),
      });
    },
    onError: (err: unknown) => {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to confirm project plan';
      toast.error(message || 'Failed to confirm project plan');
    },
    retry: false,
  });
};

export const useNextTask = (projectId?: string) => {
  return useQuery<NextTaskRecommendationResponse, Error>({
    queryKey: projectId ? queryKeys.ai.nextTask(projectId) : ['ai', 'nextTask', 'null'],
    queryFn: () => {
      if (!projectId) throw new Error('Project ID is required');
      return aiService.getNextTask(projectId);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // No automatic retries
    enabled: Boolean(projectId),
  });
};
