
from playwright.sync_api import sync_playwright
import time

def verify_game_start():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Enable console logging
        context = browser.new_context()
        page = context.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

        try:
            print("Navigating to http://localhost:4173/...")
            page.goto("http://localhost:4173/")

            print("Waiting for PLAY button...")
            play_btn = page.wait_for_selector("button:has-text('PLAY')", timeout=5000)

            if play_btn:
                print("PLAY button found. Clicking...")
                play_btn.click()

                print("Waiting for Game Canvas...")
                # Canvas should appear after starting
                try:
                    page.wait_for_selector("canvas", timeout=10000)
                    print("Canvas found! Game started.")
                    # Wait a bit for the first fruit to spawn/render
                    time.sleep(2)
                    page.screenshot(path="verification/gameplay.png")
                    print("Gameplay screenshot saved to verification/gameplay.png")
                except Exception as e:
                    print(f"Canvas NOT found. Game might have crashed. Error: {e}")
                    page.screenshot(path="verification/crash_state.png")
            else:
                print("PLAY button not found.")
                page.screenshot(path="verification/start_screen_missing.png")

        except Exception as e:
            print(f"Global Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_game_start()
