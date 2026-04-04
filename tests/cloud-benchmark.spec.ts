import { test, expect } from '@playwright/test';

/**
 * Cloud Rendering Benchmark
 * Tests 4 Pixi.js rendering techniques for clouds at various counts.
 * Measures FPS, draw calls, and visual quality.
 */

test.describe('Cloud Rendering Benchmark', () => {
    test.setTimeout(300_000); // 5 minutes for full benchmark

    const TECHNIQUES = ['graphics', 'sprite', 'particleContainer', 'batchedGraphics'];
    const CLOUD_COUNTS = [10, 50, 100, 250];
    const TEST_DURATION_MS = 3000;
    const results: any[] = [];

    async function runTechniqueTest(page: any, technique: string, count: number) {
        // Reset state
        await page.evaluate(() => {
            (window as any).__benchResults = null;
            (window as any).__benchDone = false;
        });

        await page.goto(`http://localhost:5100/benchmark-clouds.html`);
        
        // Wait for the module to load
        await page.waitForFunction(() => (window as any).__ready === true, { timeout: 10000 });
        await page.waitForTimeout(300);

        // Start the test
        await page.evaluate((cfg) => {
            (window as any).__startBenchmark(cfg);
        }, { technique, count, duration: TEST_DURATION_MS });

        // Wait for test to complete
        await page.waitForFunction(() => (window as any).__benchDone === true, { timeout: TEST_DURATION_MS + 5000 });

        const result = await page.evaluate(() => (window as any).__benchResults);
        return result;
    }

    test('benchmark all techniques and counts', async ({ page }) => {
        // Set up the benchmark page
        await page.goto('http://localhost:5100/benchmark-clouds.html');
        await page.waitForTimeout(1000);

        console.log('\n=== Cloud Rendering Benchmark ===\n');
        console.log(`Techniques: ${TECHNIQUES.join(', ')}`);
        console.log(`Cloud counts: ${CLOUD_COUNTS.join(', ')}`);
        console.log(`Test duration: ${TEST_DURATION_MS}ms per test\n`);

        for (const technique of TECHNIQUES) {
            for (const count of CLOUD_COUNTS) {
                const result = await runTechniqueTest(page, technique, count);

                const passed = result.avgFps >= 55;
                const rating = result.avgFps >= 55 ? '✅ EXCELLENT' : result.avgFps >= 30 ? '⚠️ ACCEPTABLE' : '❌ POOR';

                results.push({
                    technique,
                    count,
                    avgFps: result.avgFps,
                    minFps: result.minFps,
                    maxFps: result.maxFps,
                    passed,
                });

                console.log(
                    `${technique.padEnd(20)} | ${String(count).padStart(5)} clouds | ` +
                    `Avg: ${result.avgFps.toFixed(1).padStart(6)} FPS | ` +
                    `Min: ${(result.minFps ?? 0).toFixed(1).padStart(6)} FPS | ` +
                    `Max: ${result.maxFps.toFixed(1).padStart(6)} FPS | ${rating}`
                );
            }
            console.log('');
        }

        // Summary
        console.log('\n=== SUMMARY ===\n');

        // Best technique for each cloud count
        for (const count of CLOUD_COUNTS) {
            const countResults = results.filter(r => r.count === count).sort((a, b) => b.avgFps - a.avgFps);
            const best = countResults[0];
            console.log(`${String(count).padStart(5)} clouds → Best: ${best.technique.padEnd(20)} (${best.avgFps.toFixed(1)} FPS avg)`);
        }

        console.log('\n=== OVERALL RANKING (by avg FPS across all counts) ===\n');

        const techAverages = TECHNIQUES.map(t => {
            const techResults = results.filter(r => r.technique === t);
            const avg = techResults.reduce((sum, r) => sum + r.avgFps, 0) / techResults.length;
            const minAvg = Math.min(...techResults.map(r => r.avgFps));
            return { technique: t, avgFps: avg, minAvg };
        }).sort((a, b) => b.avgFps - a.avgFps);

        for (const [i, t] of techAverages.entries()) {
            console.log(`#${i + 1} ${t.technique.padEnd(20)} | Overall avg: ${t.avgFps.toFixed(1)} FPS | Worst case: ${t.minAvg.toFixed(1)} FPS`);
        }

        // Save results to file for reference
        await page.evaluate((r) => {
            (window as any).__benchmarkResults = r;
        }, results);

        // Verify at least one technique passes at 100 clouds
        const hundredCloudResults = results.filter(r => r.count === 100);
        const anyPass100 = hundredCloudResults.some(r => r.passed);
        expect(anyPass100, 'At least one technique should achieve 55+ FPS at 100 clouds').toBe(true);

        // Verify at least one technique passes at 500 clouds
        const fiveHundredResults = results.filter(r => r.count === 500);
        const anyPass500 = fiveHundredResults.some(r => r.passed);
        expect(anyPass500, 'At least one technique should achieve 55+ FPS at 500 clouds').toBe(true);
    });
});
