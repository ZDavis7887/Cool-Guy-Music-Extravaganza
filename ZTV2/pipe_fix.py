import json

with open('tracks.json', 'r', encoding='utf-8') as f:
    tracks = json.load(f)

fixed = 0
for track in tracks:
    link = track.get('link', '')
    if 'piped.kavin.rocks' in link:
        track['link'] = link.replace('piped.kavin.rocks', 'piped.video')
        fixed += 1

with open('tracks.json', 'w', encoding='utf-8') as f:
    json.dump(tracks, f, indent=2, ensure_ascii=False)

print(f"✅ Fixed {fixed} bad links to good servers!")
