import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { queryKeys } from '../lib/queryKeys';
import { getProjects, getProject, createProject, deleteProject } from '../services/projectService';
import { Project, CreateProjectRequest } from '../types/project';

export const useProjects = () => {
  return useQuery<Project[]>({
    queryKey: queryKeys.projects.list(),
    queryFn: getProjects,
  });
};

export const useProject = (projectId?: string) => {
  const queryClient = useQueryClient();

  return useQuery<Project>({
    queryKey: queryKeys.projects.detail(projectId || ''),
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required');
      }
      try {
        return await getProject(projectId);
      } catch (err: any) {
        if (err?.response?.status === 404 || err?.status === 404) {
          throw err;
        }
        // Fallback: derive single project from projects list cache
        const cached = queryClient.getQueryData<Project[]>(queryKeys.projects.list());
        const found = cached?.find((p) => p.id === projectId);
        if (found) {
          return found;
        }
        throw err;
      }
    },
    enabled: Boolean(projectId),
    placeholderData: () => {
      if (!projectId) return undefined;
      const cached = queryClient.getQueryData<Project[]>(queryKeys.projects.list());
      return cached?.find((p) => p.id === projectId);
    },
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation<Project, Error, CreateProjectRequest>({
    mutationFn: (payload: CreateProjectRequest) => createProject(payload),
    onSuccess: (newProject) => {
      // Invalidation per INVALIDATION MAP
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list() });
      if (newProject?.id) {
        queryClient.setQueryData(queryKeys.projects.detail(newProject.id), newProject);
      }
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<void, any, string>({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: (_, projectId) => {
      toast.success('Project deleted successfully');
      navigate('/app/projects');
      queryClient.removeQueries({ queryKey: ['projects', projectId] });
      queryClient.removeQueries({ queryKey: ['tasks', 'list', projectId] });
      queryClient.removeQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            (key[0] === 'projects' && key[1] === projectId) ||
            (key[0] === 'tasks' && key[2] === projectId)
          );
        },
      });
      queryClient.setQueryData<Project[]>(queryKeys.projects.list(), (old) =>
        old ? old.filter((p) => p.id !== projectId) : []
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list() });
    },
    onError: (err: any, projectId) => {
      const status = err?.response?.status || err?.status;
      if (status === 403) {
        toast.error('Only the project owner can delete this project');
      } else if (status === 404) {
        toast.error('Project not found or already deleted');
        navigate('/app/projects');
        queryClient.removeQueries({ queryKey: ['projects', projectId] });
        queryClient.removeQueries({ queryKey: ['tasks', 'list', projectId] });
        queryClient.removeQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return (
              (key[0] === 'projects' && key[1] === projectId) ||
              (key[0] === 'tasks' && key[2] === projectId)
            );
          },
        });
        queryClient.setQueryData<Project[]>(queryKeys.projects.list(), (old) =>
          old ? old.filter((p) => p.id !== projectId) : []
        );
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.list() });
      } else {
        toast.error(err?.response?.data?.message || err?.message || 'Failed to delete project');
      }
    },
  });
};

export default {
  useProjects,
  useProject,
  useCreateProject,
  useDeleteProject,
};

