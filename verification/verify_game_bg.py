from playwright.sync_api import sync_playwright

def test_game_bg():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--use-gl=swiftshader'])
        page = browser.new_page()
        page.goto("http://localhost:4008")

        # Click the play button
        page.get_by_role("button", name="PLAY").click()

        # Wait for the score board or game to appear
        page.wait_for_timeout(2000) # give it 2 seconds to transition and render the game

        # Take screenshot
        page.screenshot(path="verification/game_bg_screenshot.png")

        browser.close()

if __name__ == "__main__":
    test_game_bg()
