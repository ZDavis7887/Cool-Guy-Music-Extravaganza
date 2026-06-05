import json
import requests
import time
import os

# --- CONFIG ---
API_KEY = "AIzaSyAy7hztoIzmTm-JLaUa1woMPbxvzJ5gsZE" # Ensure your key is pasted here
INPUT_FILE = "upgraded_tracks.json"
OUTPUT_FILE = "curated_deepdives.json"
BASE_URL = "https://www.googleapis.com/youtube/v3"

def save_progress(results):
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=4)
        f.flush()
        os.fsync(f.fileno())

def get_artist_content(artist):
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
        except:
            time.sleep((attempt + 1) * 5)
    return []

def main():
    # 1. Load existing results
    results = {}
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            try:
                results = json.load(f)
            except:
                results = {}

    # 2. Load artists
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
        all_artists = list(set([t.get('Artist') or t.get('artist') for t in data if t.get('Artist') or t.get('artist')]))

    # 3. Process in batches of 20
    processed_this_session = 0
    BATCH_LIMIT = 20

    print(f"Starting scan. Progress: {len(results)}/{len(all_artists)} artists already done.")

    for artist in all_artists:
        if artist in results:
            continue
            
        if processed_this_session >= BATCH_LIMIT:
            print(f"\nReached batch limit of {BATCH_LIMIT}. Saving and exiting.")
            break
            
        print(f"[{processed_this_session + 1}/{BATCH_LIMIT}] Searching for: {artist}")
        videos = get_artist_content(artist)
        found_for_artist = []

        for v in videos:
            if len(found_for_artist) >= 3: break
            
            vid_id = v['id']['videoId']
            stats_url = f"{BASE_URL}/videos?key={API_KEY}&part=statistics&id={vid_id}"
            
            try:
                stats = requests.get(stats_url, timeout=10).json()
                view_count = int(stats['items'][0]['statistics']['viewCount'])
                
                if view_count >= 50000:
                    title = v['snippet']['title'].lower()
                    if any(w in title for w in ["documentary", "history", "story", "interview"]):
                        found_for_artist.append(f"https://www.youtube.com/watch?v={vid_id}")
            except: continue
        
        results[artist] = found_for_artist
        processed_this_session += 1
        save_progress(results)
        time.sleep(2)

if __name__ == "__main__":
    main()