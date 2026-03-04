import asyncio
from playwright.async_api import async_playwright

async def login():
    print("🔐 Opening Chrome to X.com...")

    async with async_playwright() as p:
        browser = await p.chromium.launch_persistent_context(
            user_data_dir="./x_auth",
            channel="chrome",
            headless=False,
            viewport={"width": 1280, "height": 720},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                "--no-default-browser-check",
            ],
            ignore_default_args=["--enable-automation"]
        )

        page = await browser.new_page()
        await page.goto("https://x.com")

        print("\n✅ Browser is open!")
        print("👉 Log in to X (try 'Sign in with Google' if normal login fails)")
        print("👉 Once you see your feed, come back here and press ENTER\n")

        input("Press ENTER when done...")

        print("💾 Session saved! Now run: python x_worker.py")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(login())
