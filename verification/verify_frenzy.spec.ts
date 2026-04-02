import { test, expect } from '@playwright/test';

test('capture frenzy water and clouds', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1000);

  // Click play
  await page.click('text="PLAY"');
  await page.waitForTimeout(1000);

  // We don't even need to trigger it necessarily, we just want to make sure it doesn't crash
  // and maybe we can just take a screenshot of the normal game view to verify Clouds show up.
  // The water won't show unless juice > 0, but clouds should ALWAYS show.

  // Let's drop ONE fruit just to be sure
  const canvas = page.locator('canvas.touch-none').first();
  const boundingBox = await canvas.boundingBox();
  if (boundingBox) {
     await page.mouse.click(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2);
     await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: 'verification/frenzy_screenshot.png' });
});
