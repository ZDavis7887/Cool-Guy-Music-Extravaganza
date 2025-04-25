# unified_music_tool.py
import json
import pandas as pd
import requests
import argparse
import time
from urllib.parse import quote

TRACKS_JSON = "tracks.json"
CSV_FILE = "Library - Music - All.csv"
MISMATCHED_FILE = "mismatched_tracks.json"
CORRECTED_JSON = "tracks_corrected.json"
LASTFM_API_KEY = "67151f1c5943c2b35b9750ab48ac296f"  # Replace with your actual key

# ========== YOUTUBE SEARCH ==========
def search_youtube_duckduckgo(query):
    url = f"https://html.duckduckgo.com/html/?q=site:youtube.com+{quote(query)}"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        response = requests.post(url, headers=headers, timeout=10)
        if response.ok:
            for line in response.text.splitlines():
                if "/watch?v=" in line and "youtube.com" in line:
                    start = line.find("https://www.youtube.com/watch?v=")
                    if start != -1:
                        end = line.find('"', start)
                        return line[start:end]
    except Exception as e:
        print(f"❌ Search failed for {query}: {e}")
    return None

# ========== LAST.FM ALBUM ART ==========
def fetch_album_art(artist, album):
    try:
        url = "http://ws.audioscrobbler.com/2.0/"
        params = {
            "method": "album.getinfo",
            "api_key": LASTFM_API_KEY,
            "artist": artist,
            "album": album,
            "format": "json"
        }
        response = requests.get(url, params=params, timeout=6)
        data = response.json()
        images = data.get("album", {}).get("image", [])
        for img in reversed(images):
            if img.get("#text"):
                return img.get("#text")
    except Exception as e:
        print(f"⚠️ Failed to fetch album art for {artist} - {album}: {e}")
    return ""

# ========== FETCH MODE (CREATE TRACKS.JSON) ==========
def fetch_tracks_with_metadata():
    df = pd.read_csv(CSV_FILE)
    df = df[['albums.tracks.grandparentTitle', 'albums.tracks.title', 'albums.title',
             'albums.originallyAvailableAt', 'summary']].dropna()
    df.columns = ['Artist', 'Title', 'Album', 'ReleaseDate', 'Summary']

    seen = set()
    track_list = []

    for _, row in df.iterrows():
        key = f"{row['Artist']} - {row['Title']}"
        if key in seen:
            continue
        seen.add(key)

        print(f"🔍 Searching for: {key}")
        link = search_youtube_duckduckgo(key)
        art_link = fetch_album_art(row['Artist'], row['Album'])
        track = {
            "Artist": row['Artist'],
            "Title": row['Title'],
            "Album": row['Album'],
            "ReleaseDate": row['ReleaseDate'] if pd.notna(row['ReleaseDate']) else "Unknown",
            "Summary": row['Summary'],
            "AlbumArtLink": art_link,
            "YouTubeLink": link or "Not Found"
        }
        track_list.append(track)
        time.sleep(1)

    with open(TRACKS_JSON, "w", encoding="utf-8") as f:
        json.dump(track_list, f, indent=2, ensure_ascii=False)

    print(f"✅ Saved {len(track_list)} tracks to {TRACKS_JSON}")

# ========== REFRESH MODE ==========
def refresh_dead_links():
    with open(TRACKS_JSON, "r", encoding="utf-8") as f:
        tracks = json.load(f)

    updated = 0
    for track in tracks:
        if track['YouTubeLink'] == "Not Found" or not track['YouTubeLink'].startswith("https://www.youtube.com/watch"):
            query = f"{track['Artist']} {track['Title']}"
            print(f"🔄 Refreshing: {query}")
            new_link = search_youtube_duckduckgo(query)
            if new_link:
                track['YouTubeLink'] = new_link
                updated += 1
                time.sleep(1)

    with open(CORRECTED_JSON, "w", encoding="utf-8") as f:
        json.dump(tracks, f, indent=2, ensure_ascii=False)

    print(f"✅ Refreshed {updated} links. Saved to {CORRECTED_JSON}")

# ========== AUDIT MODE ==========
def audit_mismatches():
    with open(TRACKS_JSON, "r", encoding="utf-8") as f:
        tracks = json.load(f)

    mismatches = []

    for track in tracks:
        expected = f"{track['Artist']} - {track['Title']}"
        link = track.get("YouTubeLink", "")
        if "youtube.com/watch" not in link:
            continue

        video_id = link.split("v=")[1].split("&")[0]
        yt_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        try:
            response = requests.get(yt_url, timeout=5)
            if response.status_code == 200:
                title = response.json().get("title", "").lower()
                if track['Artist'].lower() not in title or track['Title'].lower() not in title:
                    mismatches.append({
                        "Expected": expected,
                        "ActualYouTubeTitle": title,
                        "YouTubeLink": link
                    })
        except:
            continue

    with open(MISMATCHED_FILE, "w", encoding="utf-8") as f:
        json.dump(mismatches, f, indent=2, ensure_ascii=False)

    print(f"⚠️ Found {len(mismatches)} mismatches. Saved to {MISMATCHED_FILE}")

# ========== ENTRY POINT ==========
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Unified Music Tool")
    parser.add_argument("mode", choices=["fetch", "refresh", "audit"], help="Which mode to run")
    args = parser.parse_args()

    if args.mode == "fetch":
        fetch_tracks_with_metadata()
    elif args.mode == "refresh":
        refresh_dead_links()
    elif args.mode == "audit":
        audit_mismatches()
