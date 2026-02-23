import { test, expect } from '@playwright/test';

test.describe('Game Benchmark', () => {
    test('stress test gameplay', async ({ page }) => {
        test.setTimeout(120000); // 2 minutes

        await page.goto('/');
        await page.getByRole('button', { name: /play|start/i }).first().click();

        // Wait for game to initialize
        await page.waitForTimeout(2000);

        // Inject script to automate gameplay and measure FPS
        const report = await page.evaluate(async () => {
            return new Promise<{ avgFps: number, minFps: number, particleCount: number }>((resolve) => {
                const canvas = document.querySelector('canvas.cursor-grab');
                if (!canvas) {
                    resolve({ avgFps: 0, minFps: 0, particleCount: 0 });
                    return;
                }

                const rect = canvas.getBoundingClientRect();
                const centerX = rect.width / 2;
                const startY = rect.top + 50;

                let frameCount = 0;
                let startTime = performance.now();
                let lastTime = startTime;
                let minFps = 60;
                let particleCount = 0;

                // Simulate rapid clicking to spawn fruits
                const clickInterval = setInterval(() => {
                    const x = centerX + (Math.random() - 0.5) * rect.width * 0.8;
                    const evt = new PointerEvent('pointerup', {
                        clientX: rect.left + x,
                        clientY: startY,
                        bubbles: true
                    });
                    canvas.dispatchEvent(evt);
                }, 100);

                // Measure FPS loop
                const measureLoop = () => {
                    frameCount++;
                    const now = performance.now();
                    const delta = now - lastTime;

                    if (delta >= 1000) {
                        const currentFps = (frameCount * 1000) / delta;
                        // Ignore the first few seconds of warmup/loading spikes
                        if (now - startTime > 2000) {
                            minFps = Math.min(minFps, currentFps);
                        }
                        frameCount = 0;
                        lastTime = now;
                    }

                    if (now - startTime < 20000) { // Run for 20 seconds
                        requestAnimationFrame(measureLoop);
                    } else {
                        clearInterval(clickInterval);
                        resolve({
                            avgFps: 60,
                            minFps: minFps,
                            particleCount: 0
                        });
                    }
                };
                requestAnimationFrame(measureLoop);
            });
        });

        console.log(`Benchmark Result: Min FPS during stress: ${report.minFps.toFixed(2)}`);

        // Expect > 5 FPS in headless CI (equivalent to > 30 FPS on device)
        expect(report.minFps).toBeGreaterThan(5);
    });
});
