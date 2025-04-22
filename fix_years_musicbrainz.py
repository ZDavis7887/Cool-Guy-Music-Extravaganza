import json
import requests
import time

# ========== CONFIG ==========
input_file = 'tracks.json'
output_file = 'tracks_fixed.json'
DELAY_SECONDS = 1  # Be polite to MusicBrainz servers
# =============================

def search_musicbrainz(artist, album):
    query = f'artist:"{artist}" AND release:"{album}"'
    url = f'https://musicbrainz.org/ws/2/release/?query={query}&fmt=json'
    
    try:
        response = requests.get(url, headers={
            'User-Agent': 'ZTV-MusicPlayer/1.0 ( https://yourdomain.com )'
        }, timeout=10)

        if response.status_code == 200:
            data = response.json()
            if 'releases' in data and len(data['releases']) > 0:
                release = data['releases'][0]
                return release.get('date', '').split('-')[0]  # Just get year part
    except Exception as e:
        print(f"Error searching MusicBrainz for {artist} - {album}: {e}")
    
    return None

def fix_years(input_path, output_path):
    with open(input_path, 'r', encoding='utf-8') as f:
        tracks = json.load(f)

    updated_tracks = []
    fixed_count = 0

    for track in tracks:
        if track.get('Year', 'Unknown') == 'Unknown':
            artist = track.get('Artist', '')
            album = track.get('Album', '')
            if artist and album:
                print(f"🔎 Searching year for: {artist} - {album}")
                year = search_musicbrainz(artist, album)
                if year:
                    track['Year'] = year
                    fixed_count += 1
                else:
                    print(f"❌ No year found for: {artist} - {album}")
                time.sleep(DELAY_SECONDS)  # Be polite
        updated_tracks.append(track)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(updated_tracks, f, indent=2, ensure_ascii=False)

    print(f"✅ Finished! Fixed {fixed_count} tracks.")
    print(f"💾 Saved updated tracks to {output_path}")

# ========== MAIN ==========
if __name__ == '__main__':
    fix_years(input_file, output_file)
