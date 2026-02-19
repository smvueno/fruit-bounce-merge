import { test, expect } from '@playwright/test';

test.describe('Fruit Bounce Merge', () => {

    test('start screen loads and shows play button', async ({ page }) => {
        await page.goto('/');

        // Start screen is visible — no canvas yet (GameCanvas only renders when PLAYING)
        await expect(page.locator('body')).toBeVisible({ timeout: 10_000 });

        // A play/start button must exist on the start screen
        const playBtn = page.getByRole('button', { name: /play|start/i }).first();
        await expect(playBtn).toBeVisible({ timeout: 10_000 });
    });

    test('clicking play starts the game and canvas appears', async ({ page }) => {
        await page.goto('/');

        const playBtn = page.getByRole('button', { name: /play|start/i }).first();
        await playBtn.click();

        // GameCanvas mounts and creates the PIXI canvas element
        const canvas = page.locator('canvas').first();
        await expect(canvas).toBeVisible({ timeout: 10_000 });
    });

    test('can drop a fruit by clicking the canvas', async ({ page }) => {
        await page.goto('/');

        await page.getByRole('button', { name: /play|start/i }).first().click();

        const canvas = page.locator('canvas').first();
        await expect(canvas).toBeVisible({ timeout: 10_000 });

        // Wait for engine to fully initialize
        await page.waitForTimeout(800);

        const box = await canvas.boundingBox();
        if (box) {
            await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3);
        }

        await page.waitForTimeout(500);

        // Canvas still alive — no crash
        await expect(canvas).toBeVisible();
    });

    test('pause button opens pause menu', async ({ page }) => {
        await page.goto('/');

        await page.getByRole('button', { name: /play|start/i }).first().click();
        await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 10_000 });
        await page.waitForTimeout(800);

        await page.getByRole('button', { name: /pause game/i }).click();

        // Pause menu shows "PAUSED" heading
        await expect(page.getByText(/paused/i)).toBeVisible({ timeout: 3_000 });
    });

    test('resume button closes pause menu', async ({ page }) => {
        await page.goto('/');

        await page.getByRole('button', { name: /play|start/i }).first().click();
        await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 10_000 });
        await page.waitForTimeout(800);

        await page.getByRole('button', { name: /pause game/i }).click();
        await expect(page.getByText(/paused/i)).toBeVisible({ timeout: 3_000 });

        await page.getByRole('button', { name: /resume/i }).click();

        await expect(page.getByText(/paused/i)).not.toBeVisible({ timeout: 3_000 });
    });

    test('no uncaught JS errors during basic gameplay', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => errors.push(err.message));

        await page.goto('/');
        await page.getByRole('button', { name: /play|start/i }).first().click();

        const canvas = page.locator('canvas').first();
        await expect(canvas).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(1000);

        // Drop several fruits to stress the engine
        const box = await canvas.boundingBox();
        if (box) {
            for (let i = 0; i < 5; i++) {
                const x = box.x + box.width * (0.2 + i * 0.15);
                await page.mouse.click(x, box.y + box.height * 0.25);
                await page.waitForTimeout(700);
            }
        }

        expect(errors, `Uncaught JS errors: ${errors.join(', ')}`).toHaveLength(0);
    });

});
