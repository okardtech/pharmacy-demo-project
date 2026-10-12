import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5199', channel: 'chrome', headless: true },
  webServer: { command: 'pnpm vite --port 5199 --strictPort', port: 5199, reuseExistingServer: true },
});
