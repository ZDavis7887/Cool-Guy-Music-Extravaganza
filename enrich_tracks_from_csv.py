import pandas as pd
import json

# ===== Paths =====
csv_file = 'Library - Music - All.csv'
json_file = 'tracks_dates.json'
output_file = 'tracks_summaries.json'

# ===== Load CSV =====
df = pd.read_csv(csv_file)
df = df[['albums.tracks.grandparentTitle', 'albums.tracks.title', 'albums.title',
         'albums.originallyAvailableAt', 'summary']].dropna(subset=['albums.tracks.grandparentTitle', 'albums.tracks.title'])

df.columns = ['Artist', 'Title', 'Album', 'ReleaseDate', 'ArtistSummary']

# ===== Build lookup tables =====
album_date_lookup = {
    (row['Artist'], row['Album']): row['ReleaseDate']
    for _, row in df.iterrows()
}

artist_summary_lookup = {
    row['Artist']: row['ArtistSummary']
    for _, row in df.dropna(subset=['ArtistSummary']).drop_duplicates(subset=['Artist']).iterrows()
}

# ===== Load existing tracks.json =====
with open(json_file, 'r', encoding='utf-8') as f:
    tracks = json.load(f)

updated_tracks = []
date_updated = 0
summary_updated = 0

for track in tracks:
    artist = track.get('Artist')
    album = track.get('Album')

    # Update ReleaseDate if missing
    if track.get('ReleaseDate') in [None, '', 'Unknown']:
        new_date = album_date_lookup.get((artist, album))
        if new_date:
            track['ReleaseDate'] = new_date
            date_updated += 1

    # Update Artist Summary if missing
    if 'Summary' not in track or not track.get('Summary'):
        new_summary = artist_summary_lookup.get(artist)
        if new_summary:
            track['Summary'] = new_summary
            summary_updated += 1

    updated_tracks.append(track)

# ===== Save updated tracks =====
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(updated_tracks, f, indent=2, ensure_ascii=False)

print(f"✅ Release dates updated for {date_updated} tracks.")
print(f"✅ Summaries added for {summary_updated} artists.")
print(f"💾 Saved as: {output_file}")
