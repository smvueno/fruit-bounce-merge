import { test, expect } from '@playwright/test';

test('capture background', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1000);

  // Click play
  await page.click('text="PLAY"');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'verification/bg_screenshot_game.png' });
});
