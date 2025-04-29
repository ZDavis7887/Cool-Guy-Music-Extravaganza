import json

# === Settings ===
INPUT_JSON = 'tracks.json'
OUTPUT_JSON = 'tracks.json'  # Overwrite the original file
NEW_DOMAIN = 'https://piped.kavin.rocks/watch?v='

# === Process ===
def transform_links():
    # Load existing track list
    with open(INPUT_JSON, 'r', encoding='utf-8') as f:
        tracks = json.load(f)

    updated = 0

    # Go through each track
    for track in tracks:
        link = track.get('YouTubeLink', '')
        if 'youtube.com/watch?v=' in link:
            # Extract YouTube video ID
            video_id = link.split('v=')[1].split('&')[0]
            # Replace with Piped link
            track['link'] = f'{NEW_DOMAIN}{video_id}'
            updated += 1

    # Save the updated list
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(tracks, f, indent=2, ensure_ascii=False)

    print(f"✅ Updated {updated} links to use Piped frontend!")

if __name__ == "__main__":
    transform_links()
