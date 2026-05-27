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
filename = "upgraded_tracks.json"
try:
    with open(filename, "r", encoding="utf-8") as f:
        tracks = json.load(f)
except FileNotFoundError:
    print(f"Could not find {filename}")
    exit()

print(f"Starting Fast-Title update for {len(tracks)} tracks...")

# 2. Iterate and update
for track in tqdm(tracks, desc="Fetching YouTube Titles"):
    yt_link = track.get("YouTubeLink", "")
    
    # Skip if we already have the title or if the link is missing
    if track.get("YouTube_Title") or "youtube.com/watch" not in yt_link:
        continue

    actual_title = fetch_video_title(yt_link)
    
    if actual_title:
        track["YouTube_Title"] = actual_title
    else:
        track["YouTube_Title"] = "ERROR: Fetch Failed"

# 3. Save the results back to the same file
with open(filename, "w", encoding="utf-8") as f:
    json.dump(tracks, f, indent=2, ensure_ascii=False)

print(f"\nUpdate complete! {filename} is ready.")