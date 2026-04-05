import { test, expect } from '@playwright/test';

/**
 * Cloud Rendering Benchmark — ParticleContainer vs alternatives.
 * Tests 4 techniques with looping clouds at various counts.
 * Measures FPS, visual quality, and scalability.
 */

test.describe('Cloud Rendering Benchmark', () => {
    test.setTimeout(300_000);

    const TECHNIQUES = ['graphics', 'sprite', 'particleContainer', 'batchedGraphics'];
    const CLOUD_COUNTS = [10, 50, 100, 250, 500, 1000];
    const TEST_DURATION_MS = 3000;
    const results: { technique: string; count: number; avgFps: number; minFps: number; maxFps: number; passed: boolean }[] = [];

    async function runTechniqueTest(page: any, technique: string, count: number) {
        await page.evaluate(() => {
            (window as any).__benchResults = null;
            (window as any).__benchDone = false;
        });

        await page.goto('http://localhost:5100/benchmark-clouds.html');
        await page.waitForFunction(() => (window as any).__ready === true, { timeout: 10000 });
        await page.waitForTimeout(300);

        await page.evaluate((cfg) => {
            (window as any).__startBenchmark(cfg);
        }, { technique, count, duration: TEST_DURATION_MS });

        await page.waitForFunction(() => (window as any).__benchDone === true, { timeout: TEST_DURATION_MS + 10000 });

        const result = await page.evaluate(() => (window as any).__benchResults);
        return result;
    }

    test('benchmark all techniques and counts', async ({ page }) => {
        console.log('\n=== Cloud Rendering Benchmark (Looping) ===\n');
        console.log(`Techniques: ${TECHNIQUES.join(', ')}`);
        console.log(`Cloud counts: ${CLOUD_COUNTS.join(', ')}`);
        console.log(`Test duration: ${TEST_DURATION_MS}ms per test\n`);

        for (const technique of TECHNIQUES) {
            for (const count of CLOUD_COUNTS) {
                const result = await runTechniqueTest(page, technique, count);
                const passed = result.avgFps >= 55;
                const rating = result.avgFps >= 55 ? '✅ EXCELLENT' : result.avgFps >= 30 ? '⚠️ ACCEPTABLE' : '❌ POOR';

                results.push({ technique, count, avgFps: result.avgFps, minFps: result.minFps, maxFps: result.maxFps, passed });

                console.log(
                    `${technique.padEnd(20)} | ${String(count).padStart(5)} clouds | ` +
                    `Avg: ${result.avgFps.toFixed(1).padStart(6)} FPS | ` +
                    `Min: ${result.minFps.toFixed(1).padStart(6)} FPS | ` +
                    `Max: ${result.maxFps.toFixed(1).padStart(6)} FPS | ${rating}`
                );
            }
            console.log('');
        }

        // Summary
        console.log('\n=== SUMMARY ===\n');

        for (const count of CLOUD_COUNTS) {
            const countResults = results.filter(r => r.count === count).sort((a, b) => b.avgFps - a.avgFps);
            const best = countResults[0];
            console.log(`${String(count).padStart(5)} clouds → Best: ${best.technique.padEnd(20)} (${best.avgFps.toFixed(1)} FPS avg)`);
        }

        console.log('\n=== OVERALL RANKING ===\n');

        const techAverages = TECHNIQUES.map(t => {
            const techResults = results.filter(r => r.technique === t);
            const avg = techResults.reduce((sum, r) => sum + r.avgFps, 0) / techResults.length;
            const minAvg = Math.min(...techResults.map(r => r.avgFps));
            return { technique: t, avgFps: avg, minAvg };
        }).sort((a, b) => b.avgFps - a.avgFps);

        for (const [i, t] of techAverages.entries()) {
            console.log(`#${i + 1} ${t.technique.padEnd(20)} | Overall avg: ${t.avgFps.toFixed(1)} FPS | Worst case: ${t.minAvg.toFixed(1)} FPS`);
        }

        // Assertions — ParticleContainer should be best overall
        const pcResults = results.filter(r => r.technique === 'particleContainer');
        const pcAvg = pcResults.reduce((sum, r) => sum + r.avgFps, 0) / pcResults.length;

        const spriteResults = results.filter(r => r.technique === 'sprite');
        const spriteAvg = spriteResults.reduce((sum, r) => sum + r.avgFps, 0) / spriteResults.length;

        console.log(`\nParticleContainer avg: ${pcAvg.toFixed(1)} FPS`);
        console.log(`Sprite avg: ${spriteAvg.toFixed(1)} FPS`);

        expect(pcAvg).toBeGreaterThan(spriteAvg);
    });
});
