import pandas as pd
import json

# Paths
csv_file = 'Library - Music - All.csv'
json_file = 'tracks.json'
output_json = 'tracks_updated.json'

# Load release dates from CSV
df = pd.read_csv(csv_file)
df_clean = df[['albums.tracks.grandparentTitle', 'albums.tracks.title', 'albums.originallyAvailableAt']].dropna()
df_clean.columns = ['Artist', 'Title', 'ReleaseDate']

# Make lookup table from CSV
release_lookup = {
    (row['Artist'], row['Title']): row['ReleaseDate']
    for _, row in df_clean.iterrows()
}

# Load existing tracks
with open(json_file, 'r', encoding='utf-8') as f:
    existing_tracks = json.load(f)

updated_tracks = []
updated_count = 0

for track in existing_tracks:
    key = (track.get('Artist'), track.get('Title'))
    release_date = release_lookup.get(key)

    # Only update ReleaseDate if it's missing or 'Unknown'
    if track.get('ReleaseDate') in [None, '', 'Unknown'] and release_date:
        track['ReleaseDate'] = release_date
        updated_count += 1

    updated_tracks.append(track)

# Save updated JSON
with open(output_json, 'w', encoding='utf-8') as f:
    json.dump(updated_tracks, f, indent=2, ensure_ascii=False)

print(f"✅ Updated {updated_count} tracks with release dates.")
print(f"💾 Saved as: {output_json}")
