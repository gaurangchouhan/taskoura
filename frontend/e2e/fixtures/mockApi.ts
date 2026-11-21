import type { Page } from '@playwright/test';

export interface MockOptions {
  taskCount?: number;
  projectTitle?: string;
  projectDesc?: string;
  userName?: string;
  userEmail?: string;
  networkDelayMs?: number;
}

export function createMockJwt(email = 'gaurang@taskoura.dev', name = 'Gaurang Chouhan'): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: email,
      id: 'user-1',
      role: 'Admin',
      name,
      exp: Math.floor(Date.now() / 1000) + 86400,
    })
  ).toString('base64url');
  return `${header}.${payload}.mockSignatureString1234567890`;
}

export async function setupAuth(page: Page, options: MockOptions = {}) {
  const name = options.userName || 'Gaurang Chouhan';
  const email = options.userEmail || 'gaurang@taskoura.dev';
  const token = createMockJwt(email, name);

  await page.addInitScript(
    ({ t, u }) => {
      localStorage.setItem('token', t);
      localStorage.setItem('taskoura_token', t);
      localStorage.setItem('user', JSON.stringify(u));
    },
    {
      t: token,
      u: {
        id: 'user-1',
        name,
        email,
        role: 'Admin',
        avatarUrl: null,
      },
    }
  );
}

export function generateTasks(count: number) {
  const statuses = ['Backlog', 'InProgress', 'InReview', 'Completed'];
  const categories = ['Frontend', 'Backend', 'Database', 'Testing', 'Documentation'];
  const priorities = ['High', 'Medium', 'Low'];

  return Array.from({ length: count }, (_, i) => {
    const num = i + 1;
    const status = statuses[i % 4];
    const category = categories[i % 5];
    const priority = priorities[i % 3];

    return {
      id: `task-${num}`,
      projectId: 'proj-1',
      title: `Task #${num}: ${category} ${status} implementation module`,
      description: `Validation parameters for pipeline module ${num}. Backward compatibility verified.`,
      status,
      priority,
      category,
      assignedTo: i % 2 === 0 ? 'user-1' : 'user-2',
      deadline: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
      subtasks: [
        { id: `sub-${num}-1`, title: 'Define interface and schema contracts', completed: true },
        { id: `sub-${num}-2`, title: 'Implement automated integration test harness', completed: status === 'Completed' },
      ],
      comments: [
        { id: `c-${num}-1`, userId: 'user-2', userName: 'Sophia Patel', content: 'Benchmark telemetry verified.', createdAt: '2026-11-16T10:00:00Z' }
      ],
      attachments: [],
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-16T12:00:00Z',
    };
  });
}

export async function setupMockApi(page: Page, options: MockOptions = {}) {
  const taskCount = options.taskCount !== undefined ? options.taskCount : 32;
  const projectTitle =
    options.projectTitle ||
    'QuantumPulse Enterprise Distributed Architecture & Microservices Orchestration Platform 2026';
  const projectDesc =
    options.projectDesc ||
    'High-throughput, real-time distributed stream processing architecture and event-driven microservices ecosystem.';
  const name = options.userName || 'Gaurang Chouhan';
  const email = options.userEmail || 'gaurang@taskoura.dev';

  const mockProject = {
    id: 'proj-1',
    name: projectTitle,
    description: projectDesc,
    role: 'Owner',
    frontendStack: 'React 18 + TypeScript + Vite',
    backendStack: 'Spring Boot 3.4 + Java 21',
    databaseStack: 'PostgreSQL 16 + Redis',
    testingStack: 'Vitest + Playwright + JUnit 5',
    deadline: '2026-12-31',
    createdAt: '2026-01-01T00:00:00Z',
  };

  const mockTasks = generateTasks(taskCount);

  const mockMembers = [
    { userId: 'user-1', name, userName: name, email, userEmail: email, role: 'Owner', avatarUrl: null },
    { userId: 'user-2', name: 'Sophia Patel', userName: 'Sophia Patel', email: 'sophia.patel@taskoura.dev', userEmail: 'sophia.patel@taskoura.dev', role: 'Member', avatarUrl: null },
    { userId: 'user-3', name: 'Alexander Wright', userName: 'Alexander Wright', email: 'alexander.wright@taskoura.dev', userEmail: 'alexander.wright@taskoura.dev', role: 'Member', avatarUrl: null },
  ];

  const mockDashboard = {
    totalTasks: taskCount,
    completedTasks: Math.floor(taskCount * 0.4),
    inProgressTasks: Math.floor(taskCount * 0.3),
    reviewTasks: Math.floor(taskCount * 0.15),
    backlogTasks: Math.max(0, taskCount - Math.floor(taskCount * 0.4) - Math.floor(taskCount * 0.3) - Math.floor(taskCount * 0.15)),
    completionPercentage: taskCount > 0 ? 40 : 0,
    statusCounts: {
      Backlog: Math.max(0, taskCount - Math.floor(taskCount * 0.4) - Math.floor(taskCount * 0.3) - Math.floor(taskCount * 0.15)),
      InProgress: Math.floor(taskCount * 0.3),
      InReview: Math.floor(taskCount * 0.15),
      Completed: Math.floor(taskCount * 0.4),
    },
    memberPerformance: [
      { userId: 'user-1', name, tasksAssigned: Math.ceil(taskCount / 2), tasksCompleted: Math.floor(taskCount / 4), onTimeCompletions: Math.floor(taskCount / 5), lateCompletions: 1, averageDelayDays: 0.4, reworkCount: 1, bugsAssigned: 2, bugsFixed: 2, avgBugTurnaroundHours: 3.2, testCasesExecuted: 15, testCasesPassed: 14 },
      { userId: 'user-2', name: 'Sophia Patel', tasksAssigned: Math.floor(taskCount / 3), tasksCompleted: Math.floor(taskCount / 6), onTimeCompletions: 3, lateCompletions: 0, averageDelayDays: 0.0, reworkCount: 0, bugsAssigned: 3, bugsFixed: 3, avgBugTurnaroundHours: 2.1, testCasesExecuted: 20, testCasesPassed: 20 },
      { userId: 'user-3', name: 'Alexander Wright', tasksAssigned: Math.floor(taskCount / 6), tasksCompleted: 2, onTimeCompletions: 1, lateCompletions: 1, averageDelayDays: 1.2, reworkCount: 2, bugsAssigned: 1, bugsFixed: 1, avgBugTurnaroundHours: 5.0, testCasesExecuted: 8, testCasesPassed: 7 },
    ],
    upcomingDeadlines: taskCount > 0 ? [
      { id: 'task-1', title: 'Implement WebRTC audio streaming gateway', deadline: '2026-11-25', priority: 'High', status: 'InProgress' },
      { id: 'task-2', title: 'Zero-trust session authorization handshake', deadline: '2026-11-28', priority: 'High', status: 'InReview' },
    ] : [],
    aiSummary: 'Sprint velocity on track with high automated test coverage.',
  };

  const mockActivity = [
    { id: 'act-1', projectId: 'proj-1', userId: 'user-1', userName: name, action: 'CREATED_TASK', targetName: 'Implement WebRTC streaming gateway', createdAt: '2026-11-17T20:30:00Z' },
    { id: 'act-2', projectId: 'proj-1', userId: 'user-2', userName: 'Sophia Patel', action: 'MOVED_TASK', targetName: 'Zero-trust session authorization', details: 'Moved to InReview', createdAt: '2026-11-17T19:15:00Z' },
    { id: 'act-3', projectId: 'proj-1', userId: 'user-3', userName: 'Alexander Wright', action: 'COMPLETED_TASK', targetName: 'Telemetry buffer cache flush handler', createdAt: '2026-11-17T18:00:00Z' },
  ];

  const mockCalendar = {
    projectDeadline: '2026-12-31',
    days: taskCount > 0 ? [
      { date: '2026-11-17', tasks: [{ id: 'task-1', title: 'WebRTC audio gateway', status: 'InProgress' }] },
      { date: '2026-11-25', tasks: [{ id: 'task-2', title: 'Telemetry ingestion pipeline', status: 'Backlog' }] },
      { date: '2026-11-28', tasks: [{ id: 'task-3', title: 'Zero-trust handshake', status: 'InReview' }] },
    ] : [],
  };

  const mockNotifications = [
    { id: 'notif-1', title: 'Sprint Milestone Reached', message: 'Core architecture verified.', isRead: false, createdAt: '2026-11-17T21:00:00Z' },
    { id: 'notif-2', title: 'Task Assigned', message: 'You were assigned to Telemetry Stream Gateway.', isRead: true, createdAt: '2026-11-17T18:00:00Z' },
  ];

  const mockProfile = {
    id: 'user-1',
    name,
    email,
    bio: 'Lead Software Architect & Engineering Lead',
    title: 'Principal Architect',
    avatarUrl: null,
    role: 'Admin',
    providers: ['google', 'github'],
    passwordLoginEnabled: true,
    emailVerified: true,
    phone: '+14155552671',
    company: 'Taskoura Systems',
    location: 'San Francisco, CA',
    website: 'https://taskoura.dev',
    githubUsername: 'gaurangchouhan',
    skills: ['Distributed Systems', 'TypeScript', 'React', 'Spring Boot', 'Go', 'Kubernetes'],
    connectedAccounts: [
      { provider: 'google', email, connectedAt: '2026-11-05' },
      { provider: 'github', username: 'gaurangchouhan', connectedAt: '2026-11-10' },
    ],
  };

  await page.route('**/*', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (!url.includes('/api/') && !url.includes(':8080/')) {
      return route.continue();
    }

    if (options.networkDelayMs) {
      await new Promise((res) => setTimeout(res, options.networkDelayMs));
    }

    // Projects list
    if (url.includes('/projects') && !url.includes('/projects/proj-1/') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockProject]),
      });
    }

    // Single Project
    if (url.match(/\/projects\/proj-1(\?.*)?$/) && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockProject),
      });
    }

    // Single Task detail
    if (url.match(/\/tasks\/[a-zA-Z0-9_-]+$/) && method === 'GET') {
      const taskIdMatch = url.match(/\/tasks\/([a-zA-Z0-9_-]+)$/);
      const taskId = taskIdMatch ? taskIdMatch[1] : 'task-1';
      const foundTask = mockTasks.find((t) => t.id === taskId) || mockTasks[0];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(foundTask),
      });
    }

    // Task sub-resources
    if (url.includes('/status-logs') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    if (url.includes('/comments') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    // Tasks list
    if (url.includes('/tasks') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTasks),
      });
    }

    // Members
    if (url.includes('/members') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockMembers),
      });
    }

    // Dashboard
    if (url.includes('/dashboard') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDashboard),
      });
    }

    // Report
    if (url.includes('/report') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDashboard.memberPerformance),
      });
    }

    // Activity
    if (url.includes('/activity') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockActivity),
      });
    }

    // Deadlines upcoming
    if (url.includes('/deadlines/upcoming')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDashboard.upcomingDeadlines),
      });
    }

    // Calendar
    if (url.includes('/calendar') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCalendar),
      });
    }

    // Notifications
    if (url.includes('/notifications') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockNotifications),
      });
    }

    // Profile / user
    if ((url.includes('/profile') || url.includes('/users/me') || url.includes('/auth/me')) && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockProfile),
      });
    }

    // Providers
    if (url.includes('/auth/oauth/providers')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ providers: [{ key: 'google', label: 'Google' }, { key: 'github', label: 'GitHub' }] }),
      });
    }

    // Session info
    if (url.includes('/auth/session') || url.includes('/session')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          expiresInSeconds: 3600,
          idleSeconds: 0,
          serverTime: new Date().toISOString(),
        }),
      });
    }

    // Forgot / reset password
    if (url.includes('/auth/forgot-password') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'If an account exists with that email, a password reset code has been sent.' }),
      });
    }

    if (url.includes('/auth/reset-password') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Password reset successfully.' }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}
