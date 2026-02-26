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
csv_file = "Library - Music - All.csv"      # Your CSV file
json_file = "tracks.json"                   # Final output
checkpoint_file = "tracks_checkpoint.json"  # Save progress here
failed_file = "failed_tracks.json"          # Save failed tracks here
SAVE_EVERY_N_TRACKS = 100                   # Save checkpoint every N songs
# =============================


def clean_title(title: str) -> str:
    """Normalize punctuation and remove odd characters for cleaner searching."""
    cleaned = re.sub(r"[‐-‒–—―]", "-", str(title))
    cleaned = re.sub(r"[^\w\s\-]", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def create_browser():
    options = uc.ChromeOptions()
    options.headless = True

    # Point to Chrome Beta explicitly (adjust if yours is different)
    options.binary_location = r"C:\Program Files\Google\Chrome Beta\Application\chrome.exe"
    # If you're on 32-bit install, it might be:
    # options.binary_location = r"C:\Program Files (x86)\Google\Chrome Beta\Application\chrome.exe"

    driver = uc.Chrome(
        options=options,
        version_main=146,   # match your Beta major version
    )
    return driver

def search_youtube(driver, query: str):
    try:
        url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"
        driver.get(url)
        time.sleep(4)

        links = driver.find_elements(By.CSS_SELECTOR, "a#video-title")
        video_links = []

        for link in links:
            href = link.get_attribute("href")
            title = link.get_attribute("title")
            if href and "watch" in href:
                video_links.append((href, title.lower() if title else ""))

        if video_links:
            for href, title in video_links:
                if "official" in title:
                    print(f"Found Official Music Video for {query}: {href}")
                    return href

            print(f"Found YouTube link for {query}: {video_links[0][0]}")
            return video_links[0][0]

        print(f"No YouTube link found for {query}")
        return None

    except Exception as e:
        print(f"Error searching for {query}: {e}")
        return None


def save_to_json(data, json_path: str):
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(data)} tracks to {json_path}")


def is_link_alive(url: str) -> bool:
    try:
        response = requests.head(url, timeout=5, allow_redirects=True)
        return response.status_code == 200
    except requests.RequestException:
        return False


def fetch_tracks_with_youtube(csv_path: str):
    df = pd.read_csv(csv_path)

    required = {
        "albums.tracks.grandparentTitle",
        "albums.tracks.title",
        "albums.tracks.parentTitle",
        "albums.tracks.year",
    }
    if not required.issubset(set(df.columns)):
        print("CSV missing expected columns.")
        print("Expected columns:", sorted(required))
        print("Found columns:", sorted(df.columns))
        return []

    clean_df = df[
        [
            "albums.tracks.grandparentTitle",
            "albums.tracks.title",
            "albums.tracks.parentTitle",
            "albums.tracks.year",
        ]
    ].copy()
    clean_df.columns = ["Artist", "Title", "Album", "Year"]

    clean_df = clean_df.dropna(subset=["Artist", "Title"])
    print(f"Loaded {len(clean_df)} tracks from CSV.")

    if os.path.exists(json_file):
        with open(json_file, "r", encoding="utf-8") as f:
            existing_tracks = json.load(f)
    else:
        existing_tracks = []

    existing_set = set((t.get("Artist"), t.get("Title")) for t in existing_tracks)

    track_list = existing_tracks.copy()
    failed_tracks = []

    driver = create_browser()

    try:
        for _, row in tqdm(
            list(clean_df.iterrows()),
            total=len(clean_df),
            desc="Searching YouTube",
        ):
            orig_artist = row["Artist"]
            orig_title = row["Title"]

            if (orig_artist, orig_title) in existing_set:
                continue

            artist = clean_title(orig_artist)
            title = clean_title(orig_title)

            search_query = f"{artist} {title}"
            youtube_link = search_youtube(driver, search_query)

            track_data = {
                "Artist": orig_artist,
                "Title": orig_title,
                "Album": row["Album"] if pd.notna(row["Album"]) else "Unknown",
                "Year": int(row["Year"]) if not pd.isna(row["Year"]) else "Unknown",
                "YouTubeLink": youtube_link or "Not Found",
            }
            track_list.append(track_data)

            if not youtube_link:
                failed_tracks.append(track_data)

            if len(track_list) % SAVE_EVERY_N_TRACKS == 0:
                save_to_json(track_list, checkpoint_file)
                save_to_json(failed_tracks, failed_file)

            time.sleep(random.uniform(1, 3))

    finally:
        driver.quit()

    save_to_json(failed_tracks, failed_file)

    csv_pairs = set((row["Artist"], row["Title"]) for _, row in clean_df.iterrows())
    cleaned_track_list = [
        track for track in track_list
        if (track.get("Artist"), track.get("Title")) in csv_pairs
    ]

    print(f"Cleaned: {len(track_list) - len(cleaned_track_list)} obsolete tracks removed.")
    return cleaned_track_list


def refresh_dead_links():
    if not os.path.exists(json_file):
        print("No tracks.json found to refresh.")
        return

    with open(json_file, "r", encoding="utf-8") as f:
        tracks = json.load(f)

    print(f"Checking {len(tracks)} tracks for dead links...")

    driver = create_browser()
    updated_tracks = []

    try:
        for track in tqdm(tracks, desc="Checking links"):
            url = track.get("YouTubeLink")

            if url and url != "Not Found" and is_link_alive(url):
                updated_tracks.append(track)
            else:
                artist = clean_title(track.get("Artist", ""))
                title = clean_title(track.get("Title", ""))
                search_query = f"{artist} {title}"
                print(f"Refreshing link for {track.get('Artist')} - {track.get('Title')}")
                new_link = search_youtube(driver, search_query)
                track["YouTubeLink"] = new_link or "Not Found"
                updated_tracks.append(track)

            time.sleep(random.uniform(1, 2))

    finally:
        driver.quit()

    save_to_json(updated_tracks, json_file)


if __name__ == "__main__":
    mode = input(
        "Type 'fetch' to fetch new tracks, or 'refresh' to check and refresh dead links: "
    ).strip().lower()

    if mode == "fetch":
        tracks = fetch_tracks_with_youtube(csv_file)
        if tracks:
            save_to_json(tracks, json_file)
            if os.path.exists(checkpoint_file):
                os.remove(checkpoint_file)
        else:
            print("No tracks to save. Check your CSV or search function.")
    elif mode == "refresh":
        refresh_dead_links()
    else:
        print("Unknown mode.")