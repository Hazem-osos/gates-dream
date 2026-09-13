import { defineConfig, devices } from '@playwright/test';
/**
 * E2E smoke tests — see e2e/*.spec.ts
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  webServer: {
    // Force public env on the shell so Next inlines them reliably (avoids empty NEXT_PUBLIC_* from parent process).
    command:
      'env NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1 NEXT_PUBLIC_AUTH_LOGIN_PATH=/auth/login npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
