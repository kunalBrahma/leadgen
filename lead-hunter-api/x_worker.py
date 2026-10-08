import asyncio
import json
import re
import hashlib
import random
import redis
import argparse
import urllib.parse
from playwright.async_api import async_playwright
import requests

# 1. Connect to Local Redis
r = redis.Redis(host='localhost', port=6380, db=0)

FORBIDDEN_KEYWORDS = [
    "solo creator", "build in public", "public roast",
    "cursor", "built my mvp", "building my mvp",
    "indie hacker", "my saas", "building in public",
    "i build websites", "i design websites", "web developer", "i'm a developer",
    "freelance dev", "i help businesses build", "web design agency",
    "i create websites", "just launched my portfolio", "my portfolio site"
]

# English-speaking foreign markets: business owners who hire web studios
BIO_TARGET_TITLES = r"\b(founder|ceo|partner|vp|director|owner|head of|small business|shop owner|store owner|realtor|consultant|therapist|contractor|operator|managing director|md|proprietor|entrepreneur|e-commerce|ecommerce|restaurant owner|clinic owner|gym owner|agency owner)\b"

# Only search English-language posts to target foreign markets (US, UK, CA, AU)
LANG_FILTER = "lang:en"

def passes_bio_filter(bio):
    if not bio:
        return False
    return bool(re.search(BIO_TARGET_TITLES, bio, re.IGNORECASE))

def create_dynamic_filter(queries):
    # ... (Your existing create_dynamic_filter logic remains unchanged) ...
    all_core_words = set()
    stop_words = {'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them', 'this', 'that', 'these', 'those', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'as', 'into', 'about', 'but', 'or', 'and', 'so', 'if', 'just', 'very', 'really', 'also', 'some', 'any', 'all', 'need', 'want', 'looking', 'find', 'get', 'hiring', 'hire'}
    for query in queries:
        query = query.strip()
        if not query: continue
        words = [w for w in query.lower().split() if w not in stop_words and len(w) > 2]
        all_core_words.update(words)
    if not all_core_words: return []
    return [re.compile('|'.join(re.escape(word) for word in all_core_words), re.IGNORECASE)]

def passes_dumb_filter(author_handle, content, patterns=None, exact_phrases=None):
    if not content: return False
    lower_content = content.lower()
    if any(word in lower_content for word in FORBIDDEN_KEYWORDS):
        return False
    if exact_phrases:
        return any(phrase.lower() in lower_content for phrase in exact_phrases)
    if patterns:
        return any(pattern.search(content) for pattern in patterns)
    return True

def fetch_live_queries():
    try:
        response = requests.get("http://localhost:3000/api/queries")
        return response.json().get("queries", ["need a website", "website redesign", "looking for web developer"])
    except Exception as e:
        print(f"⚠️ API Error: {e}")
        return ["building an mvp"]

async def scrape_user_profile(browser, handle):
    """Creates a new page, visits profile, extracts data, and closes the page."""
    clean_handle = handle.strip('@').lower()
    url = f"https://x.com/{clean_handle}"
    print(f"    🕵️ Visiting profile: {url}")
    
    page = await browser.new_page()
    try:
        await page.goto(url, timeout=15000)
        await asyncio.sleep(random.uniform(2.5, 4.0))
        
        bio, follower_count, recent_tweets = "", "0", []
        
        # Extract Bio
        try:
            bio_el = await page.query_selector('[data-testid="UserDescription"]')
            if bio_el: bio = await bio_el.inner_text()
        except: pass
        
        # Extract Followers (Robust Selector)
        try:
            follower_links = await page.query_selector_all(f'a[href*="/{clean_handle}/followers" i]')
            for fl in follower_links:
                text = await fl.inner_text()
                if "Followers" in text or "followers" in text.lower():
                    follower_count = text.lower().replace("followers", "").strip()
                    break
        except: pass
        
        # Extract Last 3 Tweets
        try:
            tweets = await page.query_selector_all('article[data-testid="tweet"]')
            for tweet in tweets[:3]:
                text_content = await tweet.inner_text()
                lines = text_content.split('\n')
                if len(lines) >= 4:
                    recent_tweets.append("\n".join(lines[4:10]))
        except: pass
        
        return {
            "bio": bio,
            "followerCount": follower_count,
            "recentTweets": recent_tweets
        }
    except Exception as e:
        print(f"    ⚠️ Error scraping profile {clean_handle}: {e}")
        return None
    finally:
        await page.close()

async def run_worker():
    parser = argparse.ArgumentParser(description="X Lead Scraper V2")
    parser.add_argument("--mode", choices=["keyword", "trigger", "authority"], default="keyword", help="Scraping modality")
    parser.add_argument("queries", nargs="*", help="List of queries or target handle")
    args = parser.parse_args()

    print(f"🕵️  X Worker initializing in {args.mode.upper()} mode...")
    
    live_queries = args.queries
    if not live_queries and args.mode in ["keyword", "trigger"]:
        live_queries = fetch_live_queries()
    elif not live_queries and args.mode == "authority":
        print("❌ Authority mode requires a target handle. Exiting.")
        return

    dynamic_patterns = []
    if args.mode == "keyword":
        dynamic_patterns = create_dynamic_filter(live_queries)

    async with async_playwright() as p:
        browser = await p.chromium.launch_persistent_context(
            user_data_dir="./x_auth",
            headless=False,
            viewport={"width": 1280, "height": 720},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox", "--disable-dev-shm-usage"],
            ignore_default_args=["--enable-automation"]
        )
        
        main_page = await browser.new_page()

        if args.mode in ["keyword", "trigger"]:
            for query in live_queries:
                # Safe URL Encoding
                search_term = f'"{query}"' if args.mode == "trigger" else query
                # Append English language filter to target foreign markets (US, UK, CA, AU)
                search_term_with_lang = f"{search_term} {LANG_FILTER}"
                encoded_query = urllib.parse.quote(search_term_with_lang)
                url = f"https://x.com/search?q={encoded_query}&src=typed_query&f=live"
                
                print(f"\n🔍 Searching: {url}")
                await main_page.goto(url)
                await asyncio.sleep(random.uniform(3.5, 6.2))
                
                for _ in range(3):
                    await main_page.mouse.wheel(0, 1500)
                    await asyncio.sleep(random.uniform(1.5, 3.0))

                tweets = await main_page.query_selector_all('article[data-testid="tweet"]')
                print(f"  📄 Found {len(tweets)} tweets")
                
                for tweet in tweets:
                    try:
                        text_content = await tweet.inner_text()
                        lines = text_content.split('\n')
                        if len(lines) < 4: continue
                        
                        handles = [line for line in lines if line.startswith('@')]
                        if not handles:
                            print(f"    ⏭️ SKIP: No @handle found in tweet")
                            continue
                        author_handle = handles[0]
                        content = "\n".join(lines[4:])
                        platform_post_id = f"tw_{hashlib.sha256(content.encode()).hexdigest()[:16]}"
                        
                        # ID Extraction
                        time_element = await tweet.query_selector("time")
                        if time_element:
                            anchor = await time_element.evaluate_handle("el => el.closest('a')")
                            if anchor:
                                relative_url = await anchor.get_attribute("href")
                                if relative_url: platform_post_id = relative_url.split('/')[-1]
                        
                        if r.sismember("seen_posts", platform_post_id):
                            print(f"    ⏭️ DEDUP: {author_handle} (already seen)")
                            continue
                        
                        passed = passes_dumb_filter(author_handle, content, 
                                                    patterns=dynamic_patterns if args.mode == "keyword" else None,
                                                    exact_phrases=[query] if args.mode == "trigger" else None)
                            
                        if not passed:
                            print(f"    ⏭️ CONTENT-FILTER: {author_handle} (failed keyword/phrase match)")
                            continue
                        
                        r.sadd("seen_posts", platform_post_id)
                        
                        # Safely scrape profile using browser context
                        profile_data = await scrape_user_profile(browser, author_handle)
                        if not profile_data:
                            print(f"    ⏭️ PROFILE-FAIL: {author_handle} (could not load profile)")
                            continue
                            
                        bio = profile_data.get("bio", "")
                        if not passes_bio_filter(bio):
                            print(f"    ⏭️ BIO-REJECT: {author_handle} (Bio: '{bio[:40]}')")
                            continue
                        
                        lead_data = {
                            "platform": "X",
                            "platformPostId": platform_post_id, 
                            "authorHandle": author_handle,
                            "content": content,
                            "url": f"https://x.com/{author_handle.strip('@')}/status/{platform_post_id}",
                            "searchContext": query,
                            "bio": bio,
                            "followerCount": profile_data.get("followerCount", "0"),
                            "recentTweets": profile_data.get("recentTweets", [])
                        }
                        
                        r.lpush("raw_leads", json.dumps(lead_data))
                        print(f"🎯 MATCH! Pushed {author_handle} to queue.")
                    except Exception:
                        pass

        elif args.mode == "authority":
            target_handle = f"@{live_queries[0].strip('@')}"
            print(f"\n🔍 Authority Target: {target_handle}")
            
            await main_page.goto(f"https://x.com/{target_handle.strip('@')}")
            await asyncio.sleep(random.uniform(4.0, 6.0))
            
            post_links = []
            tweets = await main_page.query_selector_all('article[data-testid="tweet"]')
            for tweet in tweets[:10]:
                try:
                    time_element = await tweet.query_selector("time")
                    if time_element:
                        anchor = await time_element.evaluate_handle("el => el.closest('a')")
                        if anchor:
                            href = await anchor.get_attribute("href")
                            if href and '/status/' in href:
                                post_links.append(f"https://x.com{href}")
                    if len(post_links) >= 5: break
                except: pass
            
            for post_url in post_links:
                print(f"  🔗 Scraping replies from: {post_url}")
                await main_page.goto(post_url)
                await asyncio.sleep(random.uniform(4.0, 6.0))
                
                for _ in range(2):
                    await main_page.mouse.wheel(0, 1500)
                    await asyncio.sleep(random.uniform(1.5, 3.0))
                    
                replies = await main_page.query_selector_all('article[data-testid="tweet"]')
                for reply in replies[1:]: # Skip main post
                    try:
                        text_content = await reply.inner_text()
                        lines = text_content.split('\n')
                        if len(lines) < 4: continue
                        
                        handles = [line for line in lines if line.startswith('@')]
                        if not handles: continue
                        author_handle = handles[0]
                        if author_handle == target_handle: continue
                            
                        content = "\n".join(lines[4:])
                        platform_post_id = f"tw_{hashlib.sha256(content.encode()).hexdigest()[:16]}"
                        
                        time_element = await reply.query_selector("time")
                        if time_element:
                            anchor = await time_element.evaluate_handle("el => el.closest('a')")
                            if anchor:
                                href = await anchor.get_attribute("href")
                                if href: platform_post_id = href.split('/')[-1]
                        
                        if r.sismember("seen_posts", platform_post_id): continue
                        r.sadd("seen_posts", platform_post_id)
                        
                        profile_data = await scrape_user_profile(browser, author_handle)
                        if not profile_data: continue
                            
                        bio = profile_data.get("bio", "")
                        if not passes_bio_filter(bio): continue
                        
                        lead_data = {
                            "platform": "X",
                            "platformPostId": platform_post_id,
                            "authorHandle": author_handle,
                            "content": content,
                            "url": f"https://x.com/{author_handle.strip('@')}/status/{platform_post_id}",
                            "searchContext": f"Replied to {target_handle}",
                            "bio": bio,
                            "followerCount": profile_data.get("followerCount", "0"),
                            "recentTweets": profile_data.get("recentTweets", [])
                        }
                        r.lpush("raw_leads", json.dumps(lead_data))
                        print(f"🎯 MATCH! Pushed {author_handle} (Authority) to queue.")
                    except Exception:
                        pass

        print("\n💤 Worker finished cycle. Closing browser.")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_worker())