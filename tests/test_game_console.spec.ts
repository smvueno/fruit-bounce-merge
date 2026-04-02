import { test, expect } from '@playwright/test';

test.use({ launchOptions: { args: ['--use-gl=swiftshader'] } });
test('test logs', async ({ page }) => {
    page.on('console', msg => console.log(msg.text()));
    page.on('pageerror', err => console.log('ERROR:', err.message));
    await page.goto('http://localhost:4000');
    await page.waitForTimeout(2000);
});
