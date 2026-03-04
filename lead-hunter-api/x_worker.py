import asyncio
import json
import re
import random
import redis
import sys
from playwright.async_api import async_playwright

import requests

# 1. Connect to Local Redis (Docker container on port 6380)
r = redis.Redis(host='localhost', port=6380, db=0)


def create_dynamic_filter(queries):
    """
    Takes a list of query strings from the frontend and generates 
    compiled regex patterns based on the core words in each query.
    
    Uses a LENIENT approach: a tweet matches if it contains ANY of the 
    core words from ANY query. X.com search already does the heavy 
    semantic lifting — this is just a lightweight sanity gate.
    """
    all_core_words = set()
    
    # Common stop words to strip out for cleaner matching
    stop_words = {
        'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'can', 'shall', 'i', 'me', 'my', 'we',
        'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them', 'this',
        'that', 'these', 'those', 'of', 'in', 'on', 'at', 'to', 'for',
        'with', 'by', 'from', 'as', 'into', 'about', 'but', 'or', 'and',
        'so', 'if', 'just', 'very', 'really', 'also', 'some', 'any', 'all',
        'need', 'want', 'looking', 'find', 'get', 'hiring', 'hire',
    }
    
    for query in queries:
        query = query.strip()
        if not query:
            continue
        
        # Extract core words (remove stop words)
        words = [w for w in query.lower().split() if w not in stop_words and len(w) > 2]
        all_core_words.update(words)
        print(f"  📋 Query '{query}' → core words: {words}")
    
    if not all_core_words:
        return []
    
    # Build a SINGLE regex that matches ANY core word (lenient OR)
    alternation = '|'.join(re.escape(word) for word in all_core_words)
    pattern = re.compile(alternation, re.IGNORECASE)
    
    print(f"  🎯 Combined filter: match any of {sorted(all_core_words)}")
    
    return [pattern]


def passes_dumb_filter(author_handle, content, patterns):
    """
    Check if the tweet content matches ANY of the dynamic patterns.
    Returns True if at least one pattern matches.
    """
    if not content:
        return False
        
    FORBIDDEN_KEYWORDS = [
        "solo creator", "build in public", "public roast", 
        "cursor", "built my mvp", "building my mvp",
        "indie hacker", "my saas", "building in public"
    ]

    lower_content = content.lower()
    if any(word in lower_content for word in FORBIDDEN_KEYWORDS):
        print(f"    ⏭️ AUTO-REJECT: {author_handle} (Builder Signal)")
        return False
        
    return any(pattern.search(content) for pattern in patterns)


def fetch_live_queries():
    try:
        response = requests.get("http://localhost:3000/api/queries")
        data = response.json()
        return data.get("queries", ["building an mvp"])
    except Exception as e:
        print(f"⚠️ Could not reach API, using fallback: {e}")
        return ["building an mvp"]


async def run_worker():
    print("🕵️  X Worker initializing...")
    
    # 1. Check for command-line overrides (passed from Node.js via spawn)
    if len(sys.argv) > 1:
        live_queries = [arg for arg in sys.argv[1:] if arg.strip()]
        print(f"🚀 ON-DEMAND MODE: Searching for {len(live_queries)} custom queries: {live_queries}")
    else:
        # 2. Otherwise, fetch the dynamic queries from the database
        live_queries = fetch_live_queries()
        print(f"🎯 DATABASE MODE: Loaded {len(live_queries)} target queries: {live_queries}")
    
    # 3. Build dynamic regex filters from the queries
    print("\n🔧 Building dynamic filters...")
    dynamic_patterns = create_dynamic_filter(live_queries)
    
    if not dynamic_patterns:
        print("❌ No valid filter patterns could be generated. Exiting.")
        return
    
    print(f"✅ {len(dynamic_patterns)} filter patterns ready.\n")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch_persistent_context(
            user_data_dir="./x_auth",
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
        
        page = await browser.new_page()

        for query in live_queries:
            encoded_query = query.replace(" ", "%20")
            url = f"https://x.com/search?q={encoded_query}&src=typed_query&f=live"
            
            print(f"\n🔍 Searching: {query}")
            await page.goto(url)
            
            # Random Jitter
            await asyncio.sleep(random.uniform(3.5, 6.2))
            
            # Multi-scroll to load more tweets (3 scrolls = ~3x more leads)
            for scroll_i in range(3):
                await page.mouse.wheel(0, 1500)
                await asyncio.sleep(random.uniform(1.5, 3.0))

            # Extract Tweets
            tweets = await page.query_selector_all('article[data-testid="tweet"]')
            print(f"  📄 Found {len(tweets)} tweets on page")
            
            for tweet in tweets:
                try:
                    text_content = await tweet.inner_text()
                    lines = text_content.split('\n')
                    
                    if len(lines) < 4: continue
                    
                    author_handle = [line for line in lines if line.startswith('@')][0]
                    content = "\n".join(lines[4:])
                    
                    # Extract the REAL Tweet URL and post time from the DOM
                    real_url = f"https://x.com/{author_handle.strip('@')}"
                    platform_post_id = f"mock_{hash(content)}"
                    posted_at = None
                    
                    time_element = await tweet.query_selector("time")
                    if time_element:
                        # Extract the actual post timestamp
                        posted_at = await time_element.get_attribute("datetime")
                        
                        anchor = await time_element.evaluate_handle("el => el.closest('a')")
                        if anchor:
                            relative_url = await anchor.get_attribute("href")
                            if relative_url:
                                real_url = f"https://x.com{relative_url}"
                                platform_post_id = relative_url.split('/')[-1]
                    
                    # DEDUPLICATION: Skip tweets we've already scraped
                    if r.sismember("seen_posts", platform_post_id):
                        continue
                    
                    # Apply the DYNAMIC filter instead of hardcoded patterns
                    if passes_dumb_filter(author_handle, content, dynamic_patterns):
                        # Mark as seen BEFORE pushing to prevent duplicates
                        r.sadd("seen_posts", platform_post_id)
                        
                        lead_data = {
                            "platform": "X",
                            "platformPostId": platform_post_id, 
                            "authorHandle": author_handle,
                            "content": content,
                            "url": real_url,
                            "searchContext": query,
                            "postedAt": posted_at
                        }
                        
                        r.lpush("raw_leads", json.dumps(lead_data))
                        print(f"🎯 MATCH FOUND! Pushed {author_handle} to queue.")
                    
                except Exception as e:
                    pass

        print("\n💤 Worker finished cycle. Closing browser.")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_worker())
