import yt_dlp
import json
import time
import random

def get_high_authority_feature_NO_API(artist_name):
    # ANCHORED QUERY: 'music of' forces the search into the right lane
    search_query = f"ytsearch15:music of {artist_name} (deep dive OR album review OR documentary OR full concert)"
    
    ydl_opts = {
        'quiet': True,
        'extract_flat': True,
        'force_generic_ext': True,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            results = ydl.extract_info(search_query, download=False)
            entries = results.get('entries', [])
            random.shuffle(entries)

            for entry in entries:
                title = entry.get('title', '').lower()
                
                # 1. THE MUSIC GATE: Verify the video is actually about music
                music_keywords = ['album', 'song', 'band', 'music', 'discography', 'review']
                if not any(word in title for word in music_keywords):
                    continue

                # 2. DURATION GATE: 10 minutes (600s)
                duration = entry.get('duration')
                if not duration or duration < 600:
                    continue

                # 3. AUTHORITY GATE: 100k views
                views = entry.get('view_count', 0)
                if views and views >= 100000:
                    
                    # Categorization
                    content_type = "Music Feature"
                    if "review" in title: content_type = "Album Review"
                    elif "interview" in title: content_type = "Artist Interview"
                    elif "documentary" in title or "retrospective" in title: content_type = "Documentary"
                    elif "deep dive" in title or "essay" in title: content_type = "Music Deep Dive"
                    elif any(x in title for x in ["concert", "live at", "full show"]): content_type = "Live Concert"

                    print(f"  [VERIFIED MUSIC] {content_type}: {entry['title']} ({views} views)")
                    
                    return {
                        "Artist": artist_name,
                        "Title": entry['title'],
                        "YouTubeLink": f"https://www.youtube.com/watch?v={entry['id']}",
                        "Type": content_type,
                        "Source": entry.get('uploader', 'Unknown Channel'),
                        "Summary": f"A curated music feature focused on {artist_name}."
                    }
        except Exception as e:
            print(f"  [SKIP] Error searching {artist_name}: {e}")
            
    return None

def build_feature_deck():
    try:
        # Based strictly on your tracklist
        with open('upgraded_tracks.json', 'r', encoding='utf-8') as f:
            tracklist = json.load(f)
    except Exception as e:
        print(f"Error loading your tracklist: {e}")
        return

    # Extract unique artists from your 5,275 track list
    artists = list(set([t['Artist'] for t in tracklist if 'Artist' in t]))
    random.shuffle(artists)

    features = []
    limit = 300 

    print(f"ZTV Scout: Initializing VERIFIED Music Hunt for {limit} features...")

    for artist in artists:
        if len(features) >= limit: break
        
        result = get_high_authority_feature_NO_API(artist)
        if result:
            features.append(result)
            with open('features.json', 'w', encoding='utf-8') as f:
                json.dump(features, f, indent=4, ensure_ascii=False)
        
        time.sleep(2.0) # Slightly slower to keep search results accurate

    print(f"Success! Your verified music feature deck is ready.")

if __name__ == "__main__":
    build_feature_deck()