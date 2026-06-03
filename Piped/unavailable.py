import json
import requests
import time

# Settings
INPUT_FILE = 'upgraded_tracks.json'
OUTPUT_FILE = 'restricted_tracks.json'
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

def is_embeddable(url):
    try:
        # The oEmbed check is the "Gold Standard" for checking embed permissions
        oembed_url = f"https://www.youtube.com/oembed?url={url}&format=json"
        response = requests.get(oembed_url, headers=HEADERS, timeout=10)
        return response.status_code == 200
    except:
        return False

def run_cleanup():
    print("Loading your tracks...")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        tracks = json.load(f)

    broken_tracks = []
    print(f"Starting scan of {len(tracks)} tracks. This will take a while to stay 'under the radar' of YouTube.")

    for i, track in enumerate(tracks):
        url = track.get('YouTubeLink', '')
        
        if url and not is_embeddable(url):
            print(f"[{i+1}/{len(tracks)}] BROKEN: {track.get('Title')}")
            broken_tracks.append(track)
        
        # 3 second delay is crucial to prevent being blocked
        time.sleep(3) 

    # Save the bad ones
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(broken_tracks, f, indent=4)

    print(f"\nDone! Found {len(broken_tracks)} broken tracks.")
    print(f"Check '{OUTPUT_FILE}' for your list of links to fix.")

if __name__ == "__main__":
    run_cleanup()