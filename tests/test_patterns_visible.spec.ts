import { test, expect } from '@playwright/test';

test.use({
  launchOptions: {
    args: ['--use-gl=swiftshader']
  }
});

test('verify background patterns', async ({ page }) => {
    await page.goto('http://localhost:4001');

    // Wait for the game to load and click play
    await page.waitForTimeout(2000);
    const playButton = await page.$('text=PLAY');
    if (playButton) await playButton.click();

    // Wait for everything to fade in
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'verification/bg_patterns_check.png' });
});
