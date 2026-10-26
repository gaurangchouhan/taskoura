export * from './task';
export * from './project';
export * from './member';
export * from './comment';
export * from './quality';
export * from './ai';
export * from './notification';
export * from './activity';
export * from './dashboard';
export * from './attachment';
export * from './template';
export * from './profile';
export type { SessionInfo, AuthResponse, LoginRequest, RegisterRequest } from './auth';

export interface User {
  id: string;
  name: string;
  email: string;
  verified?: boolean;
  createdAt?: string;
  profile?: import('./profile').UserProfileData;
  providers?: string[];
  avatarUrl?: string | null;
}

export interface DashboardAnalytics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  reviewTasks: number;
  backlogTasks: number;
  openBugs: number;
  testPassRate: number;
  sprintProgressPercent: number;
}
