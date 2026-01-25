from playwright.sync_api import sync_playwright
import time

def verify_game_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Emulate mobile viewport to match expected use case
        context = browser.new_context(viewport={'width': 450, 'height': 800})
        page = context.new_page()

        # Navigate to the game (Port 4000 as seen in logs)
        page.goto("http://localhost:4000/")

        # Wait for any content to load by waiting for body
        page.wait_for_selector('body', timeout=10000)

        # Take a debug screenshot to see what's rendering
        page.screenshot(path="verification/debug_load.png")

        # Try to find the start button with a more generic selector if text fails
        # Inspecting StartScreen.tsx might help, but let's try 'button'
        try:
            page.wait_for_selector('button', timeout=5000)
            print("Found button")
            # Click the first button (likely start or play)
            # Or specifically look for the play icon
            page.click('button')
        except:
            print("Could not find button, dumping text")
            print(page.inner_text('body'))


        # Wait for transition to playing state
        time.sleep(2)

        # Screenshot 1: Gameplay UI
        page.screenshot(path="verification/gameplay_ui.png")

        browser.close()

if __name__ == "__main__":
    verify_game_ui()
