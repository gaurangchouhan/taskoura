import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { getCalendar, getUpcomingDeadlines } from './api';

/**
 * Fetch calendar data for a project in a given month.
 * GET /api/projects/{projectId}/calendar?month=YYYY-MM
 */
export const useCalendar = (projectId, month) => {
  return useQuery({
    queryKey: queryKeys.projects.calendar(projectId || '', month),
    queryFn: () => {
      if (!projectId) throw new Error('Project ID is required');
      return getCalendar(projectId, month);
    },
    enabled: Boolean(projectId),
  });
};

/**
 * Fetch upcoming deadlines for a project within N days (default: 7).
 * GET /api/projects/{projectId}/deadlines/upcoming?withinDays=7
 */
export const useUpcoming = (projectId, days = 7) => {
  const numericDays = Number(days) || 7;
  return useQuery({
    queryKey: queryKeys.projects.deadlines(projectId || '', numericDays),
    queryFn: () => {
      if (!projectId) throw new Error('Project ID is required');
      return getUpcomingDeadlines(projectId, numericDays);
    },
    enabled: Boolean(projectId),
  });
};

export default {
  useCalendar,
  useUpcoming,
};
