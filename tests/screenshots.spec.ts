import { test, expect } from '@playwright/test';

test.describe('Screenshot Verification', () => {
    test.setTimeout(60000);

    test('capture full game flow screenshots', async ({ page }) => {
        // 1. Start Screen
        await page.goto('/');
        await page.waitForTimeout(1500);
        await page.screenshot({ path: 'test-screenshots/01-start-screen.png', fullPage: true });

        // 2. Click Play — Game Canvas appears
        const playBtn = page.getByRole('button', { name: /play|start/i }).first();
        await playBtn.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-screenshots/02-game-loaded.png', fullPage: true });

        // 3. Drop first fruit
        const canvas = page.locator('canvas.cursor-grab').first();
        await expect(canvas).toBeVisible({ timeout: 10000 });
        const box = await canvas.boundingBox();
        if (box) {
            await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3);
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'test-screenshots/03-first-fruit-dropped.png', fullPage: true });
        }

        // 4. Drop 5 more fruits — show gameplay
        if (box) {
            for (let i = 0; i < 5; i++) {
                const x = box.x + box.width * (0.2 + i * 0.15);
                await page.mouse.click(x, box.y + box.height * 0.25);
                await page.waitForTimeout(800);
            }
        }
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'test-screenshots/04-multiple-fruits.png', fullPage: true });

        // 5. Close-up of game canvas (just the game area)
        if (box) {
            await page.screenshot({
                path: 'test-screenshots/05-game-canvas-closeup.png',
                clip: {
                    x: box.x - 20,
                    y: box.y - 20,
                    width: box.width + 40,
                    height: box.height + 40
                }
            });
        }

        // 6. Pause menu
        await page.getByRole('button', { name: /pause game/i }).click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-screenshots/06-pause-menu.png', fullPage: true });

        // 7. Resume
        await page.getByRole('button', { name: /resume/i }).click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-screenshots/07-resumed.png', fullPage: true });

        // 8. No JS errors check
        const errors: string[] = [];
        page.on('pageerror', (err) => errors.push(err.message));
        await page.waitForTimeout(2000);
        expect(errors, `JS errors: ${errors.join(', ')}`).toHaveLength(0);

        console.log('✅ All screenshots captured successfully');
    });
});
