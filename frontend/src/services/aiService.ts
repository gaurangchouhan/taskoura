import { apiClient } from './api';
import {
  GenerateTestCasesResponse,
  GenerateProjectPlanResponse,
  ConfirmProjectPlanRequest,
  ConfirmProjectPlanResponse,
  NextTaskRecommendationResponse,
} from '../types/ai';

export const aiService = {
  generateTestCases: async (taskId: string): Promise<GenerateTestCasesResponse> => {
    const { data } = await apiClient.post<GenerateTestCasesResponse>('/api/ai/test-cases', {
      taskId,
    });
    return data;
  },

  generatePlan: async (projectId: string): Promise<GenerateProjectPlanResponse> => {
    const { data } = await apiClient.post<GenerateProjectPlanResponse>('/api/ai/project-plan', {
      projectId,
    });
    return data;
  },

  confirmPlan: async (payload: ConfirmProjectPlanRequest): Promise<ConfirmProjectPlanResponse> => {
    const { data } = await apiClient.post<ConfirmProjectPlanResponse>(
      '/api/ai/project-plan/confirm',
      payload
    );
    return data;
  },

  getNextTask: async (projectId: string): Promise<NextTaskRecommendationResponse> => {
    const { data } = await apiClient.get<NextTaskRecommendationResponse>(
      `/api/ai/next-task/${projectId}`
    );
    return data;
  },
};

export default aiService;
