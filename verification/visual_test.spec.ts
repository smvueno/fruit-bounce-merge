import { test, expect } from '@playwright/test';

test('Verify assets restoration on visibility change', async ({ page }) => {
  // 1. Go to page
  await page.goto('http://localhost:4000/');

  // 2. Click Start
  const startButton = page.getByRole('button', { name: /PLAY/i }).first();
  await startButton.waitFor({ state: 'visible', timeout: 10000 });
  await startButton.click();

  // 3. Wait for game to load (canvas visible)
  const canvas = page.locator('canvas').first();
  await canvas.waitFor({ state: 'visible' });

  // Wait a bit for fruits to spawn
  await page.waitForTimeout(2000);

  // 4. Take "Before" Screenshot
  await page.screenshot({ path: 'verification/screenshot_before.png' });

  // 5. Simulate Hidden
  await page.evaluate(() => {
    console.log("Simulating Hidden");
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  // Wait a bit (simulate background time)
  await page.waitForTimeout(1000);

  // 6. Simulate Visible
  await page.evaluate(() => {
    console.log("Simulating Visible");
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  // Wait for restoration
  await page.waitForTimeout(2000);

  // 7. Take "After" Screenshot
  await page.screenshot({ path: 'verification/screenshot_after.png' });
});
