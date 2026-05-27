import json
import requests
from tqdm import tqdm
from collections import OrderedDict

def fetch_video_title(video_url):
    try:
        if "v=" not in video_url:
            return None
        video_id = video_url.split("v=")[1].split("&")[0]
        yt_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        response = requests.get(yt_url, timeout=5)
        if response.status_code == 200:
            return response.json().get("title", "")
        elif response.status_code in [401, 403]:
            return "ERROR: Private/Protected"
        elif response.status_code == 404:
            return "ERROR: Video Deleted"
    except Exception:
        return None
    return None

def reorder_track(track, yt_title):
    """Rebuilds the dictionary to place YouTube_Title right after Title."""
    new_track = {}
    for key, value in track.items():
        new_track[key] = value
        if key == "Title":
            new_track["YouTube_Title"] = yt_title
    # If YouTube_Title was already elsewhere in the dict, this prevents duplicates
    if "YouTube_Title" not in new_track:
        new_track["YouTube_Title"] = yt_title
    return new_track

filename = "upgraded_tracks.json"
try:
    with open(filename, "r", encoding="utf-8") as f:
        tracks = json.load(f)
except FileNotFoundError:
    print(f"Could not find {filename}")
    exit()

print(f"Updating and Reordering {len(tracks)} tracks...")

updated_tracks = []

for track in tqdm(tracks, desc="Processing"):
    yt_link = track.get("YouTubeLink", "")
    
    # Get the title (use existing if available, otherwise fetch)
    current_yt_title = track.get("YouTube_Title")
    if not current_yt_title or "ERROR" in current_yt_title:
        if "youtube.com/watch" in yt_link:
            actual_title = fetch_video_title(yt_link)
            current_yt_title = actual_title if actual_title else "ERROR: Fetch Failed"
        else:
            current_yt_title = "N/A"

    # Remove the old key if it exists to avoid double-entry during reorder
    track.pop("YouTube_Title", None)
    
    # Reorder and add to our new list
    updated_tracks.append(reorder_track(track, current_yt_title))

# Save the results
with open(filename, "w", encoding="utf-8") as f:
    json.dump(updated_tracks, f, indent=2, ensure_ascii=False)

print(f"\nSuccess! 'YouTube_Title' is now positioned directly under 'Title'.")