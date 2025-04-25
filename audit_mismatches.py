import json
import requests
from tqdm import tqdm

def fetch_video_title(video_url):
    try:
        video_id = video_url.split("v=")[1].split("&")[0]
        yt_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        response = requests.get(yt_url, timeout=6)
        if response.status_code == 200:
            return response.json().get("title", "")
    except Exception as e:
        return None
    return None

def is_mismatch(expected_artist, expected_title, actual_title):
    return (expected_artist.lower() not in actual_title.lower()) or \
           (expected_title.lower() not in actual_title.lower())

# === Load your full tracks.json ===
with open("tracks.json", "r", encoding="utf-8") as f:
    tracks = json.load(f)

mismatches = []

# === Go through each track and compare expected title with actual video title ===
for track in tqdm(tracks, desc="Auditing YouTube Links"):
    yt_link = track.get("YouTubeLink", "")
    if "youtube.com/watch" not in yt_link:
        continue

    actual_title = fetch_video_title(yt_link)
    if actual_title:
        artist = track.get("Artist", "")
        title = track.get("Title", "")
        if is_mismatch(artist, title, actual_title):
            mismatches.append({
                "Expected": f"{artist} - {title}",
                "ActualYouTubeTitle": actual_title,
                "YouTubeLink": yt_link
            })

# === Save mismatches to a new file ===
with open("mismatched_tracks.json", "w", encoding="utf-8") as f:
    json.dump(mismatches, f, indent=2, ensure_ascii=False)

print(f"✅ Audit complete. Found {len(mismatches)} mismatches.")
print("🔍 Saved to mismatched_tracks.json")
