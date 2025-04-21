import pandas as pd
import json

# Paths
csv_file = 'Library - Music - All.csv'  # <-- Your updated CSV filename
json_file = 'tracks.json'

# Load CSV
df = pd.read_csv(csv_file)

# Extract only the needed columns
clean_df = df[['albums.tracks.grandparentTitle', 'albums.tracks.title']].dropna()
clean_df.columns = ['Artist', 'Title']

# Convert to list of dicts
tracks = clean_df.to_dict(orient='records')

# Save to JSON
with open(json_file, 'w', encoding='utf-8') as f:
    json.dump(tracks, f, indent=2, ensure_ascii=False)

print(f"✅ Updated {json_file} from {csv_file}")
