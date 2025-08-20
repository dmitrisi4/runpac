from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print("Navigating to http://localhost:5173/")
        page.goto("http://localhost:5173/")

        print("Waiting for map container...")
        page.wait_for_selector('.leaflet-container')
        print("Map container found.")

        # Click the "Simulate Run" button
        print("Clicking 'Simulate Run' button...")
        simulate_button = page.get_by_role("button", name="Simulate Run")
        simulate_button.click()
        print("Button clicked.")

        # Wait for the distance to be updated
        print("Waiting for simulation...")
        page.wait_for_timeout(3000)

        print("Page content:")
        print(page.content())

        browser.close()

if __name__ == "__main__":
    run_verification()
