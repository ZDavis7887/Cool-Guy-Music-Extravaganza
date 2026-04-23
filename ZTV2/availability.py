import json
import requests

def check_youtube_links(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            tracks = json.load(f)
    except FileNotFoundError:
        print("Error: tracks.json not found.")
        return

    unavailable_videos = []

    print("Checking links... this may take a moment.")
    
    for track in tracks:
        artist = track.get("Artist", "Unknown Artist")
        title = track.get("Title", "Unknown Title")
        url = track.get("YouTubeLink")

        if not url:
            continue

        try:
            # We use a Head request to be faster, but some YouTube 
            # 'unavailable' pages return a 200, so we check the content if needed.
            response = requests.get(url, timeout=10)
            
            # Common indicators of a dead YouTube link
            if response.status_code == 404 or "Video unavailable" in response.text:
                unavailable_videos.append(f"{artist} - {title} ({url})")
        
        except requests.RequestException:
            unavailable_videos.append(f"{artist} - {title} (Connection Error)")

    if unavailable_videos:
        print("\n--- Unavailable Videos ---")
        for video in unavailable_videos:
            print(video)
    else:
        print("\nAll videos appear to be available!")

# Run the check
check_youtube_links('tracks.json')