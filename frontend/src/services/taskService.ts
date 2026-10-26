import { apiClient } from './api';
import { Task, CreateTaskRequest, UpdateTaskRequest, TaskStatus, TaskStatusLog } from '../types/task';

export const getTasks = async (projectId: string): Promise<Task[]> => {
  const { data } = await apiClient.get<Task[]>(`/api/projects/${projectId}/tasks`);
  return data;
};

export const getTask = async (taskId: string): Promise<Task> => {
  const { data } = await apiClient.get<Task>(`/api/tasks/${taskId}`);
  return data;
};

export const createTask = async (
  projectId: string,
  payload: CreateTaskRequest
): Promise<Task> => {
  const { data } = await apiClient.post<Task>(`/api/projects/${projectId}/tasks`, payload);
  return data;
};

export const updateTask = async (
  taskId: string,
  payload: UpdateTaskRequest
): Promise<Task> => {
  const { data } = await apiClient.put<Task>(`/api/tasks/${taskId}`, payload);
  return data;
};

export const deleteTask = async (taskId: string): Promise<void> => {
  await apiClient.delete(`/api/tasks/${taskId}`);
};

export const updateTaskStatus = async (
  taskId: string,
  status: TaskStatus
): Promise<Task> => {
  const { data } = await apiClient.patch<Task>(`/api/tasks/${taskId}/status`, { status });
  return data;
};

export const getStatusLogs = async (taskId: string): Promise<TaskStatusLog[]> => {
  const { data } = await apiClient.get<TaskStatusLog[]>(`/api/tasks/${taskId}/status-logs`);
  return data;
};

export const taskService = {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  getStatusLogs,
  // Backwards-compatible aliases
  getByProject: getTasks,
  getById: getTask,
  create: createTask,
  update: updateTask,
  delete: deleteTask,
  updateStatus: (taskId: string, status: TaskStatus) => updateTaskStatus(taskId, status),
};

export default taskService;
