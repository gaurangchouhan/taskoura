import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'responsive-test-results.json' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  projects: [
    {
      name: 'phone-portrait-375',
      use: {
        viewport: { width: 375, height: 667 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'phone-portrait-390',
      use: {
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'phone-landscape-667',
      use: {
        viewport: { width: 667, height: 375 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'phone-landscape-844',
      use: {
        viewport: { width: 844, height: 390 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'tablet-portrait-768',
      use: {
        viewport: { width: 768, height: 1024 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'tablet-landscape-1024',
      use: {
        viewport: { width: 1024, height: 768 },
        hasTouch: true,
        isMobile: false,
      },
    },
    {
      name: 'laptop-1280',
      use: {
        viewport: { width: 1280, height: 800 },
        hasTouch: false,
        isMobile: false,
      },
    },
    {
      name: 'desktop-1440',
      use: {
        viewport: { width: 1440, height: 900 },
        hasTouch: false,
        isMobile: false,
      },
    },
    {
      name: 'ultrawide-1920',
      use: {
        viewport: { width: 1920, height: 1080 },
        hasTouch: false,
        isMobile: false,
      },
    },
    {
      name: '4k-2560',
      use: {
        viewport: { width: 2560, height: 1440 },
        hasTouch: false,
        isMobile: false,
      },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --host 127.0.0.1',
    port: 4173,
    reuseExistingServer: true,
  },
});
