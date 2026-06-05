import json
import requests
import time
import os

INPUT_FILE = 'upgraded_tracks.json'
OUTPUT_FILE = 'restricted_tracks.json'
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

def is_embeddable(url):
    try:
        oembed_url = f"https://www.youtube.com/oembed?url={url}&format=json"
        response = requests.get(oembed_url, headers=HEADERS, timeout=10)
        return response.status_code == 200
    except:
        return False

def run_cleanup():
    # 1. Load existing broken tracks (if they exist)
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            try:
                broken_tracks = json.load(f)
            except json.JSONDecodeError:
                broken_tracks = []
    else:
        broken_tracks = []

    # Get a list of URLs already in the broken list to prevent duplicates
    known_broken_urls = {track.get('YouTubeLink') for track in broken_tracks}

    print("Loading your tracks...")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        tracks = json.load(f)

    print(f"Scanning {len(tracks)} tracks. Skipping {len(broken_tracks)} already identified.")

    for i, track in enumerate(tracks):
        url = track.get('YouTubeLink', '')
        
        # 2. Skip if we already found this one before
        if not url or url in known_broken_urls:
            continue
        
        # 3. Check for embedding
        if not is_embeddable(url):
            print(f"[{i+1}/{len(tracks)}] BROKEN: {track.get('Title')}")
            broken_tracks.append(track)
            known_broken_urls.add(url)
            
            # Save incrementally so you don't lose progress if it crashes
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump(broken_tracks, f, indent=4)
        
        time.sleep(3) 

    print(f"\nDone! Found {len(broken_tracks)} total broken tracks.")

if __name__ == "__main__":
    run_cleanup()