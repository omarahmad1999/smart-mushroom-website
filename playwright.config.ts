import { defineConfig } from '@playwright/test';
import { dirname } from 'node:path';

const port = process.env.PORT || '4322';
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${port}`;
const nodeBin = dirname(process.execPath);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: 'list',
  use: {
    baseURL,
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox'],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: process.env.TEST_PRODUCTION ? undefined : {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
    env: { PATH: `${nodeBin}:${process.env.PATH || ''}` },
  },
});
