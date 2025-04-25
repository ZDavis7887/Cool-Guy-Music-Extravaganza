import pandas as pd
import json

# Load the original CSV (your music library export)
csv_file = 'Library - Music - All.csv'
json_file = 'tracks.json'
output_file = 'tracks_updated.json'

# Read only needed columns from the CSV
df = pd.read_csv(csv_file)
df = df[['albums.tracks.grandparentTitle', 'albums.tracks.title', 'albums.originallyAvailableAt']]
df.columns = ['Artist', 'Title', 'ReleaseDate']
df = df.dropna()

# Build a lookup dictionary (Artist + Title) => ReleaseDate
release_lookup = {
    (row['Artist'], row['Title']): row['ReleaseDate']
    for _, row in df.iterrows()
}

# Load your current JSON (with YouTube/album art etc.)
with open(json_file, 'r', encoding='utf-8') as f:
    tracks = json.load(f)

updated_tracks = []
count_updated = 0

for track in tracks:
    key = (track.get('Artist'), track.get('Title'))
    release_date = release_lookup.get(key)

    if release_date and track.get('ReleaseDate') in [None, '', 'Unknown']:
        track['ReleaseDate'] = release_date
        count_updated += 1

    updated_tracks.append(track)

# Save safely to new file
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(updated_tracks, f, indent=2, ensure_ascii=False)

print(f"✅ Release dates added to {count_updated} tracks.")
print(f"💾 Output saved to {output_file}")
