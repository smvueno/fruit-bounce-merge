import { test, expect } from '@playwright/test';

test.use({ launchOptions: { args: ['--use-gl=swiftshader'] } });

test('Verify BackgroundSystem', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /PLAY/ }).click();
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(2000);

  const data = await page.evaluate(() => {
     const patterns = [
        `data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='black'%3E%3Ccircle cx='50' cy='50' r='40' /%3E%3C/g%3E%3C/svg%3E`
     ];
     return patterns[0];
  });
  console.log('Pattern', data);
});
