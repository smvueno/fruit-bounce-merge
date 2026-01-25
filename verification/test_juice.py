from playwright.sync_api import sync_playwright, expect
import time

def test_juice_overlay():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        try:
            page.goto("http://localhost:4000", timeout=30000)
        except Exception as e:
            print(f"Failed to load page: {e}")
            return

        # Click Play
        try:
            page.wait_for_selector("text=PLAY", timeout=10000)
            page.get_by_text("PLAY").click()
            print("Clicked Play")
        except:
            print("Play button not found")
            print(page.content())
            return

        # Wait for canvas to load
        try:
            page.wait_for_selector("canvas", timeout=10000)
            print("Canvas found!")
        except:
            print("Canvas not found")
            return

        # 1. Capture state at 0 juice
        time.sleep(2)
        page.screenshot(path="verification/juice_0.png")
        print("Captured juice_0.png")

        # 2. Inject Juice (50%)
        # JUICE_MAX is 1500. So 750.
        print("Injecting 50% juice")
        page.evaluate("if(window.gameEngine) { window.gameEngine.juice = 750; window.gameEngine.onJuiceUpdate(750, 1500); }")

        # Wait for transition
        time.sleep(4)
        page.screenshot(path="verification/juice_50.png")
        print("Captured juice_50.png")

        # 3. Inject Juice (100%)
        print("Injecting 100% juice")
        page.evaluate("if(window.gameEngine) { window.gameEngine.juice = 1500; window.gameEngine.onJuiceUpdate(1500, 1500); }")

        time.sleep(4)
        page.screenshot(path="verification/juice_100.png")
        print("Captured juice_100.png")

        browser.close()

if __name__ == "__main__":
    test_juice_overlay()
