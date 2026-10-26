import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { queryKeys } from '../lib/queryKeys';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  getStatusLogs,
} from '../services/taskService';
import { Task, CreateTaskRequest, UpdateTaskRequest, TaskStatus, TaskStatusLog } from '../types/task';
import { getErrorMessage } from '../lib/errors';

export const useTasks = (projectId?: string) => {
  return useQuery<Task[]>({
    queryKey: queryKeys.tasks.list(projectId || ''),
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required');
      return await getTasks(projectId);
    },
    enabled: Boolean(projectId),
  });
};

export const useTask = (taskId?: string) => {
  return useQuery<Task>({
    queryKey: queryKeys.tasks.detail(taskId || ''),
    queryFn: async () => {
      if (!taskId) throw new Error('Task ID is required');
      return await getTask(taskId);
    },
    enabled: Boolean(taskId),
  });
};

export const useCreateTask = (defaultProjectId?: string) => {
  const queryClient = useQueryClient();

  return useMutation<
    Task,
    Error,
    { projectId?: string; task: CreateTaskRequest } | CreateTaskRequest
  >({
    mutationFn: (variables) => {
      let pId = defaultProjectId;
      let payload: CreateTaskRequest;

      if ('task' in variables && variables.task) {
        pId = variables.projectId || defaultProjectId;
        payload = variables.task;
      } else {
        payload = variables as CreateTaskRequest;
      }

      if (!pId) throw new Error('Project ID is required');
      // Ensure status is never sent
      const { title, description, category, priority, assignedTo, deadline } = payload;
      const cleanPayload: CreateTaskRequest = {
        title,
        category,
        priority,
        ...(description !== undefined ? { description } : {}),
        ...(assignedTo !== undefined ? { assignedTo } : {}),
        ...(deadline !== undefined ? { deadline } : {}),
      };

      return createTask(pId, cleanPayload);
    },
    onSuccess: (_, variables) => {
      const pId = ('projectId' in variables && variables.projectId) ? variables.projectId : defaultProjectId;
      if (pId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.dashboard(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.calendar(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.deadlines(pId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
};

export interface UpdateTaskStatusVariables {
  taskId: string;
  status: TaskStatus;
  projectId?: string;
}

export const useUpdateTaskStatus = (defaultProjectId?: string) => {
  const queryClient = useQueryClient();

  return useMutation<
    Task,
    Error,
    UpdateTaskStatusVariables,
    { previousTasks?: Task[]; pId?: string }
  >({
    mutationFn: ({ taskId, status }) => {
      return updateTaskStatus(taskId, status);
    },
    onMutate: async ({ taskId, status, projectId }) => {
      const pId = projectId || defaultProjectId;
      if (!pId) return {};

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.list(pId) });

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData<Task[]>(queryKeys.tasks.list(pId));

      // Optimistically update the task status in the cache
      if (previousTasks) {
        queryClient.setQueryData<Task[]>(
          queryKeys.tasks.list(pId),
          previousTasks.map((t) => (t.id === taskId ? { ...t, status } : t))
        );
      }

      return { previousTasks, pId };
    },
    onError: (err, variables, context) => {
      const pId = context?.pId || variables.projectId || defaultProjectId;
      if (pId && context?.previousTasks) {
        // Rollback on failure
        queryClient.setQueryData(queryKeys.tasks.list(pId), context.previousTasks);
      }
      toast.error(getErrorMessage(err) || 'Failed to update task status');
    },
    onSettled: (_, __, variables, context) => {
      const pId = context?.pId || variables.projectId || defaultProjectId;
      if (pId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.report(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.calendar(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.deadlines(pId) });
      }
      if (variables.taskId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.statusLogs(variables.taskId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
};

export const useStatusLogs = (taskId?: string) => {
  return useQuery<TaskStatusLog[]>({
    queryKey: queryKeys.tasks.statusLogs(taskId || ''),
    queryFn: async () => {
      if (!taskId) throw new Error('Task ID is required');
      return await getStatusLogs(taskId);
    },
    enabled: Boolean(taskId),
  });
};

export interface UpdateTaskVariables {
  taskId: string;
  task: UpdateTaskRequest;
  projectId?: string;
}

export const useUpdateTask = (defaultProjectId?: string) => {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, UpdateTaskVariables>({
    mutationFn: ({ taskId, task }) => {
      return updateTask(taskId, task);
    },
    onSuccess: (updatedTask, variables) => {
      const pId = variables.projectId || defaultProjectId;
      // 1. Replace the cached task with the response
      queryClient.setQueryData(queryKeys.tasks.detail(updatedTask.id), updatedTask);
      if (pId) {
        queryClient.setQueryData<Task[]>(queryKeys.tasks.list(pId), (old) =>
          old ? old.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t)) : old
        );
        // Invalidate tasks, dashboard, calendar, upcoming, activity and report
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.dashboard(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.calendar(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.deadlines(pId) });
        queryClient.invalidateQueries({ queryKey: ['projects', pId, 'upcoming'] });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.activity(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.report(pId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
};

export interface DeleteTaskVariables {
  taskId: string;
  projectId?: string;
}

export const useDeleteTask = (defaultProjectId?: string) => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteTaskVariables>({
    mutationFn: ({ taskId }) => {
      return deleteTask(taskId);
    },
    onSuccess: (_, variables) => {
      const pId = variables.projectId || defaultProjectId;
      if (pId) {
        // Invalidate tasks, dashboard, calendar, upcoming, activity and report
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.dashboard(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.calendar(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.deadlines(pId) });
        queryClient.invalidateQueries({ queryKey: ['projects', pId, 'upcoming'] });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.activity(pId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.report(pId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });

      // Remove that task's per-task queries from the cache
      queryClient.removeQueries({ queryKey: queryKeys.tasks.detail(variables.taskId) });
      queryClient.removeQueries({ queryKey: queryKeys.tasks.subtasks(variables.taskId) });
      queryClient.removeQueries({ queryKey: queryKeys.tasks.comments(variables.taskId) });
      queryClient.removeQueries({ queryKey: queryKeys.tasks.attachments(variables.taskId) });
      queryClient.removeQueries({ queryKey: queryKeys.tasks.statusLogs(variables.taskId) });
      queryClient.removeQueries({ queryKey: queryKeys.tasks.bugs(variables.taskId) });
      queryClient.removeQueries({ queryKey: queryKeys.tasks.testCases(variables.taskId) });
      queryClient.removeQueries({ queryKey: ['ai', 'testCases', variables.taskId] });
      queryClient.removeQueries({ queryKey: ['tasks', variables.taskId] });
    },
  });
};

export default {
  useTasks,
  useTask,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useUpdateTaskStatus,
  useStatusLogs,
};
