import { chromium } from 'playwright';

async function run() {
    const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

    // Use file protocol for local html
    await page.goto(`file://${process.cwd()}/verification/dynamic_tiling_debug3.html`);

    // Wait until testReady is set
    await page.waitForFunction(() => window.testReady === true, { timeout: 10000 }).catch(e => console.log('Wait timeout'));
    await page.waitForTimeout(500); // give it a sec to render

    await page.screenshot({ path: 'verification/tiling_debug3.png' });

    await browser.close();
}

run();
