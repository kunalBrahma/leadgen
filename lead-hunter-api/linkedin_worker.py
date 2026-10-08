import asyncio
import json
import urllib.parse
import re
import random
import redis
import argparse
from playwright.async_api import async_playwright

# 1. Connect to Local Redis
r = redis.Redis(host='localhost', port=6380, db=0)
COOKIE_FILE = "linkedin_cookies.json"

# Expanded bio filter to catch web-service buyers: business owners, operators, self-employed professionals
BIO_TARGET_TITLES = r"\b(founder|ceo|partner|vp|director|owner|head of|small business|shop owner|store owner|realtor|real estate|consultant|therapist|contractor|operator|managing director|proprietor|entrepreneur|e-commerce|ecommerce|restaurant|clinic|gym|agency owner|self.employed|business owner)\b"

# Foreign English-speaking market geoUrns for LinkedIn location filtering
# US=103644278, UK=101165590, Canada=101174742, Australia=101452733, New Zealand=105490917, Ireland=104738515
FOREIGN_MARKET_GEOURN = "%5B%22103644278%22%2C%22101165590%22%2C%22101174742%22%2C%22101452733%22%2C%22105490917%22%2C%22104738515%22%5D"

def passes_bio_filter(bio):
    if not bio:
        return False
    return bool(re.search(BIO_TARGET_TITLES, bio, re.IGNORECASE))

async def load_cookies(context):
    try:
        with open(COOKIE_FILE, "r") as f:
            cookies = json.load(f)
        await context.add_cookies(cookies)
        print(f"🍪 Loaded {len(cookies)} cookies into session.")
    except Exception as e:
        print(f"❌ Failed to load cookies. Did you run linkedin_auth.py? Error: {e}")

async def run_worker():
    parser = argparse.ArgumentParser(description="LinkedIn Lead Scraper V2")
    parser.add_argument("queries", nargs="+", help="List of queries to search on LinkedIn")
    args = parser.parse_args()

    print("🕵️  LinkedIn Worker initializing in Stealth Mode...")

    async with async_playwright() as p:
        # Launch with the exact same stealth flags that bypassed the security
        browser = await p.chromium.launch(
            headless=False, # Keep False for the first test to watch it work!
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ],
            ignore_default_args=["--enable-automation"]
        )
        
        # We use a standard context but inject our authorized cookies
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        
        await load_cookies(context)
        page = await context.new_page()

        for query in args.queries:
            # LinkedIn Content Search URL (Sorted by Date Posted)
            encoded_query = urllib.parse.quote(query)
            # Filter to English-speaking foreign markets: US, UK, Canada, Australia, NZ, Ireland
            search_url = f"https://www.linkedin.com/search/results/content/?keywords={encoded_query}&sortBy=%22date_posted%22&geoUrn={FOREIGN_MARKET_GEOURN}"
            
            print(f"\n🔍 Searching LinkedIn: '{query}'")
            await page.goto(search_url)
            await asyncio.sleep(random.uniform(4.0, 6.0))
            
            # Scroll down to load posts
            for _ in range(3):
                await page.mouse.wheel(0, 1500)
                await asyncio.sleep(random.uniform(2.0, 3.5))

            # LinkedIn's post containers
            posts = await page.query_selector_all('.feed-shared-update-v2')
            print(f"  📄 Found {len(posts)} posts on page")
            
            for post in posts:
                try:
                    # Extract Author Name & Username
                    name_el = await post.query_selector('.update-components-actor__name')
                    author_name = await name_el.inner_text() if name_el else "Unknown"
                    author_name = author_name.split('\n')[0].strip() # Clean up extra spans
                    
                    author_handle = author_name
                    profile_url_el = await post.query_selector('.update-components-actor__meta-link, .app-aware-link')
                    profile_url = await profile_url_el.get_attribute('href') if profile_url_el else ""
                    
                    if "/in/" in profile_url:
                        parts = profile_url.split('/in/')
                        if len(parts) > 1:
                            username = parts[1].split('?')[0].strip('/')
                            if username:
                                author_handle = f"@{username}"

                    # Extract Bio / Headline
                    bio_el = await post.query_selector('.update-components-actor__description')
                    bio = await bio_el.inner_text() if bio_el else ""
                    bio = bio.strip()

                    # Extract Post Content
                    content_el = await post.query_selector('.update-components-text')
                    content = await content_el.inner_text() if content_el else ""
                    content = content.strip()

                    # Extract Post URL (to jump straight to it from your dashboard)
                    post_urn = await post.get_attribute('data-urn')
                    if post_urn:
                        post_url = f"https://www.linkedin.com/feed/update/{post_urn}/"
                    else:
                        url_el = await post.query_selector('.update-components-actor__container-link')
                        post_url = await url_el.get_attribute('href') if url_el else search_url
                    
                    # Create a unique ID for deduplication
                    platform_post_id = f"li_{hash(content)}"

                    # 1. Check if we already processed this post
                    if r.sismember("seen_posts_li", platform_post_id):
                        continue
                        
                    # 2. Pre-qualify the lead using their LinkedIn Headline (Bio)
                    if not passes_bio_filter(bio):
                        print(f"    ⏭️ AUTO-REJECT: {author_handle} (Bio: {bio[:30]}...)")
                        continue

                    # Mark as seen
                    r.sadd("seen_posts_li", platform_post_id)
                    
                    # 3. Format the payload exactly how the Next.js Grader expects it
                    lead_data = {
                        "platform": "LinkedIn",
                        "platformPostId": platform_post_id, 
                        "authorHandle": author_handle,
                        "content": content,
                        "url": post_url.split('?')[0], # Clean URL tracking tags
                        "searchContext": query,
                        "bio": bio,
                        "followerCount": "Hidden", # We don't need this for LI, Bio is strong enough
                        "recentTweets": [] # Empty array to keep TypeScript happy
                    }
                    
                    # 4. Push to the AI Grader Queue!
                    r.lpush("raw_leads", json.dumps(lead_data))
                    print(f"🎯 MATCH! Pushed {author_handle} to AI Grader queue.")
                    
                except Exception as e:
                    pass # Skip unparseable posts silently

        print("\n💤 LinkedIn Worker finished cycle. Closing browser.")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_worker())
