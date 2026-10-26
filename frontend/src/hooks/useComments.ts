import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { queryKeys } from '../lib/queryKeys';
import { commentService } from '../services/commentService';
import { Comment, CreateCommentRequest } from '../types/comment';
import { useAuth } from '../context/AuthContext';

export const useComments = (taskId?: string) => {
  return useQuery({
    queryKey: taskId ? queryKeys.tasks.comments(taskId) : ['tasks', 'null', 'comments'],
    queryFn: () => {
      if (!taskId) throw new Error('Task ID is required');
      return commentService.getComments(taskId);
    },
    enabled: Boolean(taskId),
  });
};

export const useAddComment = (taskId: string, projectId?: string) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (payload: CreateCommentRequest) => {
      return commentService.addComment(taskId, payload);
    },
    onMutate: async (newCommentRequest) => {
      // 1. Cancel ongoing comment queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.tasks.comments(taskId),
      });

      // 2. Snapshot previous value
      const previousComments = queryClient.getQueryData<Comment[]>(
        queryKeys.tasks.comments(taskId)
      );

      // 3. Optimistically add comment to cache
      const optimisticComment: Comment = {
        id: `optimistic-${Date.now()}`,
        taskId,
        userId: user?.id || 'current-user',
        userName: user?.name || 'You',
        content: newCommentRequest.content.trim(),
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<Comment[]>(
        queryKeys.tasks.comments(taskId),
        (old = []) => [...old, optimisticComment]
      );

      return { previousComments };
    },
    onError: (err: unknown, _variables, context) => {
      // Rollback to previous comments on failure
      if (context?.previousComments) {
        queryClient.setQueryData(
          queryKeys.tasks.comments(taskId),
          context.previousComments
        );
      }
      const message = (err as Error)?.message || 'Failed to post comment. Please try again.';
      toast.error(message);
    },
    onSuccess: (savedComment) => {
      // Replace optimistic or refresh
      queryClient.setQueryData<Comment[]>(
        queryKeys.tasks.comments(taskId),
        (old = []) => {
          // Filter out optimistic comments and append/replace
          const withoutOptimistic = old.filter((c) => !c.id.startsWith('optimistic-'));
          const exists = withoutOptimistic.some((c) => c.id === savedComment.id);
          return exists ? withoutOptimistic : [...withoutOptimistic, savedComment];
        }
      );
    },
    onSettled: () => {
      // Invalidate per invalidation map
      queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.comments(taskId),
      });
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.activity(projectId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.tasks.list(projectId),
        });
      }
    },
  });
};
