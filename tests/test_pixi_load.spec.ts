import { test, expect } from '@playwright/test';

test('debug patterns', async ({ page }) => {
    page.on('console', msg => console.log(msg.text()));
    await page.goto('http://localhost:4001/test_pixi_load.html');
    await page.waitForTimeout(1000);
});
