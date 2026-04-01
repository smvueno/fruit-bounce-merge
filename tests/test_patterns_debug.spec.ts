import { test, expect } from '@playwright/test';

test.use({
  launchOptions: {
    args: ['--use-gl=swiftshader']
  }
});

test('debug patterns', async ({ page }) => {
    await page.goto('http://localhost:4000');
    await page.waitForTimeout(2000);
    const playButton = await page.$('text=PLAY');
    if (playButton) await playButton.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'verification/bg_patterns_check2.png' });
});
