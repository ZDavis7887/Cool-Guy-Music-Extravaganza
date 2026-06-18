import csv
import json
import os

def convert_massive_csv(input_file):
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        return

    all_rows = []
    
    print(f"Reading {input_file}...")
    try:
        # Using latin-1 to handle those special characters from before
        with open(input_file, mode='r', encoding='latin-1') as csvfile:
            # We use reader.fieldnames to access columns by position
            reader = csv.reader(csvfile)
            next(reader) # Skip the header row
            
            for row in reader:
                # Column A is index 0, Column B is index 1, Column H is index 7
                # This assumes your CSV is standard. If not, adjust these indexes!
                title = row[0] if len(row) > 0 else "Unknown Title"
                channel = row[1] if len(row) > 1 else "Unknown Channel"
                link = row[7] if len(row) > 7 else None
                
                if link and link.strip():
                    all_rows.append({
                        "Title": title.strip(),
                        "Source": channel.strip(), # 'Source' maps to your channel
                        "YouTubeLink": link.strip(),
                        "Summary": f"Deep dive from {channel.strip()}."
                    })
    except Exception as e:
        print(f"An error occurred: {e}")
        return

    print(f"Successfully processed {len(all_rows)} links.")

    with open('deep_dives_master.json', 'w', encoding='utf-8') as f:
        json.dump(all_rows, f, indent=4)
        
    print("Generated: deep_dives_master.json")

if __name__ == "__main__":
    convert_massive_csv('deepdives.csv')