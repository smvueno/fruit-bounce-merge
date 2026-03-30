import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            args=[
                "--use-gl=swiftshader",
                "--enable-webgl",
                "--ignore-gpu-blocklist",
                "--no-sandbox"
            ],
            headless=True
        )
        page = await browser.new_page(
            viewport={"width": 1280, "height": 720}
        )

        page.on("console", lambda msg: print(f"Browser console: {msg.text}"))

        await page.goto("http://localhost:4179") # preview port
        await page.wait_for_selector("text=PLAY")
        await page.click("text=PLAY")
        await page.wait_for_timeout(3000)

        # Take screenshot of the whole page, and also just the game canvas
        await page.screenshot(path="verification/fixed_floor.png")
        canvas = await page.query_selector('canvas')
        if canvas:
             await canvas.screenshot(path="verification/canvas_floor.png")
        await browser.close()

asyncio.run(run())
