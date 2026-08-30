import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'bun run build && cd .. && NODE_ENV=test PORT=3000 bun server/index.ts',
    cwd: import.meta.dirname,
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
