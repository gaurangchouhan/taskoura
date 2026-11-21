const { chromium } = require('./node_modules/playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:5173';
const OUTPUT_DIR = path.join(__dirname, 'screenshots');
const RESULTS_FILE = path.join(__dirname, 'baseline-results.json');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'phone-portrait-375', width: 375, height: 667 },
  { name: 'phone-portrait-390', width: 390, height: 844 },
  { name: 'phone-landscape-667', width: 667, height: 375 },
  { name: 'phone-landscape-844', width: 844, height: 390 },
  { name: 'tablet-portrait-768', width: 768, height: 1024 },
  { name: 'tablet-landscape-1024', width: 1024, height: 768 },
  { name: 'laptop-1280', width: 1280, height: 800 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'ultrawide-1920', width: 1920, height: 1080 },
  { name: '4k-2560', width: 2560, height: 1440 },
];

const MOCK_USER = {
  id: 'user-1',
  name: 'Gaurang Chouhan',
  email: 'gaurang@taskoura.dev',
  role: 'Admin',
  avatarUrl: null,
};

const MOCK_PROJECT = {
  id: 'proj-1',
  name: 'QuantumPulse Enterprise Distributed Architecture & Microservices Orchestration Platform 2026',
  description: 'High-throughput, real-time distributed stream processing architecture and event-driven microservices ecosystem engineered for next-generation telemetry.',
  role: 'Owner',
  frontendStack: 'React 18 + TypeScript + Vite',
  backendStack: 'Spring Boot 3.4 + Java 21',
  databaseStack: 'PostgreSQL 16 + Redis',
  testingStack: 'Vitest + Playwright + JUnit 5',
  deadline: '2026-12-31',
  createdAt: '2026-01-01T00:00:00Z',
};

// Generate 32 realistic tasks
const STATUSES = ['Backlog', 'InProgress', 'InReview', 'Completed'];
const CATEGORIES = ['Frontend', 'Backend', 'Database', 'Testing', 'Documentation'];
const PRIORITIES = ['High', 'Medium', 'Low'];

const MOCK_TASKS = Array.from({ length: 32 }, (_, i) => {
  const num = i + 1;
  const status = STATUSES[i % 4];
  const category = CATEGORIES[i % 5];
  const priority = PRIORITIES[i % 3];
  return {
    id: `task-${num}`,
    projectId: 'proj-1',
    title: `Task #${num}: ${category} ${status} implementation for high-volume telemetry ingestion`,
    description: `Detailed engineering specification and validation parameters for pipeline module ${num}. Ensures backward compatibility and microservice SLA requirements.`,
    status,
    priority,
    category,
    assignedTo: i % 2 === 0 ? 'user-1' : 'user-2',
    deadline: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
    subtasks: [
      { id: `sub-${num}-1`, title: 'Define interface and schema contracts', completed: true },
      { id: `sub-${num}-2`, title: 'Implement automated integration test harness', completed: status === 'Completed' },
      { id: `sub-${num}-3`, title: 'Peer review and deployment signoff', completed: false }
    ],
    comments: [
      { id: `c-${num}-1`, userId: 'user-2', userName: 'Sophia Patel', content: 'Telemetry benchmark verified at 45k ops/sec.', createdAt: '2026-11-16T10:00:00Z' }
    ],
    attachments: [],
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-16T12:00:00Z',
  };
});

const MOCK_MEMBERS = [
  { userId: 'user-1', userName: 'Gaurang Chouhan', userEmail: 'gaurang@taskoura.dev', role: 'Owner', avatarUrl: null },
  { userId: 'user-2', userName: 'Sophia Patel', userEmail: 'sophia.patel@taskoura.dev', role: 'Member', avatarUrl: null },
  { userId: 'user-3', userName: 'Alexander Wright', userEmail: 'alexander.wright@taskoura.dev', role: 'Member', avatarUrl: null },
];

const MOCK_DASHBOARD = {
  totalTasks: 32,
  completedTasks: 12,
  inProgressTasks: 8,
  reviewTasks: 6,
  backlogTasks: 6,
  completionPercentage: 37.5,
  statusCounts: { Backlog: 6, InProgress: 8, InReview: 6, Completed: 12 },
  memberPerformance: [
    { userId: 'user-1', name: 'Gaurang Chouhan', tasksAssigned: 14, tasksCompleted: 6, onTimeCompletions: 5, lateCompletions: 1, averageDelayDays: 0.4, reworkCount: 1, bugsAssigned: 2, bugsFixed: 2, avgBugTurnaroundHours: 3.2, testCasesExecuted: 15, testCasesPassed: 14 },
    { userId: 'user-2', name: 'Sophia Patel', tasksAssigned: 10, tasksCompleted: 4, onTimeCompletions: 4, lateCompletions: 0, averageDelayDays: 0.0, reworkCount: 0, bugsAssigned: 3, bugsFixed: 3, avgBugTurnaroundHours: 2.1, testCasesExecuted: 20, testCasesPassed: 20 },
    { userId: 'user-3', name: 'Alexander Wright', tasksAssigned: 8, tasksCompleted: 2, onTimeCompletions: 1, lateCompletions: 1, averageDelayDays: 1.2, reworkCount: 2, bugsAssigned: 1, bugsFixed: 1, avgBugTurnaroundHours: 5.0, testCasesExecuted: 8, testCasesPassed: 7 }
  ],
  upcomingDeadlines: [
    { id: 'task-1', title: 'Implement WebRTC audio streaming gateway', deadline: '2026-11-25', priority: 'High', status: 'InProgress' },
    { id: 'task-2', title: 'Zero-trust session authorization handshake', deadline: '2026-11-28', priority: 'High', status: 'InReview' }
  ],
  aiSummary: 'Engineering velocity is pacing ahead of schedule with 37.5% sprint completion. Defect turnaround averaged 3.4 hours with 97% automated test pass rate across the microservices boundary.'
};

const MOCK_ACTIVITY = [
  { id: 'act-1', projectId: 'proj-1', userId: 'user-1', userName: 'Gaurang Chouhan', action: 'CREATED_TASK', targetName: 'Implement WebRTC streaming gateway', createdAt: '2026-11-17T20:30:00Z' },
  { id: 'act-2', projectId: 'proj-1', userId: 'user-2', userName: 'Sophia Patel', action: 'MOVED_TASK', targetName: 'Zero-trust session authorization', details: 'Moved to InReview', createdAt: '2026-11-17T19:15:00Z' },
  { id: 'act-3', projectId: 'proj-1', userId: 'user-3', userName: 'Alexander Wright', action: 'COMPLETED_TASK', targetName: 'Telemetry buffer cache flush handler', createdAt: '2026-11-17T18:00:00Z' },
];

const MOCK_CALENDAR = {
  projectDeadline: '2026-12-31',
  days: [
    { date: '2026-11-17', tasks: [{ id: 'task-1', title: 'WebRTC audio gateway', status: 'InProgress' }] },
    { date: '2026-11-25', tasks: [{ id: 'task-2', title: 'Telemetry ingestion pipeline', status: 'Backlog' }] },
    { date: '2026-11-28', tasks: [{ id: 'task-3', title: 'Zero-trust handshake', status: 'InReview' }] },
  ]
};

const MOCK_NOTIFICATIONS = [
  { id: 'notif-1', title: 'Sprint Milestone Reached', message: 'Core authentication and account linking passed QA verification.', isRead: false, createdAt: '2026-11-17T21:00:00Z' },
  { id: 'notif-2', title: 'Task Assigned', message: 'You were assigned to Zero-trust session authorization handshake.', isRead: true, createdAt: '2026-11-17T18:00:00Z' }
];

const MOCK_PROFILE = {
  id: 'user-1',
  name: 'Gaurang Chouhan',
  email: 'gaurang@taskoura.dev',
  bio: 'Lead Software Architect & Engineering Lead',
  title: 'Principal Architect',
  avatarUrl: null,
  role: 'Admin',
  providers: ['google', 'github'],
  hasPassword: true,
  emailVerified: true,
  phone: '+14155552671',
  company: 'Taskoura Systems',
  location: 'San Francisco, CA',
  website: 'https://taskoura.dev',
  githubUsername: 'gaurangchouhan',
  skills: ['Distributed Systems', 'TypeScript', 'React', 'Spring Boot', 'Go', 'Kubernetes'],
  connectedAccounts: [
    { provider: 'google', email: 'gaurang@taskoura.dev', connectedAt: '2026-11-05' },
    { provider: 'github', username: 'gaurangchouhan', connectedAt: '2026-11-10' }
  ]
};

const ROUTES = [
  { name: '01_landing', path: '/' },
  { name: '02_login', path: '/login' },
  { name: '03_register', path: '/register' },
  { name: '04_verify_email', path: '/verify-email' },
  { name: '05_forgot_password', path: '/forgot-password' },
  { name: '06_reset_password', path: '/reset-password?token=mock-valid-token' },
  { name: '07_oauth_callback', path: '/auth/callback?code=mock_code&state=mock_state' },
  { name: '08_projects_dashboard', path: '/app/projects', authenticated: true },
  { name: '09_project_board', path: '/app/projects/proj-1/board', authenticated: true },
  { name: '10_project_dashboard', path: '/app/projects/proj-1/dashboard', authenticated: true },
  { name: '11_project_calendar', path: '/app/projects/proj-1/calendar', authenticated: true },
  { name: '12_project_team', path: '/app/projects/proj-1/team', authenticated: true },
  { name: '13_project_activity', path: '/app/projects/proj-1/activity', authenticated: true },
  { name: '14_project_report', path: '/app/projects/proj-1/report', authenticated: true },
  { name: '15_profile', path: '/app/profile', authenticated: true },
  { name: '16_notifications', path: '/app/notifications', authenticated: true },
  { name: '17_not_found', path: '/some-non-existent-page-404' }
];

async function setupMocks(page) {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (!url.includes('/api/') && !url.includes(':8080/')) {
      return route.continue();
    }

    // Projects list
    if (url.includes('/projects') && !url.includes('/projects/proj-1/') && (method === 'GET')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_PROJECT])
      });
    }

    // Single Project
    if (url.match(/\/projects\/proj-1(\?.*)?$/) && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PROJECT)
      });
    }

    // Tasks
    if (url.includes('/tasks') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TASKS)
      });
    }

    // Members
    if (url.includes('/members') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MEMBERS)
      });
    }

    // Dashboard
    if (url.includes('/dashboard') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DASHBOARD)
      });
    }

    // Report
    if (url.includes('/report') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DASHBOARD.memberPerformance)
      });
    }

    // Activity
    if (url.includes('/activity') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ACTIVITY)
      });
    }

    // Calendar
    if (url.includes('/calendar') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CALENDAR)
      });
    }

    // Notifications
    if (url.includes('/notifications') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_NOTIFICATIONS)
      });
    }

    // Profile / user
    if ((url.includes('/profile') || url.includes('/users/me') || url.includes('/auth/me')) && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PROFILE)
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
          serverTime: new Date().toISOString()
        })
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({})
    });
  });
}

async function run() {
  console.log('Starting Playwright baseline responsive capture...');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });

  const allResults = [];
  const unreachableRoutes = [];

  // Generate unexpired JWT payload
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'gaurang@taskoura.dev',
    id: 'user-1',
    role: 'Admin',
    name: 'Gaurang Chouhan',
    exp: Math.floor(Date.now() / 1000) + 86400
  })).toString('base64url');
  const validToken = `${header}.${payload}.mockSignatureString1234567890`;

  for (const vp of VIEWPORTS) {
    console.log(`\n=== Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1
    });

    // Seed localStorage for authenticated routes
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
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await setupMocks(page);

    for (const route of ROUTES) {
      const url = `${BASE_URL}${route.path}`;
      const shotName = `${route.name}_${vp.name}.png`;
      const shotPath = path.join(OUTPUT_DIR, shotName);

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 8000 });
        await page.waitForTimeout(500); // allow animations/GSAP layout to settle

        // Check horizontal overflow: scrollWidth vs innerWidth
        const dimensions = await page.evaluate(() => {
          return {
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            bodyScrollWidth: document.body.scrollWidth,
            hasOverflow: document.documentElement.scrollWidth > window.innerWidth
          };
        });

        await page.screenshot({ path: shotPath, fullPage: true });

        const result = {
          route: route.path,
          routeName: route.name,
          viewport: vp.name,
          viewportWidth: vp.width,
          viewportHeight: vp.height,
          scrollWidth: dimensions.scrollWidth,
          innerWidth: dimensions.innerWidth,
          overflowPx: Math.max(0, dimensions.scrollWidth - dimensions.innerWidth),
          hasOverflow: dimensions.hasOverflow,
          screenshot: shotName,
          errors: [...consoleErrors]
        };

        allResults.push(result);
        console.log(`  [OK] ${route.name.padEnd(25)} | scrollW: ${dimensions.scrollWidth} vs innerW: ${dimensions.innerWidth} | overflow: ${result.overflowPx}px`);
      } catch (err) {
        console.error(`  [FAIL] ${route.name}: ${err.message}`);
        unreachableRoutes.push({ route: route.path, viewport: vp.name, error: err.message });
      }
    }

    // Capture Overlays at this viewport
    console.log(`  Capturing key overlays for ${vp.name}...`);
    try {
      // 1. TaskPanel Slide-over on Project Board
      await page.goto(`${BASE_URL}/app/projects/proj-1/board`, { waitUntil: 'networkidle', timeout: 8000 });
      await page.waitForTimeout(500);
      const firstTaskCard = await page.$('[data-testid^="task-card-"], div.cursor-pointer');
      if (firstTaskCard) {
        await firstTaskCard.click();
        await page.waitForTimeout(400);
        await page.screenshot({
          path: path.join(OUTPUT_DIR, `overlay_task_panel_${vp.name}.png`),
          fullPage: false
        });
      }

      // 2. Add Task Modal
      await page.goto(`${BASE_URL}/app/projects/proj-1/board`, { waitUntil: 'networkidle', timeout: 8000 });
      const addTaskBtn = await page.$('button:has-text("Add Task")');
      if (addTaskBtn) {
        await addTaskBtn.click();
        await page.waitForTimeout(300);
        await page.screenshot({
          path: path.join(OUTPUT_DIR, `overlay_add_task_modal_${vp.name}.png`),
          fullPage: false
        });
      }

      // 3. AI Plan Modal
      const aiPlanBtn = await page.$('button:has-text("AI plan"), [data-testid="ai-plan-btn"]');
      if (aiPlanBtn) {
        await aiPlanBtn.click();
        await page.waitForTimeout(300);
        await page.screenshot({
          path: path.join(OUTPUT_DIR, `overlay_ai_plan_modal_${vp.name}.png`),
          fullPage: false
        });
      }

      // 4. Create Project Modal on Projects Dashboard
      await page.goto(`${BASE_URL}/app/projects`, { waitUntil: 'networkidle', timeout: 8000 });
      const newProjBtn = await page.$('button:has-text("New Project"), button:has-text("Create Project")');
      if (newProjBtn) {
        await newProjBtn.click();
        await page.waitForTimeout(300);
        await page.screenshot({
          path: path.join(OUTPUT_DIR, `overlay_create_project_modal_${vp.name}.png`),
          fullPage: false
        });
      }

      // 5. Mobile Navigation Menu (on screens <= 768)
      if (vp.width <= 768) {
        await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 8000 });
        const hamburger = await page.$('button[aria-label="Open navigation menu"], header button:has(svg.lucide-menu)');
        if (hamburger) {
          await hamburger.click();
          await page.waitForTimeout(300);
          await page.screenshot({
            path: path.join(OUTPUT_DIR, `overlay_mobile_menu_${vp.name}.png`),
            fullPage: false
          });
        }
      }
    } catch (e) {
      console.log(`  Overlay capture notice: ${e.message}`);
    }

    await context.close();
  }

  await browser.close();

  fs.writeFileSync(RESULTS_FILE, JSON.stringify({
    timestamp: new Date().toISOString(),
    viewportsTested: VIEWPORTS.length,
    routesTested: ROUTES.length,
    results: allResults,
    unreachableRoutes
  }, null, 2));

  console.log(`\nBaseline capture completed! Results saved to ${RESULTS_FILE}`);
  console.log(`Total screenshots saved: ${fs.readdirSync(OUTPUT_DIR).length}`);
}

run().catch(console.error);

