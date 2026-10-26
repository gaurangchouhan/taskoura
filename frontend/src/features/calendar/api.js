import { apiClient } from '../../services/api';

/**
 * GET /api/projects/{projectId}/calendar?month=YYYY-MM
 * -> { projectDeadline, days: [{ date, tasks: [{ id, title, status, priority, assignedTo, assignedToName }] }] }
 */
export async function getCalendar(projectId, month) {
  if (!projectId) throw new Error('Project ID is required');
  const params = month ? { month } : {};
  const response = await apiClient.get(`/api/projects/${projectId}/calendar`, { params });
  return response.data;
}

/**
 * GET /api/projects/{projectId}/deadlines/upcoming?withinDays=7
 * -> [{ taskId, title, deadline, status, priority, assignedToName, daysRemaining }]
 */
export async function getUpcomingDeadlines(projectId, withinDays = 7) {
  if (!projectId) throw new Error('Project ID is required');
  const response = await apiClient.get(`/api/projects/${projectId}/deadlines/upcoming`, {
    params: { withinDays: Number(withinDays) || 7 },
  });
  return response.data;
}

export const calendarApi = {
  getCalendar,
  getUpcomingDeadlines,
};

export default calendarApi;
