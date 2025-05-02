import json
import requests
import time

# ========== CONFIG ==========
API_KEY = '67151f1c5943c2b35b9750ab48ac296f'
json_file = 'tracks_dates.json'
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
                image_list = album_data.get('image', [])
                album_art = next((img['#text'] for img in image_list[::-1] if img['#text']), None)
                return album_art
    except Exception as e:
        print(f"Error fetching album info: {e}")
    return None

def update_tracks():
    with open(json_file, 'r', encoding='utf-8') as f:
        tracks = json.load(f)

    updated_count = 0

    for idx, track in enumerate(tracks):
        has_art = track.get('AlbumArtLink')

        if has_art:
            continue  # Skip tracks that already have album art

        artist = track['Artist']
        album = track['Album']
        if album and album != 'Unknown':
            print(f"🔎 Searching album art for: {artist} - {album}")
            album_art = fetch_album_info(artist, album)

            if album_art:
                track['AlbumArtLink'] = album_art
                updated_count += 1
                time.sleep(0.25)

        if idx % SAVE_EVERY_N_TRACKS == 0:
            with open(json_file, 'w', encoding='utf-8') as f_out:
                json.dump(tracks, f_out, indent=2, ensure_ascii=False)

    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(tracks, f, indent=2, ensure_ascii=False)

    print(f"✅ Done updating {updated_count} tracks with album art!")

if __name__ == '__main__':
    update_tracks()
