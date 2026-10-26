import { apiClient } from './api';
import { Project, CreateProjectRequest } from '../types/project';

export const getProjects = async (): Promise<Project[]> => {
  const { data } = await apiClient.get<Project[]>('/api/projects');
  return data;
};

export const createProject = async (payload: CreateProjectRequest): Promise<Project> => {
  const { data } = await apiClient.post<Project>('/api/projects', payload);
  return data;
};

export const getProject = async (id: string): Promise<Project> => {
  const { data } = await apiClient.get<Project>(`/api/projects/${id}`);
  return data;
};

export const deleteProject = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/projects/${id}`);
};

export const projectService = {
  getProjects,
  createProject,
  getProject,
  deleteProject,
  getAll: getProjects,
  create: createProject,
  getById: getProject,
  delete: deleteProject,
};

export default projectService;
