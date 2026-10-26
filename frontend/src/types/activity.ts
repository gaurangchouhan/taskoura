export type ActivityActionType =
  | 'TASK_CREATED'
  | 'TASK_STATUS_CHANGED'
  | 'MEMBER_INVITED'
  | 'COMMENT_ADDED'
  | 'BUG_REPORTED'
  | 'BUG_RESOLVED'
  | 'TEST_CASE_ADDED'
  | string;

export interface ActivityLog {
  id: string;
  projectId: string;
  userId: string;
  userName?: string;
  actionType: ActivityActionType;
  description: string;
  createdAt: string;
}
