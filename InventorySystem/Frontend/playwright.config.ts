import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1, // Run sequentially to avoid SQLite locking issues during test setup
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5000',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'dotnet run --project ../Backend/Backend.csproj',
    url: 'http://127.0.0.1:5000/api/launcher/status',
    reuseExistingServer: false, // Ensure we always start a clean, fresh server for E2E tests
    timeout: 30000,
  },
});
