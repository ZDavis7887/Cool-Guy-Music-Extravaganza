import pandas as pd
import json

# Load your CSV
csv_file = 'Library - Music - All.csv'
df = pd.read_csv(csv_file)

# Prepare a lookup dictionary from Artist+Title -> Album/Year
df = df[['albums.tracks.grandparentTitle', 'albums.tracks.title', 'albums.tracks.parentTitle', 'albums.tracks.year']]
df.columns = ['Artist', 'Title', 'Album', 'Year']
df = df.dropna(subset=['Artist', 'Title'])

lookup = {(row['Artist'], row['Title']): (row['Album'], row['Year']) for index, row in df.iterrows()}

# Load your existing tracks.json
json_file = 'tracks.json'
with open(json_file, 'r', encoding='utf-8') as f:
    tracks = json.load(f)

# Update Album and Year fields
for track in tracks:
    key = (track['Artist'], track['Title'])
    if key in lookup:
        album, year = lookup[key]
        track['Album'] = album if pd.notna(album) else 'Unknown'
        track['Year'] = int(year) if pd.notna(year) else 'Unknown'
    else:
        track['Album'] = track.get('Album', 'Unknown')
        track['Year'] = track.get('Year', 'Unknown')

# Save back to tracks.json
with open(json_file, 'w', encoding='utf-8') as f:
    json.dump(tracks, f, indent=2, ensure_ascii=False)

print(f"✅ Updated {len(tracks)} tracks with Album and Year info!")
