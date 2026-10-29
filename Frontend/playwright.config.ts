import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
process.env.CAR_TEST_JWT_KEY ??= randomBytes(48).toString('base64');
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173', timezoneId: 'Europe/Budapest', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium' }],
  webServer: [
    {
      command: 'node scripts/start-test-backend.mjs',
      url: 'http://localhost:5232/api/Auth/me',
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'npm run dev -- --host 0.0.0.0 --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 60000,
    },
    { command: 'node scripts/start-test-backend.mjs --production', url: 'http://localhost:15232/api/Auth/me', reuseExistingServer: false, timeout: 120000 },
  ],
  outputDir: path.resolve('test-results'),
});
