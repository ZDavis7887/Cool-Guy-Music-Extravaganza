import json
import requests
import time
import os

# --- CONFIG ---
API_KEY = "AIzaSyAy7hztoIzmTm-JLaUa1woMPbxvzJ5gsZE"
INPUT_FILE = "upgraded_tracks.json"
OUTPUT_FILE = "curated_deepdives.json"
BASE_URL = "https://www.googleapis.com/youtube/v3"

def save_progress(results):
    """Utility to force-save the results to disk safely."""
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=4)
        f.flush()
        os.fsync(f.fileno())

def get_artist_content(artist):
    """Searches YouTube API for long-form content with retry logic."""
    query = f"{artist} documentary OR story OR interview"
    params = {
        "key": API_KEY,
        "part": "snippet,statistics,contentDetails",
        "q": query,
        "type": "video",
        "videoDuration": "long",
        "maxResults": 5
    }
    
    for attempt in range(3):
        try:
            response = requests.get(f"{BASE_URL}/search", params=params, timeout=15)
            if response.status_code == 200:
                return response.json().get("items", [])
            elif response.status_code == 403:
                print(f"[!] Quota limit reached for {artist}")
                return []
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            time.sleep((attempt + 1) * 5)
    return []

def main():
    # 1. Load existing results
    results = {}
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            try:
                results = json.load(f)
            except json.JSONDecodeError:
                results = {}

    # 2. Load artists from track list
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
        artists = list(set([t.get('Artist') or t.get('artist') for t in data if t.get('Artist') or t.get('artist')]))

    # 3. Process each artist
    try:
        for artist in artists:
            if artist in results:
                continue
                
            print(f"Searching for: {artist}")
            videos = get_artist_content(artist)
            found_for_artist = []

            for v in videos:
                if len(found_for_artist) >= 3:
                    break
                
                vid_id = v['id']['videoId']
                stats_url = f"{BASE_URL}/videos?key={API_KEY}&part=statistics&id={vid_id}"
                
                try:
                    stats = requests.get(stats_url, timeout=10).json()
                    view_count = int(stats['items'][0]['statistics']['viewCount'])
                    
                    if view_count >= 50000:
                        title = v['snippet']['title'].lower()
                        if any(w in title for w in ["documentary", "history", "story", "interview"]):
                            found_for_artist.append(f"https://www.youtube.com/watch?v={vid_id}")
                except:
                    continue
            
            if found_for_artist:
                results[artist] = found_for_artist
                save_progress(results) # Immediate checkpoint save
                
            time.sleep(2) # Respectful delay to prevent bans

    except Exception as e:
        print(f"\n[!] Script crashed: {e}")
        save_progress(results) # Last-ditch save before exiting

if __name__ == "__main__":
    main()