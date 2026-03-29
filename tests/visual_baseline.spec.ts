import { test, expect } from '@playwright/test';

test('capture baseline visuals', async ({ page }) => {
    // Navigate to the game
    await page.goto('http://localhost:4000');

    // Wait for the game to load and click Play
    await page.waitForTimeout(2000);
    const playButton = page.getByRole('button', { name: /play|start/i }).first();
    await playButton.click();

    // Wait for the game to actually start
    await page.waitForTimeout(1000);

    const canvas = await page.$('canvas');
    if (!canvas) throw new Error("Could not find main game canvas");

    // The canvas is full screen now. We need the Game Area box for dropping fruits.
    // The game area has className w-full aspect-[4/5]
    const gameArea = await page.$('div.aspect-\\[4\\/5\\]');
    if (!gameArea) throw new Error("Could not find Game Area div");

    const boundingBox = await gameArea.boundingBox();
    if (!boundingBox) throw new Error("Could not get bounding box of canvas");

    const centerX = boundingBox.x + boundingBox.width / 2;
    const startY = boundingBox.y + 100;

    // Drop 10 fruits
    for (let i = 0; i < 10; i++) {
        // Random offset between -20% and 20% of width
        const offsetX = (Math.random() - 0.5) * boundingBox.width * 0.4;
        await page.mouse.click(centerX + offsetX, startY);
        await page.waitForTimeout(700); // Wait slightly longer than spawnDelay
    }

    // Wait for physics to settle a bit
    await page.waitForTimeout(2000);

    // Take screenshot 1: Fruits settled
    await page.screenshot({ path: 'verification/baseline_1_settled.png', fullPage: true });

    // Wait a bit to capture moving clouds/background
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'verification/baseline_2_moving.png', fullPage: true });

    // Try to spawn another fruit to capture some effect/juice
    await page.mouse.click(centerX, startY);
    await page.waitForTimeout(100);
    await page.screenshot({ path: 'verification/baseline_3_action.png', fullPage: true });
});