export type TaskCategory = 
  | 'Frontend' 
  | 'Backend' 
  | 'Database' 
  | 'Testing' 
  | 'Documentation' 
  | 'Bug';

export type Priority = 'High' | 'Medium' | 'Low';

export type KanbanStatus = 'Backlog' | 'InProgress' | 'Review' | 'Completed';

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  priority: Priority;
  status: KanbanStatus;
  assignedTo?: string;
  assignedToName?: string;
  assignedToAvatar?: string;
  deadline?: string;
  progress?: number;
  subtaskCount?: number;
  completedSubtaskCount?: number;
  tags?: string[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  frontendStack?: string;
  backendStack?: string;
  databaseStack?: string;
  testingStack?: string;
  deadline?: string;
  role?: 'Owner' | 'Member';
  createdAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
}

export interface Bug {
  id: string;
  projectId: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'InProgress' | 'Resolved' | 'Closed';
  assignedTo?: string;
  createdAt?: string;
}

export interface TestCase {
  id: string;
  projectId: string;
  title: string;
  status: 'Passed' | 'Failed' | 'Pending';
  lastRun?: string;
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
