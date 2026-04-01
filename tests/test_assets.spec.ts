import { test, expect } from '@playwright/test';
test.use({ launchOptions: { args: ['--use-gl=swiftshader'] } });
test('test assets', async ({ page }) => {
    page.on('console', msg => console.log(msg.text()));
    await page.goto('http://localhost:4001/test_assets_load.html');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'verification/assets_check.png' });
});
