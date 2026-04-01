import { chromium } from 'playwright';

async function run() {
    const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:4001');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'verification/bg_patterns_check3.png' });

    await browser.close();
}

run();
