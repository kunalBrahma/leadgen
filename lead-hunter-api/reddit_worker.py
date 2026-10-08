import json
import re
import hashlib
import time
import random
import redis
import argparse
import urllib.parse
import requests

# Connect to Local Redis
r = redis.Redis(host='localhost', port=6380, db=0)

API_BASE = "http://localhost:3000"

DEFAULT_SUBREDDITS = [
    "smallbusiness", "entrepreneur", "startups", "webdesign", "Wordpress"
]

def fetch_live_subreddits():
    try:
        response = requests.get(f"{API_BASE}/api/queries/subreddits", timeout=5)
        data = response.json()
        subreddits = data.get("subreddits", DEFAULT_SUBREDDITS)
        print(f"📋 Loaded {len(subreddits)} subreddits from config: {subreddits}")
        return subreddits
    except Exception as e:
        print(f"⚠️ Could not fetch subreddits from API, using defaults: {e}")
        return DEFAULT_SUBREDDITS

def already_in_db(platform_post_id: str) -> bool:
    """Check PostgreSQL via backend API to avoid re-grading on Redis restart."""
    try:
        response = requests.get(
            f"{API_BASE}/api/leads",
            params={"search": platform_post_id, "limit": "1"},
            timeout=5
        )
        data = response.json()
        leads = data.get("data", [])
        return any(l.get("platformPostId") == platform_post_id for l in leads)
    except Exception:
        return False  # If API fails, let it through

# Reddit requires a descriptive User-Agent or it blocks requests
HEADERS = {
    "User-Agent": "lead-hunter-bot/1.0 (sitemakerlab outreach tool)",
    "Accept": "application/json",
}

# Post must contain at least one of these
TARGET_KEYWORDS = [
    "need a website", "need website", "looking for a web", "looking for web",
    "hire a web", "hire web", "recommend a web", "web designer", "web developer",
    "website help", "redesign", "landing page", "no website", "build a website",
    "our website", "my website", "website not", "website looks", "website is",
    "wix", "squarespace", "wordpress help", "need a developer", "need developer",
    "find a designer", "website quote", "website cost", "how much for a website",
]

# Skip posts where author is selling or promoting
FORBIDDEN_KEYWORDS = [
    "i build websites", "i design websites", "i create websites",
    "my portfolio", "check out my work", "i'm a freelance", "i am a freelance",
    "offering my services", "dm me for", "hire me", "my rates",
    "i help businesses", "affordable web", "i build", "i design",
]

def passes_content_filter(title: str, body: str) -> bool:
    text = (title + " " + body).lower()
    if any(kw in text for kw in FORBIDDEN_KEYWORDS):
        return False
    return any(kw in text for kw in TARGET_KEYWORDS)

MAX_POST_AGE_DAYS = 14  # Skip posts older than this

def is_fresh(created_utc: float) -> bool:
    age_days = (time.time() - created_utc) / 86400
    return age_days <= MAX_POST_AGE_DAYS

def scrape_subreddit(subreddit: str, query: str) -> list:
    leads = []
    encoded_query = urllib.parse.quote(query)
    # t=week keeps results fresh — change to t=month if you want older posts
    url = f"https://www.reddit.com/r/{subreddit}/search.json?q={encoded_query}&sort=new&restrict_sr=on&t=week&limit=25"

    print(f"\n🔍 Searching r/{subreddit} for: '{query}'")

    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        if response.status_code == 429:
            print(f"    ⚠️ Rate limited — waiting 10s...")
            time.sleep(10)
            response = requests.get(url, headers=HEADERS, timeout=15)

        if response.status_code != 200:
            print(f"    ⚠️ HTTP {response.status_code} for r/{subreddit}, skipping.")
            return leads

        data = response.json()
        posts = data.get("data", {}).get("children", [])
        print(f"    📄 Found {len(posts)} posts")

        for post in posts:
            try:
                post_data = post.get("data", {})

                post_id   = post_data.get("id", "")
                title     = post_data.get("title", "").strip()
                body      = post_data.get("selftext", "").strip()
                author    = post_data.get("author", "unknown")
                permalink = post_data.get("permalink", "")
                subreddit_name = post_data.get("subreddit", subreddit)

                if not title or not post_id:
                    continue

                # Freshness check
                created_utc = post_data.get("created_utc", 0)
                if not is_fresh(created_utc):
                    age_days = int((time.time() - created_utc) / 86400)
                    print(f"    ⏭️ STALE ({age_days}d old): u/{author} | '{title[:50]}'")
                    continue

                # Remove deleted/removed posts
                if body in ("[deleted]", "[removed]"):
                    body = ""

                platform_post_id = f"rd_{post_id}"

                # Dedup: check Redis first (fast), then DB (persistent across restarts)
                if r.sismember("seen_posts_reddit", platform_post_id):
                    print(f"    ⏭️ DEDUP (cache): u/{author}")
                    continue
                if already_in_db(platform_post_id):
                    r.sadd("seen_posts_reddit", platform_post_id)  # warm cache
                    print(f"    ⏭️ DEDUP (db): u/{author}")
                    continue

                # Content filter
                if not passes_content_filter(title, body):
                    print(f"    ⏭️ FILTER: u/{author} | '{title[:55]}'")
                    continue

                r.sadd("seen_posts_reddit", platform_post_id)

                full_content = f"{title}\n\n{body}".strip()
                post_url = f"https://www.reddit.com{permalink}"

                lead_data = {
                    "platform": "Reddit",
                    "platformPostId": platform_post_id,
                    "authorHandle": f"u/{author}",
                    "content": full_content,
                    "url": post_url,
                    "searchContext": f"r/{subreddit_name} — {query}",
                    "bio": f"Posted in r/{subreddit_name}",
                    "followerCount": "Hidden",
                    "recentTweets": [],
                }

                r.lpush("raw_leads", json.dumps(lead_data))
                print(f"🎯 MATCH! u/{author} | '{title[:60]}'")
                leads.append(lead_data)

            except Exception as e:
                pass

        # Polite delay between requests
        time.sleep(random.uniform(1.0, 2.0))

    except Exception as e:
        print(f"    ⚠️ Error scraping r/{subreddit}: {e}")

    return leads


def run_worker():
    parser = argparse.ArgumentParser(description="Reddit Lead Scraper — JSON API")
    parser.add_argument("queries", nargs="*", help="Search queries")
    parser.add_argument("--subreddits", nargs="*", default=DEFAULT_SUBREDDITS)
    args = parser.parse_args()

    queries = args.queries if args.queries else [
        "need a website", "looking for web designer", "website redesign"
    ]
    subreddits = args.subreddits if args.subreddits != DEFAULT_SUBREDDITS else fetch_live_subreddits()

    print(f"🕵️  Reddit Worker starting (JSON API mode — no browser needed)...")
    print(f"   Queries: {queries}")
    print(f"   Subreddits: {subreddits}")

    total_pushed = 0
    for query in queries:
        for subreddit in subreddits:
            leads = scrape_subreddit(subreddit, query)
            total_pushed += len(leads)

    print(f"\n✅ Reddit Worker done. Pushed {total_pushed} leads to AI grader queue.")


if __name__ == "__main__":
    run_worker()
