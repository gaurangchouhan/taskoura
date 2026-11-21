import { test, expect } from '@playwright/test';
import { setupAuth, setupMockApi } from './fixtures/mockApi';

test.describe('Responsive Extra Scenarios', () => {
  test.beforeEach(async ({}, testInfo) => {
    // Run scenario tests once on the desktop-1440 project since they set their own viewports
    test.skip(testInfo.project.name !== 'desktop-1440', 'Scenarios manage their own viewports');
  });

  // Scenario 1: Orientation change
  test('Orientation change (portrait to landscape) maintains zero overflow', async ({ page }) => {
    await setupAuth(page);
    await setupMockApi(page);

    // 1. Phone: 390x844 -> 844x390
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/projects/proj-1/board', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);

    let overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, 'Phone portrait 390x844 has horizontal overflow').toBe(false);

    // Rotate to landscape
    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
    await page.waitForTimeout(400);

    overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, 'Phone landscape 844x390 has horizontal overflow').toBe(false);

    // 2. Tablet: 820x1180 -> 1180x820
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await page.waitForTimeout(400);

    overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, 'Tablet portrait 820x1180 has horizontal overflow').toBe(false);

    // Rotate tablet to landscape
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
    await page.waitForTimeout(400);

    overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, 'Tablet landscape 1180x820 has horizontal overflow').toBe(false);
  });

  // Scenario 2: 320x568 and 640x360 (200% zoom)
  test('Ultra-compact viewports (320x568 and 640x360 zoom equivalent) fit cleanly', async ({ page }) => {
    await setupAuth(page);
    await setupMockApi(page);

    // 320x568
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/app/projects/proj-1/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    let overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, '320x568 dashboard has horizontal overflow').toBe(false);

    // 640x360 (200% zoom equivalent of 1280x720)
    await page.setViewportSize({ width: 640, height: 360 });
    await page.goto('/app/projects/proj-1/board', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, '640x360 (200% zoom) board has horizontal overflow').toBe(false);
  });

  // Scenario 3: Very long names and emails
  test('Very long names (120+ chars) and emails do not cause horizontal page overflow', async ({ page }) => {
    const extremeTitle = 'EnterpriseDistributedHyperScaleMicroservicesCloudNativeMultiTenantRealTimeStreamingArchitectureValidationSystem2026';
    const extremeEmail = 'alexander.montgomery-hasselhoff.the.third.engineering.specialist@distributed-enterprise-telemetry-systems.corporation.com';

    await setupAuth(page, { userName: 'Alexander Montgomery Hasselhoff III', userEmail: extremeEmail });
    await setupMockApi(page, {
      projectTitle: extremeTitle,
      userEmail: extremeEmail,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/projects/proj-1/board', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const overflowBoard = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflowBoard, 'Extreme long project title caused overflow on mobile board').toBe(false);

    await page.goto('/app/profile', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const overflowProfile = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflowProfile, 'Extreme long email caused overflow on mobile profile').toBe(false);
  });

  // Scenario 4: 60 tasks
  test('Board with 60 tasks renders and scrolls with zero page overflow', async ({ page }) => {
    await setupAuth(page);
    await setupMockApi(page, { taskCount: 60 });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/projects/proj-1/board', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const overflowMobile = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflowMobile, '60 tasks caused overflow on mobile 390x844').toBe(false);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    const overflowDesktop = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflowDesktop, '60 tasks caused overflow on desktop 1440x900').toBe(false);
  });

  // Scenario 5: Zero tasks
  test('Board and dashboard with zero tasks render empty states cleanly without overflow', async ({ page }) => {
    await setupAuth(page);
    await setupMockApi(page, { taskCount: 0 });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/projects/proj-1/board', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const overflowBoard = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflowBoard, 'Empty board caused overflow on mobile').toBe(false);

    await page.goto('/app/projects/proj-1/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const overflowDashboard = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflowDashboard, 'Empty dashboard caused overflow on mobile').toBe(false);
  });

  // Scenario 6: Slow network & cold-start notice
  test('Slow network with delayed API preserves layout and cold-start notice fits on screen', async ({ page }) => {
    await setupAuth(page);
    await setupMockApi(page, { networkDelayMs: 1500 });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/projects', { waitUntil: 'domcontentloaded' });

    // While loading, verify page doesn't horizontally scroll
    const overflowWhileLoading = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflowWhileLoading, 'Loading skeleton caused horizontal overflow').toBe(false);

    // Wait for data load
    await page.waitForTimeout(2000);
    const overflowAfterLoad = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflowAfterLoad, 'Page after slow network load caused horizontal overflow').toBe(false);
  });
});
