export interface StatusConfig {
  key: string;
  label: string;
  color: string;
}

export const STATUSES: StatusConfig[] = [
  { key: 'Backlog', label: 'Backlog', color: '#64748b' },
  { key: 'Todo', label: 'To Do', color: '#3b82f6' },
  { key: 'InProgress', label: 'In Progress', color: '#f59e0b' },
  { key: 'InReview', label: 'In Review', color: '#8b5cf6' },
  { key: 'Testing', label: 'Testing', color: '#ec4899' },
  { key: 'Completed', label: 'Completed', color: '#10b981' },
];

export const CATEGORIES = [
  'Frontend',
  'Backend',
  'Database',
  'Testing',
  'Documentation',
  'Bug',
] as const;

export const PRIORITIES = ['High', 'Medium', 'Low'] as const;

export const ROLES = ['Owner', 'Admin', 'Member', 'Viewer'] as const;

export const BUG_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Role = (typeof ROLES)[number];
export type BugSeverity = (typeof BUG_SEVERITIES)[number];
