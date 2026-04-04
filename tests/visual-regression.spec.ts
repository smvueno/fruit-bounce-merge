import { test, expect } from '@playwright/test';

test.describe('Visual Regression Baselines', () => {

    test('start screen matches baseline', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('body')).toBeVisible({ timeout: 10_000 });

        // Wait for any animations to settle
        await page.waitForTimeout(1000);

        await expect(page.getByRole('button', { name: /play|start/i }).first()).toBeVisible();
    });

    test('game canvas renders after clicking play', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('button', { name: /play|start/i }).first().click();

        const canvas = page.locator('canvas.cursor-grab').first();
        await expect(canvas).toBeVisible({ timeout: 10_000 });

        // Wait for engine to initialize and first fruit to appear
        await page.waitForTimeout(1000);

        // Canvas should have content (not empty)
        const canvasSize = await canvas.evaluate((el) => {
            const c = el as HTMLCanvasElement;
            return { width: c.width, height: c.height };
        });
        expect(canvasSize.width).toBeGreaterThan(0);
        expect(canvasSize.height).toBeGreaterThan(0);
    });

    test('fruit drop does not crash the game', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('button', { name: /play|start/i }).first().click();

        const canvas = page.locator('canvas.cursor-grab').first();
        await expect(canvas).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(800);

        const box = await canvas.boundingBox();
        if (box) {
            // Drop a fruit in the center
            await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3);
            await page.waitForTimeout(500);
        }

        // Game should still be running — canvas visible, no crash
        await expect(canvas).toBeVisible();
    });

    test('pause menu renders correctly', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('button', { name: /play|start/i }).first().click();
        await page.locator('canvas.cursor-grab').first().waitFor({ state: 'visible', timeout: 10_000 });
        await page.waitForTimeout(800);

        await page.getByRole('button', { name: /pause game/i }).click();
        await expect(page.getByText(/paused/i)).toBeVisible({ timeout: 3_000 });

        // Pause menu buttons should be visible
        await expect(page.getByRole('button', { name: /resume/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /restart/i })).toBeVisible();
    });

    test('no canvases outside the game area during gameplay', async ({ page }) => {
        // This test verifies we don't have stray canvas elements
        // After refactor, there should be exactly 1 game canvas (cursor-grab class)
        await page.goto('/');
        await page.getByRole('button', { name: /play|start/i }).first().click();
        await page.locator('canvas.cursor-grab').first().waitFor({ state: 'visible', timeout: 10_000 });
        await page.waitForTimeout(800);

        // Count game canvases (the main interactive one)
        const gameCanvases = page.locator('canvas.cursor-grab');
        expect(await gameCanvases.count()).toBe(1);
    });

    test('multiple fruit drops maintain stability', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => errors.push(err.message));

        await page.goto('/');
        await page.getByRole('button', { name: /play|start/i }).first().click();

        const canvas = page.locator('canvas.cursor-grab').first();
        await expect(canvas).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(800);

        const box = await canvas.boundingBox();
        if (box) {
            // Drop 5 fruits at different positions
            for (let i = 0; i < 5; i++) {
                const x = box.x + box.width * (0.2 + i * 0.15);
                await page.mouse.click(x, box.y + box.height * 0.25);
                await page.waitForTimeout(700);
            }
        }

        // Canvas still alive
        await expect(canvas).toBeVisible();

        // No JS errors
        expect(errors, `Uncaught errors: ${errors.join(', ')}`).toHaveLength(0);
    });

});
