const { chromium } = require('./node_modules/playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:5173';
const OUTPUT_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
];

const MOCK_USER = {
  id: 'user-1',
  name: 'Gaurang Chouhan Enterprise Architect & Distinguished Principal Engineer',
  email: 'gaurang.chouhan.extended.enterprise.division@taskoura.dev',
  role: 'Admin',
  avatarUrl: null,
};

// 120-character project name for stress testing
const MOCK_PROJECT = {
  id: 'proj-1',
  name: 'QuantumPulse Enterprise Distributed Architecture & Microservices Orchestration Platform Resiliency Initiative 2026',
  description: 'High-throughput, real-time distributed stream processing architecture and event-driven microservices ecosystem engineered for next-generation telemetry.',
  role: 'Owner',
  frontendStack: 'React 18 + TypeScript + Vite',
  backendStack: 'Spring Boot 3.4 + Java 21',
  databaseStack: 'PostgreSQL 16 + Redis',
  testingStack: 'Vitest + Playwright + JUnit 5',
  deadline: '2026-12-31',
  createdAt: '2026-01-01T00:00:00Z',
};

// Generate 60 tasks
const STATUSES = ['Backlog', 'InProgress', 'Testing', 'Completed'];
const CATEGORIES = ['Frontend', 'Backend', 'Database', 'Testing', 'Documentation'];
const PRIORITIES = ['High', 'Medium', 'Low'];

const MOCK_TASKS = Array.from({ length: 60 }, (_, i) => {
  const num = i + 1;
  const status = STATUSES[i % 4];
  const category = CATEGORIES[i % 5];
  const priority = PRIORITIES[i % 3];
  return {
    id: `task-${num}`,
    projectId: 'proj-1',
    title: `Task #${num}: High-throughput distributed data stream processing and validation pipeline`,
    description: `Detailed engineering specification and validation parameters for pipeline module ${num}. Ensures backward compatibility and microservice SLA requirements.`,
    status,
    priority,
    category,
    assignedTo: i % 2 === 0 ? 'user-1' : 'user-2',
    assigneeName: i % 2 === 0 ? 'Gaurang Chouhan' : 'Sophia Patel',
    deadline: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
    subtasks: [
      { id: `sub-${num}-1`, title: 'Define interface and schema contracts', completed: true },
      { id: `sub-${num}-2`, title: 'Implement automated integration test harness', completed: status === 'Completed' }
    ],
    comments: [],
    attachments: [],
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-16T12:00:00Z',
  };
});

const MOCK_MEMBERS = [
  { userId: 'user-1', userName: 'Gaurang Chouhan', userEmail: 'gaurang.chouhan.extended.enterprise.division@taskoura.dev', role: 'Owner', avatarUrl: null },
  { userId: 'user-2', userName: 'Sophia Patel', userEmail: 'sophia.patel.senior.distributed.systems@taskoura.dev', role: 'Member', avatarUrl: null },
  { userId: 'user-3', userName: 'Alexander Wright', userEmail: 'alexander.wright.security.audit.lead@taskoura.dev', role: 'Member', avatarUrl: null },
  { userId: 'user-4', userName: 'Elena Rostova', userEmail: 'elena.rostova@taskoura.dev', role: 'Member', avatarUrl: null },
  { userId: 'user-5', userName: 'Marcus Vance', userEmail: 'marcus.vance@taskoura.dev', role: 'Member', avatarUrl: null },
  { userId: 'user-6', userName: 'Priya Sharma', userEmail: 'priya.sharma@taskoura.dev', role: 'Member', avatarUrl: null },
  { userId: 'user-7', userName: 'David Kim', userEmail: 'david.kim@taskoura.dev', role: 'Member', avatarUrl: null },
];

const MOCK_DASHBOARD = {
  totalTasks: 60,
  completedTasks: 18,
  completionPercentage: 30,
  tasksByStatus: { Backlog: 15, InProgress: 15, Testing: 12, Completed: 18 },
  tasksByMember: MOCK_MEMBERS.map((m, idx) => ({
    userId: m.userId,
    name: m.userName,
    assigned: 8 + (idx % 4),
    completed: 2 + (idx % 3),
  })),
  upcomingDeadlines: [
    { taskId: 'task-1', title: 'Implement WebRTC audio streaming gateway with low latency guarantee', deadline: '2026-11-20', status: 'InProgress', priority: 'High', daysRemaining: 1 },
    { taskId: 'task-2', title: 'Zero-trust session authorization handshake and cryptographic key exchange', deadline: '2026-11-25', status: 'Testing', priority: 'High', daysRemaining: 6 },
    { taskId: 'task-3', title: 'Kubernetes cluster ingress controller routing rules configuration', deadline: '2026-11-28', status: 'Backlog', priority: 'Medium', daysRemaining: 9 },
  ],
};

const MOCK_REPORT = {
  members: MOCK_MEMBERS.map((m, idx) => ({
    userId: m.userId,
    name: m.userName,
    tasksAssigned: 12 + idx,
    tasksCompleted: 8 + (idx % 3),
    onTimeCompletions: 7,
    lateCompletions: 1 + (idx % 2),
    averageDelayDays: idx * 0.4,
    reworkCount: idx % 3,
    bugsAssigned: 4,
    bugsFixed: 3,
    avgBugTurnaroundHours: 2.5 + idx * 0.5,
    testCasesExecuted: 20 + idx * 2,
    testCasesPassed: 19 + idx * 2,
  })),
  aiSummary: 'Sprint engineering velocity remains robust with a 30% completion rate. Defect turnaround averages 3.2 hours with zero regression across microservice boundaries.'
};

const MOCK_ACTIVITY = [
  { id: 'act-1', projectId: 'proj-1', userId: 'user-1', userName: 'Gaurang Chouhan', actionType: 'TASK_CREATED', description: 'Created task: High-throughput distributed stream ingestion telemetry pipeline specification', createdAt: new Date().toISOString() },
  { id: 'act-2', projectId: 'proj-1', userId: 'user-2', userName: 'Sophia Patel', actionType: 'TASK_STATUS_CHANGED', description: 'Moved Zero-trust session authorization handshake from InProgress to Testing', createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'act-3', projectId: 'proj-1', userId: 'user-3', userName: 'Alexander Wright', actionType: 'MEMBER_INVITED', description: 'Invited Elena Rostova to the project with Member role permissions', createdAt: new Date(Date.now() - 86400000).toISOString() },
];

const MOCK_CALENDAR = {
  projectDeadline: '2026-12-31',
  days: [
    { date: '2026-11-05', tasks: [{ id: 'task-1', title: 'WebRTC gateway setup', status: 'Completed' }] },
    { date: '2026-11-12', tasks: [{ id: 'task-2', title: 'Zero-trust handshake', status: 'Testing' }] },
    { date: '2026-11-18', tasks: [{ id: 'task-3', title: 'Ingress routing', status: 'InProgress' }, { id: 'task-4', title: 'Telemetry buffer cache flush', status: 'Backlog' }] },
    { date: '2026-11-25', tasks: [{ id: 'task-5', title: 'Database migration', status: 'Backlog' }] },
  ]
};

const MOCK_NOTIFICATIONS = [
  { id: 'notif-1', message: 'Sprint Milestone Reached: Core distributed architecture passed all integration verification tests.', isRead: false, createdAt: new Date().toISOString() },
  { id: 'notif-2', message: 'Task Assigned: You were assigned to Zero-trust session authorization handshake.', isRead: true, createdAt: new Date(Date.now() - 7200000).toISOString() }
];

const MOCK_PROFILE_DATA = {
  id: 'user-1',
  name: 'Gaurang Chouhan',
  email: 'gaurang.chouhan.extended.enterprise.division@taskoura.dev',
  bio: 'Lead Software Architect & Engineering Lead specializing in high-performance distributed systems, reactive microservices, and modern frontend design systems.',
  avatarUrl: null,
  role: 'Owner',
  organization: 'Taskoura Engineering Systems Inc.',
  department: 'Distributed Systems & Cloud Core',
  jobTitle: 'Distinguished Principal Software Engineer',
  graduationYear: '2018',
  githubUrl: 'https://github.com/gaurangchouhan',
  linkedinUrl: 'https://linkedin.com/in/gaurangchouhan',
  phone: '+14155552671',
  skills: ['TypeScript', 'React', 'Spring Boot', 'Java 21', 'Kubernetes', 'PostgreSQL', 'Tailwind CSS', 'Distributed Systems'],
  timeZone: 'Asia/Kolkata',
  notificationPrefs: { taskAssigned: true, deadlineReminders: true, mentions: true },
  providers: [
    { provider: 'google', email: 'gaurang@taskoura.dev', linkedAt: '2026-11-05T10:00:00Z' },
    { provider: 'github', email: 'gaurang@taskoura.dev', linkedAt: '2026-11-08T14:30:00Z' }
  ],
  passwordLoginEnabled: true,
  verified: true,
  createdAt: '2026-01-01T00:00:00Z',
};

async function setupMocks(page) {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (!url.includes('/api/') && !url.includes(':8080/')) {
      return route.continue();
    }

    if (url.includes('/auth/session') || url.includes('/session')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          expiresInSeconds: 3600,
          idleSeconds: 0,
          serverTime: new Date().toISOString()
        })
      });
    }

    if (url.includes('/users/me/profile') || url.includes('/profile')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROFILE_DATA) });
    }
    if (url.includes('/auth/providers') || url.includes('/oauth/providers')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ providers: [{ key: 'google', label: 'Google' }, { key: 'github', label: 'GitHub' }] }) });
    }
    if (url.includes('/users/me') || url.includes('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) });
    }
    if (url.includes('/ai/next-task')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendation: 'Finalize Zero-trust session authorization handshake to unblock downstream integration.', relatedTaskId: 'task-1' }) });
    }
    if (url.includes('/dashboard/report')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_REPORT) });
    }
    if (url.includes('/dashboard')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_DASHBOARD) });
    }
    if (url.includes('/activity')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ACTIVITY) });
    }
    if (url.includes('/calendar/upcoming')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_DASHBOARD.upcomingDeadlines) });
    }
    if (url.includes('/calendar')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CALENDAR) });
    }
    if (url.includes('/members')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_MEMBERS) });
    }
    if (url.includes('/notifications')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_NOTIFICATIONS) });
    }
    if (url.includes('/projects/proj-1')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROJECT) });
    }
    if (url.includes('/projects')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_PROJECT]) });
    }
    if (url.includes('/tasks')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TASKS) });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
}

const PAGES_TO_CAPTURE = [
  { name: 'dashboard', path: '/app/projects/proj-1/dashboard' },
  { name: 'calendar', path: '/app/projects/proj-1/calendar' },
  { name: 'team', path: '/app/projects/proj-1/team' },
  { name: 'activity', path: '/app/projects/proj-1/activity' },
  { name: 'report', path: '/app/projects/proj-1/report' },
  { name: 'profile', path: '/app/profile' },
  { name: 'notifications', path: '/app/notifications' },
  { name: 'not_found', path: '/some-non-existent-page-404' },
];

async function run() {
  console.log('Launching Playwright for RESP-4 screenshots and overflow verification...');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'gaurang@taskoura.dev',
    id: 'user-1',
    role: 'Admin',
    name: 'Gaurang Chouhan',
    exp: Math.floor(Date.now() / 1000) + 86400
  })).toString('base64url');
  const validToken = `${header}.${payload}.mockSignatureString1234567890`;

  const overflowResults = [];

  for (const vp of VIEWPORTS) {
    console.log(`\nTesting viewport ${vp.name} (${vp.width}x${vp.height})...`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1
    });

    await context.addInitScript(({ token, user }) => {
      localStorage.setItem('taskoura_token', token);
      localStorage.setItem('taskoura_user', JSON.stringify(user));
      localStorage.setItem('taskoura_session', JSON.stringify({
        authenticated: true,
        expiresInSeconds: 3600,
        serverTime: new Date().toISOString()
      }));
      localStorage.setItem('taskoura_session_start', Date.now().toString());
    }, { token: validToken, user: MOCK_USER });

    const page = await context.newPage();
    await setupMocks(page);

    for (const p of PAGES_TO_CAPTURE) {
      const url = `${BASE_URL}${p.path}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);

      // Check horizontal overflow
      const overflow = await page.evaluate(() => {
        const docEl = document.documentElement;
        const scrollW = docEl.scrollWidth;
        const innerW = window.innerWidth;
        return {
          scrollWidth: scrollW,
          innerWidth: innerW,
          hasOverflow: scrollW > innerW + 1
        };
      });

      const shotPath = path.join(OUTPUT_DIR, `resp4_${p.name}_${vp.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });

      console.log(`  [${vp.name}] ${p.name}: scrollW=${overflow.scrollWidth}, innerW=${overflow.innerWidth}, overflow=${overflow.hasOverflow ? 'FAIL' : 'OK'}`);
      overflowResults.push({
        page: p.name,
        viewport: vp.name,
        width: vp.width,
        ...overflow,
        shotPath
      });
    }

    await context.close();
  }

  await browser.close();

  const failures = overflowResults.filter(r => r.hasOverflow);
  console.log('\n--- VERIFICATION SUMMARY ---');
  console.log(`Total checks: ${overflowResults.length}`);
  console.log(`Overflow failures: ${failures.length}`);
  if (failures.length > 0) {
    console.error('FAILURES:', failures);
    process.exit(1);
  } else {
    console.log('SUCCESS: All pages at all 5 viewports have ZERO horizontal page scroll!');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
