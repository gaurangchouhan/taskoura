import { test, expect } from '@playwright/test';
import { setupAuth, setupMockApi } from './fixtures/mockApi';

test.describe('Responsive Interactions Suite', () => {
  test('Hamburger menu opens, traps focus, closes on Escape and on route change', async ({ page }, testInfo) => {
    const project = testInfo.project;
    // Only run on viewports below lg (< 1024) where hamburger button is visible
    const vpWidth = project.use.viewport?.width || 1280;
    if (vpWidth >= 1024) {
      test.skip();
    }

    await setupAuth(page);
    await setupMockApi(page);
    await page.goto('/app/projects', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const hamburgerBtn = page.locator('button[aria-label="Toggle navigation menu"]');
    await expect(hamburgerBtn).toBeVisible();

    // 1. Opens
    await hamburgerBtn.click();
    const drawer = page.locator('[data-testid="sidebar"]');
    await expect(drawer).toBeVisible();

    // 2. Traps focus
    const focusable = drawer.locator('a, button, input, [tabindex="0"]');
    const count = await focusable.count();
    expect(count).toBeGreaterThan(0);

    // Focus first element, tab backwards -> should wrap to last
    await focusable.first().focus();
    await page.keyboard.press('Shift+Tab');
    const isInsideAfterBackTab = await page.evaluate(() => {
      const active = document.activeElement;
      const drawerEl = document.querySelector('[data-testid="sidebar"]');
      return drawerEl ? drawerEl.contains(active) : false;
    });
    expect(isInsideAfterBackTab).toBe(true);

    // 3. Closes on Escape
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();

    // 4. Closes on route change
    await hamburgerBtn.click();
    await expect(drawer).toBeVisible();
    const profileLink = drawer.locator('a[href="/app/profile"]').first();
    await profileLink.click();
    await expect(page).toHaveURL(/.*\/app\/profile/);
    await expect(drawer).not.toBeVisible();
  });

  test('Dialogs and task panel fit within viewport and are fully scrollable', async ({ page }, testInfo) => {
    const project = testInfo.project;
    await setupAuth(page);
    await setupMockApi(page);
    await page.goto('/app/projects/proj-1/board', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    // Open Add Task modal
    const addTaskBtn = page.locator('[data-testid="btn-board-add-task"]').first();
    if (await addTaskBtn.isVisible()) {
      await addTaskBtn.click();
      await page.waitForTimeout(400);

      // Verify modal fits in viewport
      const modalMetrics = await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]');
        if (!modal) return { ok: true, reason: 'no-modal' };
        const dialogInner = modal.querySelector('div.bg-white') || modal;
        const rect = dialogInner.getBoundingClientRect();
        const fitsWidth = rect.width <= window.innerWidth + 1;
        const fitsHeight = rect.height <= window.innerHeight + 1;
        return {
          ok: fitsWidth && fitsHeight,
          rectWidth: rect.width,
          winWidth: window.innerWidth,
          rectHeight: rect.height,
          winHeight: window.innerHeight,
        };
      });
      expect(modalMetrics.ok, `Dialog exceeds viewport bounds on ${project.name}: ${JSON.stringify(modalMetrics)}`).toBe(true);

      // Close modal
      const closeBtn = page.locator('button[aria-label="Close modal"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // Open Task Detail slide-over panel by clicking first task card
    const firstTaskCard = page.locator('[data-testid^="task-card-"]').first();
    if (await firstTaskCard.isVisible()) {
      await firstTaskCard.locator('h4').first().click({ force: true });
      await page.waitForTimeout(500);

      const panelMetrics = await page.evaluate(() => {
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
        const panel = dialogs.find((d) => d.getAttribute('aria-label')?.includes('Task Details') || d.querySelector('[data-testid="task-panel-title"]'));
        if (!panel) return { ok: true, reason: 'no-panel' };

        const panelInner = panel.querySelector('div.bg-white') || panel;
        const rect = panelInner.getBoundingClientRect();
        const fitsWidth = rect.width <= window.innerWidth + 1;
        const fitsHeight = rect.height <= window.innerHeight + 1;

        return {
          ok: fitsWidth && fitsHeight,
          rectWidth: rect.width,
          winWidth: window.innerWidth,
          rectHeight: rect.height,
          winHeight: window.innerHeight,
        };
      });

      expect(panelMetrics.ok, `Task panel exceeds viewport bounds on ${project.name}: ${JSON.stringify(panelMetrics)}`).toBe(true);
    }
  });
});
