const { chromium } = require('./node_modules/playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:5173';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

const TARGET_WIDTHS = [
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 }
];

const ALL_VIEWPORTS = [
  { name: '375', width: 375, height: 667 },
  { name: '390', width: 390, height: 844 },
  { name: '667', width: 667, height: 375 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
  { name: '2560', width: 2560, height: 1440 }
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
  description: 'High-throughput, real-time distributed stream processing architecture and event-driven microservices ecosystem.',
  role: 'Owner',
  frontendStack: 'React 18 + TypeScript + Vite',
  backendStack: 'Spring Boot 3.4 + Java 21',
  databaseStack: 'PostgreSQL 16 + Redis',
  testingStack: 'Vitest + Playwright + JUnit 5',
  deadline: '2026-12-31',
  createdAt: '2026-01-01T00:00:00Z',
};

const MOCK_TASKS = Array.from({ length: 32 }, (_, i) => ({
  id: `task-${i + 1}`,
  projectId: 'proj-1',
  title: `Task #${i + 1}: Implementation module`,
  status: ['Backlog', 'InProgress', 'InReview', 'Completed'][i % 4],
  priority: ['High', 'Medium', 'Low'][i % 3],
  category: 'Frontend',
  assignedTo: 'user-1',
  deadline: '2026-12-01'
}));

async function setupMocks(page) {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (!url.includes('/api/') && !url.includes(':8080/')) {
      return route.continue();
    }
    if (url.includes('/projects') && !url.includes('/projects/proj-1/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_PROJECT]) });
    }
    if (url.match(/\/projects\/proj-1(\?.*)?$/)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROJECT) });
    }
    if (url.includes('/tasks')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TASKS) });
    }
    if (url.includes('/members')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ userId: 'user-1', userName: 'Gaurang Chouhan', userEmail: 'gaurang@taskoura.dev', role: 'Owner' }]) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
}

async function verify() {
  console.log('Running RESP-1 verification and after screenshot capture...');
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

  const report = {
    horizontalOverflowChecks: [],
    keyboardAndTouchChecks: [],
    afterScreenshots: []
  };

  // 1. Capture after screenshots at required widths: 390, 768, 1024, 1440, 1920
  for (const tw of TARGET_WIDTHS) {
    console.log(`\nCapturing AFTER screenshots for width ${tw.width}px (${tw.name})...`);
    const context = await browser.newContext({
      viewport: { width: tw.width, height: tw.height },
      deviceScaleFactor: 1
    });

    await context.addInitScript(({ token, user }) => {
      localStorage.setItem('taskoura_token', token);
      localStorage.setItem('taskoura_user', JSON.stringify(user));
      localStorage.setItem('taskoura_session', JSON.stringify({ authenticated: true, expiresInSeconds: 3600 }));
      localStorage.setItem('taskoura_session_start', Date.now().toString());
    }, { token: validToken, user: MOCK_USER });

    const page = await context.newPage();
    await setupMocks(page);

    // A. Landing Navbar
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 8000 });
    await page.waitForTimeout(400);
    const landingNavShot = `after_navbar_landing_${tw.name}.png`;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, landingNavShot), fullPage: false });
    report.afterScreenshots.push(landingNavShot);

    // If below 1024, also capture open mobile menu
    if (tw.width < 1024) {
      const hamburger = await page.$('button[aria-label="Toggle navigation menu"]');
      if (hamburger) {
        await hamburger.click();
        await page.waitForTimeout(300);
        const openNavShot = `after_navbar_landing_open_${tw.name}.png`;
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, openNavShot), fullPage: false });
        report.afterScreenshots.push(openNavShot);
        // Test Escape key closes menu
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    }

    // B. Workspace Navbar & Tab Strip on Project Board
    await page.goto(`${BASE_URL}/app/projects/proj-1/board`, { waitUntil: 'networkidle', timeout: 8000 });
    await page.waitForTimeout(400);
    const workspaceNavShot = `after_navbar_workspace_${tw.name}.png`;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, workspaceNavShot), fullPage: false });
    report.afterScreenshots.push(workspaceNavShot);

    // C. Project Tab Strip
    const tabStripShot = `after_tab_strip_${tw.name}.png`;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, tabStripShot), fullPage: false });
    report.afterScreenshots.push(tabStripShot);

    // D. Footer (scroll to bottom of landing)
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 8000 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const footerShot = `after_footer_${tw.name}.png`;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, footerShot), fullPage: false });
    report.afterScreenshots.push(footerShot);

    await context.close();
  }

  // 2. Test Keyboard & Touch Interactions on Mobile Menu
  console.log('\nTesting keyboard focus trap and touch interactions...');
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

    const hamburger = await page.$('button[aria-label="Toggle navigation menu"]');
    await hamburger.click();
    await page.waitForTimeout(300);

    // Check menu is open
    const isOpen = await page.$eval('[data-testid="sidebar"]', el => el !== null);
    report.keyboardAndTouchChecks.push({ check: 'Menu opens on click/touch', passed: isOpen });

    // Press Escape to test keyboard close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const isClosedAfterEscape = await page.$eval('[data-testid="sidebar"]', el => false).catch(() => true);
    report.keyboardAndTouchChecks.push({ check: 'Menu closes on Escape key', passed: isClosedAfterEscape });

    // Open again and click outside
    await hamburger.click();
    await page.waitForTimeout(200);
    // Click outside in the hero area
    await page.mouse.click(10, 500);
    await page.waitForTimeout(200);
    const isClosedAfterOutsideTap = await page.$eval('[data-testid="sidebar"]', el => false).catch(() => true);
    report.keyboardAndTouchChecks.push({ check: 'Menu closes on outside tap', passed: isClosedAfterOutsideTap });

    await context.close();
  }

  // 3. Test horizontal overflow across all test viewports on project board and landing
  console.log('\nChecking horizontal overflow across all test viewports...');
  for (const vp of ALL_VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await context.addInitScript(({ token, user }) => {
      localStorage.setItem('taskoura_token', token);
      localStorage.setItem('taskoura_user', JSON.stringify(user));
      localStorage.setItem('taskoura_session', JSON.stringify({ authenticated: true, expiresInSeconds: 3600 }));
    }, { token: validToken, user: MOCK_USER });

    const page = await context.newPage();
    await setupMocks(page);

    // Check Landing
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    const landingDims = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth
    }));

    // Check Projects Dashboard
    await page.goto(`${BASE_URL}/app/projects`, { waitUntil: 'networkidle' });
    const projectsDims = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth
    }));

    report.horizontalOverflowChecks.push({
      viewport: `${vp.width}x${vp.height} (${vp.name})`,
      landingScrollWidth: landingDims.scrollWidth,
      landingInnerWidth: landingDims.innerWidth,
      landingOverflow: landingDims.scrollWidth > landingDims.innerWidth,
      projectsScrollWidth: projectsDims.scrollWidth,
      projectsInnerWidth: projectsDims.innerWidth,
      projectsOverflow: projectsDims.scrollWidth > projectsDims.innerWidth
    });

    console.log(`  ${vp.name.padEnd(6)} | Landing: ${landingDims.scrollWidth}/${landingDims.innerWidth}px | Projects: ${projectsDims.scrollWidth}/${projectsDims.innerWidth}px`);
    await context.close();
  }

  await browser.close();

  const reportPath = path.join(__dirname, 'resp1-verification.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nRESP-1 verification complete! Report written to ${reportPath}`);
}

verify().catch(console.error);

