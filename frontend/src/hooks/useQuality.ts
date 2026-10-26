import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { queryKeys } from '../lib/queryKeys';
import { qualityService } from '../services/qualityService';
import {
  Bug,
  CreateBugRequest,
  TestCase,
  CreateTestCaseRequest,
} from '../types/quality';

export const useBugs = (taskId?: string) => {
  return useQuery({
    queryKey: taskId ? queryKeys.bugs.byTask(taskId) : ['tasks', 'null', 'bugs'],
    queryFn: () => {
      if (!taskId) throw new Error('Task ID is required');
      return qualityService.getBugs(taskId);
    },
    enabled: Boolean(taskId),
  });
};

export const useReportBug = (taskId: string, projectId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateBugRequest) => {
      return qualityService.reportBug(taskId, payload);
    },
    onSuccess: () => {
      toast.success('Bug reported successfully');
      queryClient.invalidateQueries({
        queryKey: queryKeys.bugs.byTask(taskId),
      });
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.bugs.list(projectId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.activity(projectId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.dashboard(projectId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.report(projectId),
        });
      }
    },
    onError: (err: unknown) => {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to report bug';
      toast.error(message || 'Failed to report bug');
    },
  });
};

export const useResolveBug = (taskId: string, projectId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bugId: string) => {
      return qualityService.resolveBug(bugId);
    },
    onMutate: async (bugId: string) => {
      // 1. Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.bugs.byTask(taskId),
      });

      // 2. Snapshot previous value
      const previousBugs = queryClient.getQueryData<Bug[]>(
        queryKeys.bugs.byTask(taskId)
      );

      // 3. Optimistically mark bug as Resolved
      if (previousBugs) {
        queryClient.setQueryData<Bug[]>(
          queryKeys.bugs.byTask(taskId),
          previousBugs.map((bug) =>
            bug.id === bugId
              ? { ...bug, status: 'Resolved', resolvedAt: new Date().toISOString() }
              : bug
          )
        );
      }

      return { previousBugs };
    },
    onError: (_err: unknown, _bugId, context) => {
      if (context?.previousBugs) {
        queryClient.setQueryData(
          queryKeys.bugs.byTask(taskId),
          context.previousBugs
        );
      }
      toast.error('Failed to resolve bug');
    },
    onSuccess: () => {
      toast.success('Bug resolved');
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.bugs.byTask(taskId),
      });
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.bugs.list(projectId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.activity(projectId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.dashboard(projectId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.report(projectId),
        });
      }
    },
  });
};

export const useTestCases = (taskId?: string) => {
  return useQuery({
    queryKey: taskId ? queryKeys.testCases.byTask(taskId) : ['tasks', 'null', 'testCases'],
    queryFn: () => {
      if (!taskId) throw new Error('Task ID is required');
      return qualityService.getTestCases(taskId);
    },
    enabled: Boolean(taskId),
  });
};

export const useAddTestCase = (taskId: string, projectId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTestCaseRequest) => {
      return qualityService.addTestCase(taskId, payload);
    },
    onSuccess: () => {
      toast.success('Test case added successfully');
      queryClient.invalidateQueries({
        queryKey: queryKeys.testCases.byTask(taskId),
      });
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.testCases.list(projectId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.activity(projectId),
        });
      }
    },
    onError: (err: unknown) => {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to add test case';
      toast.error(message || 'Failed to add test case');
    },
  });
};
