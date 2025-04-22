import json
import requests
import time

# ========== CONFIG ==========
API_KEY = '67151f1c5943c2b35b9750ab48ac296f'  # <<=== <<< PUT YOUR KEY HERE
json_file = 'tracks.json'
SAVE_EVERY_N_TRACKS = 50
# =============================

def fetch_album_info(artist, album):
    url = f"http://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key={API_KEY}&artist={artist}&album={album}&format=json"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'album' in data:
                album_data = data['album']
                year = album_data.get('releasedate', '').strip()
                if year:
                    year = year.split()[-1] if year.split() else "Unknown"
                else:
                    year = "Unknown"
                image_list = album_data.get('image', [])
                # Find the largest available image
                album_art = next((img['#text'] for img in image_list[::-1] if img['#text']), None)
                return year, album_art
    except Exception as e:
        print(f"Error fetching album info: {e}")
    return None, None

def update_tracks():
    with open(json_file, 'r', encoding='utf-8') as f:
        tracks = json.load(f)

    updated_count = 0

    for idx, track in enumerate(tracks):
        needs_update = (track.get('Year') == 'Unknown') or ('AlbumArtLink' not in track or not track['AlbumArtLink'])
        if needs_update:
            artist = track['Artist']
            album = track['Album']
            if album and album != 'Unknown':
                print(f"🔎 Searching info for: {artist} - {album}")
                year, album_art = fetch_album_info(artist, album)
                if year and track.get('Year') == 'Unknown':
                    track['Year'] = year
                if album_art:
                    track['AlbumArtLink'] = album_art
                updated_count += 1
            time.sleep(0.25)  # Be polite to the API

        if idx % SAVE_EVERY_N_TRACKS == 0:
            with open(json_file, 'w', encoding='utf-8') as f_out:
                json.dump(tracks, f_out, indent=2, ensure_ascii=False)

    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(tracks, f, indent=2, ensure_ascii=False)

    print(f"✅ Done updating {updated_count} tracks!")

if __name__ == '__main__':
    update_tracks()
