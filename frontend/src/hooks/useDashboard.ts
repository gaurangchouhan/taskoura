import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { dashboardService } from '../services/dashboardService';
import { DashboardStats, ProjectReportData } from '../types/dashboard';

export const useDashboard = (projectId?: string) => {
  return useQuery<DashboardStats, Error>({
    queryKey: projectId ? queryKeys.projects.dashboard(projectId) : ['projects', 'null', 'dashboard'],
    queryFn: () => {
      if (!projectId) throw new Error('Project ID is required');
      return dashboardService.getDashboard(projectId);
    },
    enabled: Boolean(projectId),
  });
};

export const useReport = (projectId?: string, enabled: boolean = true) => {
  return useQuery<ProjectReportData, Error>({
    queryKey: projectId ? queryKeys.projects.report(projectId) : ['projects', 'null', 'report'],
    queryFn: () => {
      if (!projectId) throw new Error('Project ID is required');
      return dashboardService.getReport(projectId);
    },
    enabled: Boolean(projectId) && enabled,
    retry: (failureCount, error: unknown) => {
      // Don't retry on 403 Forbidden
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 403) return false;
      return failureCount < 2;
    },
  });
};

export default {
  useDashboard,
  useReport,
};
