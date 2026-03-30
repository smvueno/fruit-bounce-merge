from playwright.sync_api import sync_playwright
import time
import os

def test_ground_rendering(page):
    print("Navigating to http://localhost:4173")
    page.goto("http://localhost:4173")

    print("Waiting for PLAY button...")
    page.wait_for_selector("text=PLAY", timeout=10000)
    page.click("text=PLAY")

    print("Waiting for game physics/graphics to settle...")
    time.sleep(3)

    os.makedirs("/app/verification", exist_ok=True)
    screenshot_path = "/app/verification/final_floor_check.png"
    print(f"Taking screenshot to {screenshot_path}")
    page.screenshot(path=screenshot_path)
    print("Screenshot taken successfully!")

if __name__ == "__main__":
    with sync_playwright() as p:
        print("Launching browser...")
        browser = p.chromium.launch(
            headless=True,
            args=["--use-gl=swiftshader", "--disable-gpu", "--no-sandbox"]
        )
        context = browser.new_context(
            viewport={'width': 800, 'height': 600}
        )
        page = context.new_page()
        try:
            test_ground_rendering(page)
        except Exception as e:
            print(f"Error during verification: {e}")
            raise
        finally:
            browser.close()