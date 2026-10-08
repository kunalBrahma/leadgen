import json
import asyncio
from playwright.async_api import async_playwright

COOKIE_FILE = "linkedin_cookies.json"

async def generate_cookies():
    print("🕵️ Starting Stealth Browser for LinkedIn Auth...")
    
    async with async_playwright() as p:
        # We are using a persistent context with stealth arguments 
        # identical to your successful X worker!
        browser_context = await p.chromium.launch_persistent_context(
            user_data_dir="./linkedin_auth_profile",
            headless=False,
            viewport={"width": 1280, "height": 720},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ],
            ignore_default_args=["--enable-automation"]
        )
        
        page = await browser_context.new_page()
        
        # Go to LinkedIn Login
        await page.goto("https://www.linkedin.com/login")
        
        print("\n========================================================")
        print("⏳ BROWSER IS OPEN. Action Required:")
        print("1. Log into your burner LinkedIn account.")
        print("2. Pass any security checks/2FA.")
        print("3. Wait until you see the LinkedIn feed load completely.")
        print("========================================================\n")
        
        # Pause script until you give the green light
        input("Press ENTER in this terminal ONLY AFTER you see your LinkedIn feed...")
        
        # Extract and save the session cookies
        cookies = await browser_context.cookies()
        
        with open(COOKIE_FILE, "w") as f:
            json.dump(cookies, f)
            
        print(f"\n✅ SUCCESS! Extracted {len(cookies)} cookies and saved to {COOKIE_FILE}.")
        
        await browser_context.close()

if __name__ == "__main__":
    asyncio.run(generate_cookies())