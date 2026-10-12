import { defineConfig, devices } from '@playwright/test';

const frontendEnv =
  'NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1 NEXT_PUBLIC_AUTH_LOGIN_PATH=/auth/login NEXT_PUBLIC_AUTH_MODE=enforce';

/**
 * E2E smoke tests — see e2e/*.spec.ts
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: require.resolve('./e2e/global-hcm-setup.ts'),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 120_000,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'hcm-setup',
      testMatch: /hcm-auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      dependencies: ['hcm-setup'],
      testIgnore: /hcm-auth\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/hcm-user.json',
      },
    },
  ],

  webServer: [
    {
      command: 'cd ../gates-backend && npm run dev',
      url: 'http://127.0.0.1:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `env ${frontendEnv} npm run dev`,
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
