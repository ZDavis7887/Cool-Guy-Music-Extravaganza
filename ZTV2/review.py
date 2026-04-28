import json
import csv
import os
import math
import sys
from yt_dlp import YoutubeDL

# This suppresses the warnings from cluttering your screen
class MyLogger:
    def debug(self, msg): pass
    def warning(self, msg): pass
    def error(self, msg): print(msg)

ydl_opts = {
    'quiet': True,
    'no_warnings': True,
    'logger': MyLogger(),
    'skip_download': True,
    'force_generic_extractor': False,
    'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

def get_yt_title(url):
    if not url or "youtube" not in url:
        return "N/A"
    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return info.get('title', 'Unknown Title')
    except Exception:
        return "ERROR: Private/Dead/Protected"

def split_tracks(filename='tracks.json', batch_size=250):
    if not os.path.exists('Review_Batches'):
        os.makedirs('Review_Batches')

    try:
        with open(filename, 'r', encoding='utf-8') as f:
            tracks = json.load(f)
    except FileNotFoundError:
        print(f"Error: {filename} not found.")
        return

    # Prepare Headers
    all_keys = set()
    for track in tracks:
        all_keys.update(track.keys())
    fieldnames = sorted(list(all_keys))
    if 'Actual_YT_Title' not in fieldnames:
        fieldnames.append('Actual_YT_Title')

    tracks.sort(key=lambda x: str(x.get('Artist', '')).lower())
    total_batches = math.ceil(len(tracks) / batch_size)
    
    print(f"--- ZTV Audit Splitter ---")
    print(f"Total Tracks: {len(tracks)} | Batches: {total_batches}")

    for i in range(total_batches):
        start = i * batch_size
        end = start + batch_size
        batch = tracks[start:end]
        
        # Clean filename logic
        raw_artist = str(batch[0].get('Artist', 'Batch'))
        safe_artist = "".join(x for x in raw_artist if x.isalnum())[:12]
        batch_filename = f'Review_Batches/Batch_{i+1:02d}_{safe_artist}.csv'
        
        print(f"-> Processing Batch {i+1}/{total_batches} ({batch_filename})")

        for track in batch:
            # Show a simple dot for progress so you know it's not frozen
            sys.stdout.write('.')
            sys.stdout.flush()
            track['Actual_YT_Title'] = get_yt_title(track.get('YouTubeLink'))

        with open(batch_filename, 'w', newline='', encoding='utf-8') as f:
            dict_writer = csv.DictWriter(f, fieldnames=fieldnames)
            dict_writer.writeheader()
            dict_writer.writerows(batch)
        
        print(f"\nDone with Batch {i+1}")
            
    print(f"\nAll batches created in 'Review_Batches'. Go get 'em, Zach.")

if __name__ == "__main__":
    split_tracks()