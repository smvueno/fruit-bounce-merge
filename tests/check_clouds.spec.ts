import { test, expect } from '@playwright/test';

test('check pixijs clouds', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

    await page.goto('http://localhost:5173');
    await page.click('text="PLAY"');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'verification/clouds_test.png' });
});
