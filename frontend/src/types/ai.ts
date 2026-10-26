// AI Feature 1: Test Cases
export interface GeneratedTestCase {
  title: string;
  expectedResult: string;
}

export interface GenerateTestCasesRequest {
  taskId: string;
}

export interface GenerateTestCasesResponse {
  testCases: GeneratedTestCase[];
}

// AI Feature 2: Project Plan
export interface PlanTask {
  title: string;
  category: string;
  priority: string;
  description?: string;
}

export interface PlanModule {
  name: string;
  tasks: PlanTask[];
}

export interface GenerateProjectPlanRequest {
  projectId: string;
}

export interface GenerateProjectPlanResponse {
  modules: PlanModule[];
}

export interface ConfirmProjectPlanRequest {
  projectId: string;
  modules: PlanModule[];
}

export interface ConfirmProjectPlanResponse {
  createdCount: number;
  taskIds: string[];
}

// AI Feature 3: Next Task Recommendation
export interface NextTaskRecommendationResponse {
  recommendation: string;
  relatedTaskId: string | null;
}
