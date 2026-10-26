import { apiClient } from './api';
import {
  DashboardStats,
  ProjectReportData,
  normalizeDashboard,
  normalizeReport,
} from '../types/dashboard';

export const dashboardService = {
  getDashboard: async (projectId: string): Promise<DashboardStats> => {
    const { data } = await apiClient.get(`/api/projects/${projectId}/dashboard`);
    return normalizeDashboard(data);
  },

  getReport: async (projectId: string): Promise<ProjectReportData> => {
    const { data } = await apiClient.get(`/api/projects/${projectId}/report`);
    return normalizeReport(data);
  },
};

export default dashboardService;
