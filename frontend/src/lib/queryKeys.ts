export const queryKeys = {
  health: ['health'] as const,
  auth: {
    me: ['auth', 'me'] as const,
  },
  users: {
    all: ['users'] as const,
    me: ['users', 'me'] as const,
    detail: (id: string) => ['users', id] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: () => ['projects', 'list'] as const,
    detail: (id: string) => ['projects', id] as const,
    members: (id: string) => ['projects', id, 'members'] as const,
    activity: (id: string) => ['projects', id, 'activity'] as const,
    calendar: (id: string, month?: string) =>
      month ? (['projects', id, 'calendar', month] as const) : (['projects', id, 'calendar'] as const),
    deadlines: (id: string, days?: number) =>
      days !== undefined ? (['projects', id, 'deadlines', days] as const) : (['projects', id, 'deadlines'] as const),
    dashboard: (id: string) => ['projects', id, 'dashboard'] as const,
    report: (id: string) => ['projects', id, 'report'] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    list: (projectId: string, filters?: Record<string, unknown>) =>
      ['tasks', 'list', projectId, filters] as const,
    detail: (id: string) => ['tasks', id] as const,
    subtasks: (taskId: string) => ['tasks', taskId, 'subtasks'] as const,
    comments: (taskId: string) => ['tasks', taskId, 'comments'] as const,
    attachments: (taskId: string) => ['tasks', taskId, 'attachments'] as const,
    statusLogs: (taskId: string) => ['tasks', taskId, 'statusLogs'] as const,
    bugs: (taskId: string) => ['tasks', taskId, 'bugs'] as const,
    testCases: (taskId: string) => ['tasks', taskId, 'testCases'] as const,
  },
  bugs: {
    all: ['bugs'] as const,
    list: (projectId: string) => ['bugs', 'list', projectId] as const,
    byTask: (taskId: string) => ['tasks', taskId, 'bugs'] as const,
    detail: (id: string) => ['bugs', id] as const,
  },
  testCases: {
    all: ['testCases'] as const,
    list: (projectId: string) => ['testCases', 'list', projectId] as const,
    byTask: (taskId: string) => ['tasks', taskId, 'testCases'] as const,
  },
  ai: {
    all: ['ai'] as const,
    nextTask: (projectId: string) => ['ai', 'nextTask', projectId] as const,
    projectPlan: (projectId: string) => ['ai', 'projectPlan', projectId] as const,
    testCases: (taskId: string) => ['ai', 'testCases', taskId] as const,
  },
  templates: {
    all: ['templates'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (unreadOnly?: boolean) => ['notifications', 'list', unreadOnly] as const,
    unreadCount: () => ['notifications', 'unreadCount'] as const,
  },
} as const;
