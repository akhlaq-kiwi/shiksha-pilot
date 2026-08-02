import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: path.resolve(fileURLToPath(new URL('.', import.meta.url)), '.env') });

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ...(process.env.CI ? [['github']] : []),
  ],
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    // Logs in once per role and reuses the storage state across specs in that project.
    { name: 'setup', testMatch: /.*\.setup\.js/ },

    {
      name: 'chromium-teacher',
      testDir: './tests/teacher',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: '.auth/teacher.json' },
    },
    {
      name: 'chromium-school-admin',
      testDir: './tests/school-admin',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: '.auth/school-admin.json' },
    },
    {
      name: 'chromium-student-parent',
      testDir: './tests/student-parent',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: '.auth/student-parent.json' },
    },
    {
      name: 'chromium-super-admin',
      testDir: './tests/super-admin',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: '.auth/super-admin.json' },
    },
    {
      // Auth/login specs intentionally start unauthenticated (no storageState).
      name: 'chromium-auth',
      testDir: './tests/auth',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.PW_START_WEB_SERVER === '1' ? {
    command: 'npm run dev',
    cwd: '../frontend',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  } : undefined,
});
