import os
from playwright.sync_api import sync_playwright, expect

def verify_game_ui(page):
    page.goto("http://localhost:4173/fruit-bounce-merge/")

    # Click Play button
    print("Clicking Play...")
    page.get_by_role("button", name="PLAY").click()

    # Wait for canvas to load
    print("Waiting for canvas...")
    page.wait_for_selector("canvas", timeout=5000)

    print("Checking SAVE label...")
    save_label = page.get_by_text("SAVE")
    expect(save_label).to_be_visible()

    print("Checking EMPTY label...")
    empty_label = page.get_by_text("EMPTY")
    expect(empty_label).to_be_visible()

    # Take a screenshot
    page.screenshot(path="/home/jules/verification/verification.png")
    print("Screenshot saved to /home/jules/verification/verification.png")

if __name__ == "__main__":
    os.makedirs("/home/jules/verification", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_game_ui(page)
        finally:
            browser.close()
