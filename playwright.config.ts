import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    timeout: 30_000,
    retries: 0,
    use: {
        baseURL: 'http://localhost:5100',
        headless: true,
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                launchOptions: {
                    args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
                },
            },
        },
    ],
    webServer: {
        command: 'npx vite --port 5100',
        url: 'http://localhost:5100',
        reuseExistingServer: true,
        timeout: 60_000,
    },
});
