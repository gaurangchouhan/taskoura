import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { notificationService } from '../services/notificationService';
import {
  Notification,
  normalizeNotification,
} from '../types/notification';

export { normalizeNotification };

export interface UseNotificationsOptions {
  unreadOnly?: boolean;
  enabled?: boolean;
  refetchInterval?: number | false;
  isBackground?: boolean;
}

export const useNotifications = (options: UseNotificationsOptions = {}) => {
  const {
    unreadOnly = false,
    enabled = true,
    refetchInterval = 60000, // 60 seconds polling
    isBackground = false,
  } = options;

  return useQuery<Notification[], Error>({
    queryKey: queryKeys.notifications.list(unreadOnly),
    queryFn: ({ meta }) => {
      const background = isBackground || Boolean(meta?.isBackground);
      return notificationService.getNotifications(unreadOnly, background);
    },
    meta: {
      isBackground,
    },
    enabled,
    refetchInterval,
    refetchIntervalInBackground: false, // Paused when the tab is hidden
  });
};

export const useUnreadCount = (options?: { isBackground?: boolean }) => {
  const isBackground = options?.isBackground ?? false;
  const { data: unreadNotifications = [], isLoading, isError } = useNotifications({
    unreadOnly: true,
    refetchInterval: 60000,
    isBackground,
  });

  const count = unreadNotifications.length;
  const displayCount = count > 99 ? '99+' : count;

  return {
    unreadCount: count,
    displayCount,
    hasUnread: count > 0,
    isLoading,
    isError,
  };
};

export interface MarkReadContext {
  prevAll?: Notification[];
  prevUnread?: Notification[];
}

export const useMarkRead = () => {
  const queryClient = useQueryClient();

  return useMutation<Notification, Error, string, MarkReadContext>({
    mutationFn: (id: string) => {
      return notificationService.markRead(id);
    },
    onMutate: async (id: string): Promise<MarkReadContext> => {
      // Cancel active queries
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all });

      // Snapshot previous states
      const prevAll = queryClient.getQueryData<Notification[]>(
        queryKeys.notifications.list(false)
      );
      const prevUnread = queryClient.getQueryData<Notification[]>(
        queryKeys.notifications.list(true)
      );

      // Optimistic update in "All" list
      if (prevAll) {
        queryClient.setQueryData<Notification[]>(
          queryKeys.notifications.list(false),
          prevAll.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
      }

      // Optimistic update in "Unread" list (filter out marked item)
      if (prevUnread) {
        queryClient.setQueryData<Notification[]>(
          queryKeys.notifications.list(true),
          prevUnread.filter((n) => n.id !== id)
        );
      }

      return { prevAll, prevUnread };
    },
    onError: (_err, _id, context) => {
      if (context?.prevAll) {
        queryClient.setQueryData(
          queryKeys.notifications.list(false),
          context.prevAll
        );
      }
      if (context?.prevUnread) {
        queryClient.setQueryData(
          queryKeys.notifications.list(true),
          context.prevUnread
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.list(true),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.list(false),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount(),
      });
    },
  });
};
