import { test, expect } from '@playwright/test';

test.describe('Fruit Bounce Merge', () => {
    test('should load the game and interact', async ({ page }) => {
        // 1. Go to the game (assuming localhost:5173 from dev server or similar)
        // For this environment, we might need to build and serve, or assume dev server is running.
        // However, since we are just checking static build, we can try to serve static or mock.
        // Actually, 'npm run preview' serves the build. Let's assume we run against that.

        // We will start the preview server in a separate process, but for this test script 
        // let's assume standard behavior or just fail if not running. 
        // Better yet, let's use the 'webServer' config in playwright.config.ts if it existed.
        // Since it doesn't, I will try to visit the likely URL.

        await page.goto('/'); // Use baseURL from config

        // 2. Expect Game Canvas
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible({ timeout: 10000 });

        // 3. Simulate a Click (Drop Fruit)
        // Wait for "next fruit" or similar readiness (implicit by canvas presence usually)
        await page.waitForTimeout(1000);

        // Click center
        const box = await canvas.boundingBox();
        if (box) {
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        }

        // 4. Verify no crash (Canvas still visible)
        await page.waitForTimeout(500);
        await expect(canvas).toBeVisible();

        // 5. Check for any console errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`Error text: "${msg.text()}"`);
            }
        });
    });
});
