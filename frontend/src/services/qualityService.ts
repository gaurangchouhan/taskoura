import { apiClient } from './api';
import {
  Bug,
  CreateBugRequest,
  TestCase,
  CreateTestCaseRequest,
} from '../types/quality';

export const qualityService = {
  getBugs: async (taskId: string): Promise<Bug[]> => {
    const { data } = await apiClient.get<Bug[]>(`/api/tasks/${taskId}/bugs`);
    return data;
  },

  reportBug: async (taskId: string, payload: CreateBugRequest): Promise<Bug> => {
    const { data } = await apiClient.post<Bug>(`/api/tasks/${taskId}/bugs`, payload);
    return data;
  },

  resolveBug: async (bugId: string): Promise<Bug> => {
    const { data } = await apiClient.patch<Bug>(`/api/bugs/${bugId}/resolve`);
    return data;
  },

  getTestCases: async (taskId: string): Promise<TestCase[]> => {
    const { data } = await apiClient.get<TestCase[]>(`/api/tasks/${taskId}/test-cases`);
    return data;
  },

  addTestCase: async (taskId: string, payload: CreateTestCaseRequest): Promise<TestCase> => {
    const { data } = await apiClient.post<TestCase>(`/api/tasks/${taskId}/test-cases`, payload);
    return data;
  },
};

export default qualityService;
