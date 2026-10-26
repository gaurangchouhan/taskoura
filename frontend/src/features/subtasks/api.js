import { apiClient } from '../../services/api';

/**
 * Fetch all subtasks for a parent task.
 * GET /api/tasks/{parentTaskId}/subtasks -> Task[]
 */
export async function getSubtasks(parentTaskId) {
  if (!parentTaskId) throw new Error('Parent task ID is required');

  const response = await apiClient.get(`/api/tasks/${parentTaskId}/subtasks`);
  return response.data;
}

/**
 * Create a subtask under a parent task.
 * POST /api/tasks/{parentTaskId}/subtasks -> 201 Task
 * Rejects if parent is itself a subtask (max 1 level of nesting).
 */
export async function createSubtask(parentTaskId, payload) {
  if (!parentTaskId) throw new Error('Parent task ID is required');
  if (!payload?.title?.trim()) throw new Error('Subtask title is required');

  const cleanPayload = {
    title: payload.title.trim(),
    description: payload.description || undefined,
    category: payload.category || 'Backend',
    priority: payload.priority || 'Medium',
    assignedTo: payload.assignedTo || undefined,
    deadline: payload.deadline || undefined,
  };

  const response = await apiClient.post(
    `/api/tasks/${parentTaskId}/subtasks`,
    cleanPayload
  );
  return response.data;
}

export const subtaskApi = {
  getSubtasks,
  createSubtask,
};

export default subtaskApi;
