import json
import time
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager # Simplifies setup

# --- CONFIGURATION ---
SOURCE_FILE = 'tracks.json'
OUTPUT_FILE = 'upgraded_tracks.json'
PREFERENCE = "official music video" # You can change to "live" if preferred

# Setup Selenium
chrome_options = Options()
chrome_options.add_argument("--headless") # Run in background
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")
chrome_options.add_argument("--mute-audio")

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)

def is_topic_video(title, artist, current_url):
    """
    Checks if the track is likely a 'Topic' (audio-only) track.
    Note: Selenium can't read internal metadata as easily as yt-dlp, 
    so we check the provided URL/Title for common flags.
    """
    if not current_url: return True
    markers = ["- Topic", "various artists", "&pp=yg"]
    return any(m.lower() in current_url.lower() or m.lower() in title.lower() for m in markers)

def search_for_video(artist, title):
    """Uses Selenium with aggressive negative filtering."""
    # We add -topic and -"provided to youtube" to the search bar itself
    search_query = f'{artist} "{title}" {PREFERENCE} -topic -"provided to youtube"'.replace(" ", "+")
    print(f"   Searching: {artist} - {title}")
    
    try:
        driver.get(f"https://www.youtube.com/results?search_query={search_query}")
        time.sleep(3) # Slightly longer wait for the 'Topic' filters to clear

        results = driver.find_elements(By.ID, "video-title")

        for result in results:
            href = result.get_attribute("href")
            title_text = (result.get_attribute("title") or "").lower()
            aria_label = (result.get_attribute("aria-label") or "").lower()
            
            # STRIKE 1: Is it from a Topic channel?
            if "topic" in aria_label or "topic" in title_text:
                continue
                
            # STRIKE 2: Does it have the 'Auto-generated' hallmark?
            if href and "/watch?v=" in href:
                # We prioritize results that DON'T look like a square album cover track
                print(f"      [SUCCESS] Found: {href}")
                return href
                
    except Exception as e:
        print(f"      Error searching: {e}")
    
    return None

def process_library():
    if not os.path.exists(SOURCE_FILE):
        print(f"Error: {SOURCE_FILE} not found.")
        return

    with open(SOURCE_FILE, "r", encoding="utf-8") as f:
        tracks = json.load(f)

    updated_count = 0
    total_tracks = len(tracks)

    for i, track in enumerate(tracks):
        artist = track.get('Artist', '')
        title = track.get('Title', '')
        current_url = track.get('YouTubeLink', '')

        print(f"[{i+1}/{total_tracks}] Checking: {artist} - {title}")

        # LOGIC: Check if it's a topic video
        if is_topic_video(title, artist, current_url):
            new_href = search_for_video(artist, title)
            
            if new_href:
                track["YouTubeLink"] = new_href
                track["UpgradeStatus"] = "Upgraded via Selenium"
                updated_count += 1
            else:
                track["UpgradeStatus"] = "No better version found"
        else:
            print(f"   [OK] Already a video. Skipping.")
            track["UpgradeStatus"] = "Kept Original"

    # Save to the new file, preserving all original fields
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(tracks, f, indent=4, ensure_ascii=False)

    print(f"\nFinished! Updated {updated_count} tracks. Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    try:
        process_library()
    finally:
        driver.quit()