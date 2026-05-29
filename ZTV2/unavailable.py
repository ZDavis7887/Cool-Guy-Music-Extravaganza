import json
import os
import yt_dlp

# Paths to your files
INPUT_JSON = "upgraded_tracks.json"
BAD_TRACKS_JSON = "unavailable_tracks.json"  # Only contains the dead tracks

def check_video_status(url):
    """
    Returns True if available.
    Returns (False, reason) if deleted, private, or blocked.
    """
    if not url or "youtube.com" not in url and "youtu.be" not in url:
        return False, "Invalid or missing URL"

    ydl_opts = {
        'extract_flat': True,
        'simulate': True,
        'skip_download': True,
        'ignoreerrors': True,
        'quiet': True,
        'no_warnings': True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            if info is None:
                return False, "Video unavailable (Private, deleted, or geoblocked)"
            
            title = info.get('title', '')
            if title in ['[Deleted video]', '[Private video]']:
                return False, f"Video is {title.strip('[]')}"
                
            return True, "Available"
        except Exception as e:
            return False, str(e)

def extract_dead_tracks():
    if not os.path.exists(INPUT_JSON):
        print(f"Error: Could not find {INPUT_JSON}")
        return

    with open(INPUT_JSON, 'r', encoding='utf-8') as f:
        tracks = json.load(f)

    print(f"Loaded {len(tracks)} tracks from {INPUT_JSON}.")
    print("Scanning for unavailable links (Original file will not be modified)...\n")
    
    unavailable_tracks = []

    try:
        for index, track in enumerate(tracks, start=1):
            artist = track.get('Artist', 'Unknown Artist')
            title = track.get('Title', 'Unknown Title')
            url = track.get('YouTubeLink', '')

            print(f"[{index}/{len(tracks)}] Checking: {artist} - {title}...", end="", flush=True)

            is_available, reason = check_video_status(url)

            if is_available:
                print(" OK")
            else:
                print(f" ❌ UNAVAILABLE ({reason})")
                
                # Create a copy of the track object so we don't mutate anything by accident
                bad_track_entry = track.copy()
                bad_track_entry['Audit_Failure_Reason'] = reason
                unavailable_tracks.append(bad_track_entry)
                
                # Append to the output file in real-time so you don't lose data if interrupted
                with open(BAD_TRACKS_JSON, 'w', encoding='utf-8') as f:
                    json.dump(unavailable_tracks, f, indent=4, ensure_ascii=False)

    except KeyboardInterrupt:
        print("\n\nAudit paused by user. Saving progress...")
        
    print("\n" + "="*40)
    print("Audit Complete!")
    print(f"Total Tracks Checked: {index}")
    print(f"Total Unavailable Tracks Found: {len(unavailable_tracks)}")
    print(f"Saved dead tracks to: {BAD_TRACKS_JSON}")

if __name__ == "__main__":
    extract_dead_tracks()