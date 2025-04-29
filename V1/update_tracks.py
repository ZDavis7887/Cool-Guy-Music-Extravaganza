import pandas as pd
import json
import re
import time
import os
import random
import requests
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from tqdm import tqdm

# ========== CONFIG ==========
csv_file = 'Library - Music - All.csv'  # Your CSV file
json_file = 'tracks.json'               # Final output
checkpoint_file = 'tracks_checkpoint.json'  # Save progress here
failed_file = 'failed_tracks.json'       # Save failed tracks here
SAVE_EVERY_N_TRACKS = 100                # Save checkpoint every 100 songs
# =============================

def clean_title(title):
    cleaned = re.sub(r'[‐‑‒–—―]', '-', title)
    cleaned = re.sub(r'[^\w\s\-]', '', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

def create_browser():
    options = uc.ChromeOptions()
    options.headless = True
    driver = uc.Chrome(options=options)
    return driver

def search_youtube(driver, query):
    try:
        driver.get(f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}")
        time.sleep(4)

        links = driver.find_elements(By.CSS_SELECTOR, 'a#video-title')
        video_links = []

        for link in links:
            href = link.get_attribute('href')
            title = link.get_attribute('title')
            if href and "watch" in href:
                video_links.append((href, title.lower() if title else ""))

        if video_links:
            for href, title in video_links:
                if "official" in title:
                    print(f"✅ Found Official Music Video for {query}: {href}")
                    return href

            print(f"✅ Found YouTube link for {query}: {video_links[0][0]}")
            return video_links[0][0]

        print(f"❌ No YouTube link found for {query}")
        return None

    except Exception as e:
        print(f"Error searching for {query}: {e}")
        return None

def save_to_json(data, json_path):
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"💾 Saved {len(data)} tracks to {json_path}")

def is_link_alive(url):
    try:
        response = requests.head(url, timeout=5)
        return response.status_code == 200
    except requests.RequestException:
        return False

def fetch_tracks_with_youtube(csv_path):
    df = pd.read_csv(csv_path)

    if 'albums.tracks.grandparentTitle' not in df.columns or 'albums.tracks.title' not in df.columns:
        print("❌ CSV missing expected columns.")
        return []

    clean_df = df[['albums.tracks.grandparentTitle', 'albums.tracks.title', 'albums.tracks.parentTitle', 'albums.tracks.year']]
    clean_df.columns = ['Artist', 'Title', 'Album', 'Year']

    clean_df = clean_df.dropna(subset=['Artist', 'Title'])

    print(f"✅ Loaded {len(clean_df)} tracks from CSV.")

    if os.path.exists(json_file):
        with open(json_file, 'r', encoding='utf-8') as f:
            existing_tracks = json.load(f)
    else:
        existing_tracks = []

    existing_set = set((track['Artist'], track['Title']) for track in existing_tracks)

    track_list = existing_tracks.copy()
    failed_tracks = []
    start_index = 0

    driver = create_browser()

    for index, row in tqdm(list(clean_df.iterrows()), total=len(clean_df), desc="Searching YouTube"):
        artist = clean_title(row['Artist'])
        title = clean_title(row['Title'])

        if (row['Artist'], row['Title']) in existing_set:
            continue  # Skip already processed tracks

        search_query = f"{artist} {title}"
        youtube_link = search_youtube(driver, search_query)

        track_data = {
            'Artist': row['Artist'],
            'Title': row['Title'],
            'Album': row['Album'] if pd.notna(row['Album']) else 'Unknown',
            'Year': int(row['Year']) if not pd.isna(row['Year']) else 'Unknown',
            'YouTubeLink': youtube_link or "Not Found"
        }
        track_list.append(track_data)

        if not youtube_link:
            failed_tracks.append(track_data)

        if len(track_list) % SAVE_EVERY_N_TRACKS == 0:
            save_to_json(track_list, checkpoint_file)
            save_to_json(failed_tracks, failed_file)

        time.sleep(random.uniform(1, 3))

    driver.quit()

    save_to_json(failed_tracks, failed_file)

    return track_list

def refresh_dead_links():
    if not os.path.exists(json_file):
        print("❌ No tracks.json found to refresh.")
        return

    with open(json_file, 'r', encoding='utf-8') as f:
        tracks = json.load(f)

    print(f"🔎 Checking {len(tracks)} tracks for dead links...")

    driver = create_browser()
    updated_tracks = []

    for track in tqdm(tracks, desc="Checking links"):
        url = track.get('YouTubeLink')

        if url and url != "Not Found" and is_link_alive(url):
            updated_tracks.append(track)
        else:
            artist = clean_title(track['Artist'])
            title = clean_title(track['Title'])
            search_query = f"{artist} {title}"
            print(f"🔄 Refreshing link for {track['Artist']} - {track['Title']}")
            new_link = search_youtube(driver, search_query)
            track['YouTubeLink'] = new_link or "Not Found"
            updated_tracks.append(track)

        time.sleep(random.uniform(1, 2))

    driver.quit()
    save_to_json(updated_tracks, json_file)

# ========== MAIN ==========
if __name__ == '__main__':
    mode = input("Type 'fetch' to fetch new tracks, or 'refresh' to check and refresh dead links: ").strip().lower()
    if mode == 'fetch':
        tracks = fetch_tracks_with_youtube(csv_file)
        if tracks:
            save_to_json(tracks, json_file)
            if os.path.exists(checkpoint_file):
                os.remove(checkpoint_file)
        else:
            print("❌ No tracks to save. Check your CSV or search function.")
    elif mode == 'refresh':
        refresh_dead_links()
    else:
        print("❌ Unknown mode.")
