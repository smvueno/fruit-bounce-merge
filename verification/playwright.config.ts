import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  use: {
    baseURL: 'http://localhost:5173',
    launchOptions: {
      args: ['--use-gl=swiftshader']
    }
  },
  webServer: {
    command: 'npm run preview -- --port 5173',
    port: 5173,
    reuseExistingServer: true,
  },
});
