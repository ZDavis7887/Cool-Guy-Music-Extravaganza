import json
import csv
import os
import math

def split_tracks(filename='tracks.json', batch_size=250):
    if not os.path.exists('Review_Batches'):
        os.makedirs('Review_Batches')

    try:
        with open(filename, 'r', encoding='utf-8') as f:
            tracks = json.load(f)
    except FileNotFoundError:
        print(f"Error: {filename} not found.")
        return

    # 1. Collect EVERY possible key from EVERY track to build the header
    all_keys = set()
    for track in tracks:
        all_keys.update(track.keys())
    
    # Convert set to a sorted list for consistent columns
    fieldnames = sorted(list(all_keys))

    # Sort tracks by Artist so the batches are organized alphabetically
    tracks.sort(key=lambda x: str(x.get('Artist', '')).lower())

    total_batches = math.ceil(len(tracks) / batch_size)
    
    for i in range(total_batches):
        start = i * batch_size
        end = start + batch_size
        batch = tracks[start:end]
        
        # Use a safe filename by stripping weird characters from the Artist name
        first_artist = "".join(x for x in str(batch[0].get('Artist', 'Unknown')) if x.isalnum())[:10]
        batch_filename = f'Review_Batches/Batch_{i+1:02d}_{first_artist}.csv'
        
        with open(batch_filename, 'w', newline='', encoding='utf-8') as f:
            dict_writer = csv.DictWriter(f, fieldnames=fieldnames)
            dict_writer.writeheader()
            dict_writer.writerows(batch)
            
    print(f"Success! Created {total_batches} batches in the 'Review_Batches' folder.")

if __name__ == "__main__":
    split_tracks()