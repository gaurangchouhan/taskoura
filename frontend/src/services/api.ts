import axios, { AxiosError } from 'axios';
import { Project, Task, User, Bug, TestCase, KanbanStatus, DashboardAnalytics } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('taskoura_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('taskoura_token');
      localStorage.removeItem('taskoura_user');
    }
    return Promise.reject(error);
  }
);

// Auth Service
export const authService = {
  login: async (credentials: { email: string; password: string }) => {
    const { data } = await apiClient.post<{ token: string; user: User }>('/auth/login', credentials);
    localStorage.setItem('taskoura_token', data.token);
    localStorage.setItem('taskoura_user', JSON.stringify(data.user));
    return data;
  },

  register: async (payload: { name: string; email: string; password: string }) => {
    const { data } = await apiClient.post<User>('/auth/register', payload);
    return data;
  },

  getCurrentUser: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/users/me');
    return data;
  },

  logout: () => {
    localStorage.removeItem('taskoura_token');
    localStorage.removeItem('taskoura_user');
  },

  getStoredUser: (): User | null => {
    const raw = localStorage.getItem('taskoura_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
};

// Projects Service
export const projectService = {
  getAll: async (): Promise<Project[]> => {
    const { data } = await apiClient.get<Project[]>('/projects');
    return data;
  },

  getById: async (id: string): Promise<Project & { members?: Array<{ userId: string; name: string; role: string }> }> => {
    const { data } = await apiClient.get(`/projects/${id}`);
    return data;
  },

  create: async (project: Partial<Project>): Promise<Project> => {
    const { data } = await apiClient.post<Project>('/projects', project);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`);
  },
};

// Tasks Service
export const taskService = {
  getByProject: async (projectId: string, params?: { status?: string; category?: string }): Promise<Task[]> => {
    const { data } = await apiClient.get<Task[]>(`/projects/${projectId}/tasks`, { params });
    return data;
  },

  getById: async (taskId: string): Promise<Task> => {
    const { data } = await apiClient.get<Task>(`/tasks/${taskId}`);
    return data;
  },

  create: async (projectId: string, task: Partial<Task>): Promise<Task> => {
    const { data } = await apiClient.post<Task>(`/projects/${projectId}/tasks`, task);
    return data;
  },

  updateStatus: async (taskId: string, status: KanbanStatus): Promise<Task> => {
    const { data } = await apiClient.patch<Task>(`/tasks/${taskId}/status`, { status });
    return data;
  },

  update: async (taskId: string, task: Partial<Task>): Promise<Task> => {
    const { data } = await apiClient.put<Task>(`/tasks/${taskId}`, task);
    return data;
  },

  delete: async (taskId: string): Promise<void> => {
    await apiClient.delete(`/tasks/${taskId}`);
  },
};

// Bugs & QA
export const qaService = {
  getBugs: async (projectId: string): Promise<Bug[]> => {
    const { data } = await apiClient.get<Bug[]>(`/projects/${projectId}/bugs`);
    return data;
  },

  getTestCases: async (projectId: string): Promise<TestCase[]> => {
    const { data } = await apiClient.get<TestCase[]>(`/projects/${projectId}/test-cases`);
    return data;
  },
};

// AI Tasks
export const aiService = {
  generateTasks: async (projectId: string, prompt: string): Promise<Task[]> => {
    const { data } = await apiClient.post<Task[]>(`/projects/${projectId}/ai-tasks`, { prompt });
    return data;
  },
};
