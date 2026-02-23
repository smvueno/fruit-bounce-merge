import { test, expect } from '@playwright/test';

test('verify clouds visuals', async ({ page }) => {
    // Increase timeout
    test.setTimeout(60000);

    // Navigate to game
    // Note: Use baseURL from config or localhost directly
    await page.goto('/');

    // Click Play
    await page.getByRole('button', { name: /play|start/i }).first().click();

    // Wait for game to load
    await page.waitForTimeout(5000);

    // Take a screenshot
    await page.screenshot({ path: 'verification/clouds_screenshot.png', fullPage: true });
});
