export type TaskCategory =
  | 'Frontend'
  | 'Backend'
  | 'Database'
  | 'Testing'
  | 'Documentation'
  | 'Bug';

export type Priority = 'High' | 'Medium' | 'Low';

export type TaskStatus = 'Backlog' | 'InProgress' | 'Testing' | 'Completed';
export type KanbanStatus = TaskStatus | 'Review'; // 'Review' mapped to 'Testing'

export interface UserSummary {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  priority: Priority;
  status: TaskStatus;
  assignedTo?: string; // UUID from backend
  deadline?: string;   // 'YYYY-MM-DD'
  completedAt?: string;
  parentTaskId?: string;
  subtaskCount?: number;
  completedSubtaskCount?: number;
  createdAt?: string;
  updatedAt?: string | null;
  createdBy?: UserSummary | null;
  updatedBy?: UserSummary | null;
  // UI enrichment
  assignedToName?: string;
  assignedToAvatar?: string;
  progress?: number;
  tags?: string[];
}

export type TaskResponse = Task;

export interface CreateTaskRequest {
  title: string;
  description?: string;
  category: TaskCategory | string;
  priority: Priority | string;
  assignedTo?: string;
  deadline?: string;
  // Never send status in create
}

export interface UpdateTaskRequest {
  title: string;
  description: string;
  category: TaskCategory | string;
  priority: Priority | string;
  assignedTo: string | null;
  deadline: string | null;
}

export interface UpdateTaskStatusRequest {
  status: TaskStatus;
}

export interface TaskStatusLog {
  id: string;
  fromStatus: string;
  toStatus: string;
  changedByUserId?: string;
  changedByName?: string;
  changedAt: string;
}
