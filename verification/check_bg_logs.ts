import { chromium } from 'playwright';

async function run() {
    const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('console', msg => {
        console.log('BROWSER LOG:', msg.text());
    });

    page.on('pageerror', err => {
        console.log('BROWSER ERROR:', err.message);
    });

    await page.goto('http://localhost:4001');
    await page.waitForTimeout(3000);

    await browser.close();
}

run();
