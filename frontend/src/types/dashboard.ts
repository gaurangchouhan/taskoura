export interface MemberTaskStat {
  userId: string;
  name: string;
  assigned: number;
  completed: number;
}

export interface UpcomingDeadline {
  taskId: string;
  title: string;
  deadline: string;
  status?: string;
  priority?: string;
  assignedToId?: string;
  assignedToName?: string;
}

export interface TasksByStatus {
  Backlog: number;
  InProgress: number;
  Testing: number;
  Completed: number;
  [key: string]: number;
}

export interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  completionPercentage: number;
  tasksByStatus: TasksByStatus;
  tasksByMember: MemberTaskStat[];
  upcomingDeadlines: UpcomingDeadline[];
}

export interface MemberPerformanceReport {
  userId: string;
  name: string;
  tasksAssigned: number;
  tasksCompleted: number;
  onTimeCompletions: number;
  lateCompletions: number;
  averageDelayDays: number;
  reworkCount: number;
  bugsAssigned: number;
  bugsFixed: number;
  avgBugTurnaroundHours: number;
  testCasesExecuted: number;
  testCasesPassed: number;
}

export interface ProjectReportData {
  members: MemberPerformanceReport[];
  aiSummary?: string;
}

export const STATUS_COLORS: Record<string, string> = {
  Backlog: '#64748b',
  InProgress: '#0284c7',
  'In Progress': '#0284c7',
  Testing: '#d97706',
  Completed: '#059669',
};

export function normalizeDashboard(raw: unknown): DashboardStats {
  if (!raw || typeof raw !== 'object') {
    return {
      totalTasks: 0,
      completedTasks: 0,
      completionPercentage: 0,
      tasksByStatus: { Backlog: 0, InProgress: 0, Testing: 0, Completed: 0 },
      tasksByMember: [],
      upcomingDeadlines: [],
    };
  }

  const r = raw as Record<string, unknown>;
  const totalTasks = Number(r.totalTasks) || 0;
  const completedTasks = Number(r.completedTasks) || 0;
  
  // Guard against divide by zero or NaN
  const completionPercentage = totalTasks > 0
    ? typeof r.completionPercentage === 'number'
      ? r.completionPercentage
      : Math.round((completedTasks / totalTasks) * 10000) / 100
    : 0;

  const rawStatus = (r.tasksByStatus || {}) as Record<string, unknown>;
  const tasksByStatus: TasksByStatus = {
    Backlog: Number(rawStatus.Backlog ?? rawStatus.backlog ?? 0),
    InProgress: Number(rawStatus.InProgress ?? rawStatus['In Progress'] ?? rawStatus.inprogress ?? 0),
    Testing: Number(rawStatus.Testing ?? rawStatus.testing ?? rawStatus.Review ?? 0),
    Completed: Number(rawStatus.Completed ?? rawStatus.completed ?? 0),
  };

  const rawMembers = Array.isArray(r.tasksByMember) ? r.tasksByMember : [];
  const tasksByMember: MemberTaskStat[] = rawMembers.map((m: unknown) => {
    const mem = (m || {}) as Record<string, unknown>;
    return {
      userId: String(mem.userId ?? ''),
      name: String(mem.name ?? mem.userName ?? 'Team Member'),
      assigned: Number(mem.assigned ?? mem.assignedTasks ?? 0),
      completed: Number(mem.completed ?? mem.completedTasks ?? 0),
    };
  });

  const rawDeadlines = Array.isArray(r.upcomingDeadlines) ? r.upcomingDeadlines : [];
  const upcomingDeadlines: UpcomingDeadline[] = rawDeadlines.map((d: unknown) => {
    const dl = (d || {}) as Record<string, unknown>;
    return {
      taskId: String(dl.taskId ?? dl.id ?? ''),
      title: String(dl.title ?? ''),
      deadline: String(dl.deadline ?? ''),
      status: dl.status ? String(dl.status) : undefined,
      priority: dl.priority ? String(dl.priority) : undefined,
      assignedToId: dl.assignedToId ? String(dl.assignedToId) : undefined,
      assignedToName: dl.assignedToName ? String(dl.assignedToName) : undefined,
    };
  });

  return {
    totalTasks,
    completedTasks,
    completionPercentage,
    tasksByStatus,
    tasksByMember,
    upcomingDeadlines,
  };
}

export function normalizeMemberReport(m: unknown): MemberPerformanceReport {
  const mem = (m || {}) as Record<string, unknown>;
  return {
    userId: String(mem.userId ?? ''),
    name: String(mem.name ?? mem.userName ?? 'Team Member'),
    tasksAssigned: Number(mem.tasksAssigned ?? 0),
    tasksCompleted: Number(mem.tasksCompleted ?? 0),
    onTimeCompletions: Number(mem.onTimeCompletions ?? 0),
    lateCompletions: Number(mem.lateCompletions ?? 0),
    averageDelayDays: Number(mem.averageDelayDays ?? 0),
    reworkCount: Number(mem.reworkCount ?? 0),
    bugsAssigned: Number(mem.bugsAssigned ?? 0),
    bugsFixed: Number(mem.bugsFixed ?? 0),
    avgBugTurnaroundHours: Number(mem.avgBugTurnaroundHours ?? 0),
    testCasesExecuted: Number(mem.testCasesExecuted ?? 0),
    testCasesPassed: Number(mem.testCasesPassed ?? 0),
  };
}

export function normalizeReport(raw: unknown): ProjectReportData {
  if (!raw) {
    return { members: [] };
  }

  if (Array.isArray(raw)) {
    return {
      members: raw.map(normalizeMemberReport),
    };
  }

  if (typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    const members = Array.isArray(r.members)
      ? r.members.map(normalizeMemberReport)
      : [];
    const aiSummary = typeof r.aiSummary === 'string' ? r.aiSummary : undefined;
    return { members, aiSummary };
  }

  return { members: [] };
}
