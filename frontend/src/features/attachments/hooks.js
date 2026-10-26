import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { queryKeys } from '../../lib/queryKeys';
import {
  getAttachments,
  uploadAttachment,
  deleteAttachment,
} from './api';

/**
 * Fetch attachments for a specific task.
 */
export const useAttachments = (taskId) => {
  return useQuery({
    queryKey: taskId ? queryKeys.tasks.attachments(taskId) : ['tasks', 'null', 'attachments'],
    queryFn: () => {
      if (!taskId) throw new Error('Task ID is required');
      return getAttachments(taskId);
    },
    enabled: Boolean(taskId),
  });
};

/**
 * Hook to upload an attachment to a task with upload progress tracking.
 * Invalidate per the INVALIDATION MAP on completion.
 */
export const useUploadAttachment = (taskId, options = {}) => {
  const queryClient = useQueryClient();
  const projectId = typeof options === 'string' ? options : options?.projectId;
  const defaultOnProgress = typeof options === 'object' ? options?.onUploadProgress : undefined;

  return useMutation({
    mutationFn: async (variables) => {
      let file;
      let onProgress = defaultOnProgress;

      if (variables instanceof File || (typeof Blob !== 'undefined' && variables instanceof Blob)) {
        file = variables;
      } else if (variables && variables.file) {
        file = variables.file;
        if (typeof variables.onUploadProgress === 'function') {
          onProgress = variables.onUploadProgress;
        }
      } else {
        throw new Error('File is required for upload');
      }

      return uploadAttachment(taskId, file, onProgress);
    },
    onSuccess: (saved) => {
      toast.success('File uploaded successfully');
      queryClient.setQueryData(
        queryKeys.tasks.attachments(taskId),
        (old = []) => {
          const exists = old.some((item) => item.id === saved.id);
          return exists ? old : [...old, saved];
        }
      );
    },
    onError: (err) => {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to upload file. Please try again.';
      toast.error(message);
    },
    onSettled: () => {
      // Invalidation per INVALIDATION MAP
      queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.attachments(taskId),
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

/**
 * Hook to delete an attachment with permission enforcement.
 * Shows backend message on 403 error.
 * Invalidate per the INVALIDATION MAP on completion.
 */
export const useDeleteAttachment = (taskId, options = {}) => {
  const queryClient = useQueryClient();
  const projectId = typeof options === 'string' ? options : options?.projectId;

  return useMutation({
    mutationFn: async (attachmentId) => {
      return deleteAttachment(attachmentId);
    },
    onMutate: async (attachmentId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.tasks.attachments(taskId),
      });

      const previous = queryClient.getQueryData(queryKeys.tasks.attachments(taskId));

      queryClient.setQueryData(
        queryKeys.tasks.attachments(taskId),
        (old = []) => old.filter((item) => item.id !== attachmentId)
      );

      return { previous };
    },
    onSuccess: () => {
      toast.success('Attachment deleted successfully');
    },
    onError: (err, _attachmentId, context) => {
      // Rollback optimistic removal
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.tasks.attachments(taskId),
          context.previous
        );
      }

      // Backend 403 or other error messages
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete attachment';
      toast.error(message);
    },
    onSettled: () => {
      // Invalidation per INVALIDATION MAP
      queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.attachments(taskId),
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

export default {
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
};
