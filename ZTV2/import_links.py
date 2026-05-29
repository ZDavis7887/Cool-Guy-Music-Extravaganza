import json
import requests
from tqdm import tqdm

def fetch_video_title(video_url):
    """Uses YouTube's oEmbed API for lightning-fast title retrieval."""
    try:
        if "v=" not in video_url:
            return None

        # Extract video ID
        video_id = video_url.split("v=")[1].split("&")[0]
        yt_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"

        response = requests.get(yt_url, timeout=5)

        if response.status_code == 200:
            return response.json().get("title", "")
        elif response.status_code == 401 or response.status_code == 403:
            return "ERROR: Private/Protected"
        elif response.status_code == 404:
            return "ERROR: Video Deleted"

    except Exception:
        return None
    return None

# 1. Load your upgraded_tracks.json
filename = "new_tracks.json"
try:
    with open(filename, "r", encoding="utf-8") as f:
        tracks = json.load(f)
except FileNotFoundError:
    print(f"Could not find {filename}")
    exit()

print(f"Starting Fast-Title update for {len(tracks)} tracks...")

# 2. Iterate and update
ordered_tracks = []

for track in tqdm(tracks, desc="Fetching YouTube Titles"):
    yt_link = track.get("YouTubeLink", "")
    
    # Check if we need to fetch a title
    if not track.get("YouTube_Title") and "youtube.com/watch" in yt_link:
        actual_title = fetch_video_title(yt_link)
        if actual_title:
            track["YouTube_Title"] = actual_title
        else:
            track["YouTube_Title"] = "ERROR: Fetch Failed"
    elif not track.get("YouTube_Title"):
        # Default placeholder if it's not a valid link and has no title yet
        track["YouTube_Title"] = "ERROR: Fetch Failed"

    # --- KEY REORDERING BLOCK ---
    # We build a fresh dictionary to guarantee order when dumped to JSON
    ordered_track = {}
    
    # 1. Grab all standard keys EXCEPT the YouTube ones first
    for key, value in track.items():
        if key not in ["YouTube_Title", "YouTubeLink"]:
            ordered_track[key] = value
            
    # 2. Force the YouTube title and link right next to each other at the end
    ordered_track["YouTube_Title"] = track.get("YouTube_Title")
    ordered_track["YouTubeLink"] = track.get("YouTubeLink")
    
    ordered_tracks.append(ordered_track)

# 3. Save the ordered results back to the same file
with open(filename, "w", encoding="utf-8") as f:
    json.dump(ordered_tracks, f, indent=2, ensure_ascii=False)

print(f"\nUpdate complete! {filename} is ready.")