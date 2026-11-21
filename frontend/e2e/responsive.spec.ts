import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { setupAuth, setupMockApi } from './fixtures/mockApi';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.resolve(__dirname, '../responsive-baseline/screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const ROUTES = [
  { name: '01_landing', path: '/' },
  { name: '02_login', path: '/login' },
  { name: '03_register', path: '/register' },
  { name: '04_verify_email', path: '/verify-email' },
  { name: '05_forgot_password', path: '/forgot-password' },
  { name: '06_reset_password', path: '/reset-password?email=gaurang%40taskoura.dev' },
  { name: '07_projects_dashboard', path: '/app/projects', auth: true },
  { name: '08_project_board', path: '/app/projects/proj-1/board', auth: true },
  { name: '09_project_dashboard', path: '/app/projects/proj-1/dashboard', auth: true },
  { name: '10_project_calendar', path: '/app/projects/proj-1/calendar', auth: true },
  { name: '11_project_team', path: '/app/projects/proj-1/team', auth: true },
  { name: '12_project_activity', path: '/app/projects/proj-1/activity', auth: true },
  { name: '13_project_report', path: '/app/projects/proj-1/report', auth: true },
  { name: '14_profile', path: '/app/profile', auth: true },
  { name: '15_not_found', path: '/404-nonexistent-page' },
];

test.describe('Responsive Route Verification Suite', () => {
  for (const route of ROUTES) {
    test(`Route ${route.name} (${route.path}) assertions & screenshot`, async ({ page }, testInfo) => {
      const project = testInfo.project;
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Filter out standard 404 resource probes or react development warnings if any
          if (!text.includes('favicon.ico') && !text.includes('Failed to load resource: the server responded with a status of 404')) {
            consoleErrors.push(text);
          }
        }
      });
      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      if (route.auth) {
        await setupAuth(page);
      }
      await setupMockApi(page);

      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);

      // 1. Assert: No horizontal overflow
      const overflowMetrics = await page.evaluate(() => {
        const docEl = document.documentElement;
        const scrollW = docEl.scrollWidth;
        const clientW = docEl.clientWidth;
        return {
          scrollWidth: scrollW,
          clientWidth: clientW,
          hasOverflow: scrollW > clientW + 1,
        };
      });
      expect(
        overflowMetrics.hasOverflow,
        `Horizontal overflow detected on ${route.name} at viewport ${project.use.viewport?.width}x${project.use.viewport?.height}: scrollWidth=${overflowMetrics.scrollWidth}, clientWidth=${overflowMetrics.clientWidth}`
      ).toBe(false);

      // 2. Assert: No console errors
      expect(consoleErrors, `Console errors detected on ${route.name}`).toEqual([]);

      // 3. Assert: Navbar does not cover top heading
      const headingMetrics = await page.evaluate(() => {
        const nav = document.querySelector('nav, header');
        const firstHeading = document.querySelector('h1, h2');
        if (!firstHeading) return { ok: true, reason: 'no-heading' };

        const hRect = firstHeading.getBoundingClientRect();
        if (hRect.width === 0 && hRect.height === 0) return { ok: true, reason: 'invisible-heading' };

        if (!nav) return { ok: true, reason: 'no-nav' };
        const navRect = nav.getBoundingClientRect();

        // If nav is fixed/sticky at the top, heading should not be completely hidden underneath navRect.bottom
        const isOccluded = hRect.bottom <= navRect.bottom && hRect.top < navRect.top;
        return {
          ok: !isOccluded,
          headingTop: hRect.top,
          navBottom: navRect.bottom,
        };
      });
      expect(headingMetrics.ok, `Navbar covers top heading on ${route.name}`).toBe(true);

      // 4. Assert: On touch viewports, interactive elements are at least 44x44 CSS px
      if (project.use.hasTouch) {
        const touchOffenders = await page.evaluate(() => {
          const targets = Array.from(
            document.querySelectorAll(
              'button, a[role="button"], [role="tab"], [role="menuitem"], input[type="button"], input[type="submit"]'
            )
          );
          const offenders: Array<{ text: string; selector: string; width: number; height: number }> = [];

          for (const el of targets) {
            // Check visibility
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
            if ((el as HTMLElement).offsetParent === null && style.position !== 'fixed') continue;

            const rect = el.getBoundingClientRect();
            // Skip detached or collapsed items
            if (rect.width <= 0 || rect.height <= 0) continue;

            // Touch target threshold: 44x44 px (with 0.5px subpixel tolerance)
            if (rect.width < 43.5 || rect.height < 43.5) {
              const id = el.id ? `#${el.id}` : '';
              const testId = el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : '';
              const classes = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
              const selector = `${el.tagName.toLowerCase()}${id}${testId}${classes}`;
              const text = (el as HTMLElement).innerText?.trim()?.slice(0, 30) || el.getAttribute('aria-label') || '';

              offenders.push({
                text,
                selector,
                width: Math.round(rect.width * 10) / 10,
                height: Math.round(rect.height * 10) / 10,
              });
            }
          }
          return offenders;
        });

        if (touchOffenders.length > 0) {
          console.warn(`[TOUCH OFFENDERS] ${project.name} on ${route.name}:`, JSON.stringify(touchOffenders));
        }
        expect(
          touchOffenders.length,
          `Found ${touchOffenders.length} interactive elements under 44x44px on ${route.name} (${project.name}): ${JSON.stringify(touchOffenders)}`
        ).toBe(0);
      }

      // 5. Assert: On viewports <= 768, inputs/textareas/selects have computed font size >= 16 px
      const vpWidth = project.use.viewport?.width || 1280;
      if (vpWidth <= 768) {
        const smallInputs = await page.evaluate(() => {
          const formControls = Array.from(
            document.querySelectorAll(
              'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="range"]), textarea, select'
            )
          );
          const offenders: Array<{ selector: string; fontSize: number }> = [];

          for (const el of formControls) {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            if ((el as HTMLElement).offsetParent === null && style.position !== 'fixed') continue;

            const fontSize = parseFloat(style.fontSize);
            if (fontSize < 15.9) {
              const id = el.id ? `#${el.id}` : '';
              const name = el.getAttribute('name') ? `[name="${el.getAttribute('name')}"]` : '';
              const selector = `${el.tagName.toLowerCase()}${id}${name}`;
              offenders.push({ selector, fontSize });
            }
          }
          return offenders;
        });

        expect(
          smallInputs.length,
          `Found ${smallInputs.length} text inputs with font-size < 16px on ${route.name} (${project.name}): ${JSON.stringify(smallInputs)}`
        ).toBe(0);
      }

      // 6. Screenshot artifact
      const screenshotFilename = `resp5_${project.name}_${route.name}.png`;
      const screenshotPath = path.join(SCREENSHOT_DIR, screenshotFilename);
      await page.screenshot({ path: screenshotPath, fullPage: false });
    });
  }

  // Anchor jump test on landing page
  test('Landing page anchor jump leaves headings visible', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // If anchor link to #features exists
    const featuresLink = page.locator('a[href*="#features"]').first();
    if (await featuresLink.isVisible()) {
      await featuresLink.click();
      await page.waitForTimeout(400);

      const isHeadingVisible = await page.evaluate(() => {
        const target = document.querySelector('#features, [id*="feature"]');
        if (!target) return true;
        const rect = target.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom > 0;
      });
      expect(isHeadingVisible).toBe(true);
    }
  });
});
