from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
import json
import time

# Load files
with open("tracks.json", "r", encoding="utf-8") as f:
    tracks = json.load(f)

with open("mismatched_tracks.json", "r", encoding="utf-8") as f:
    mismatches = json.load(f)

track_map = {f"{t['Artist']} - {t['Title']}": t for t in tracks}

# Setup Selenium
options = Options()
options.add_argument("--headless")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")

driver = webdriver.Chrome(options=options)

# Fix tracks
updated = 0
for m in mismatches:
    expected = m["Expected"]
    if expected in track_map:
        search_query = expected.replace(" ", "+")
        print(f"Searching for: {expected}")
        try:
            driver.get(f"https://www.youtube.com/results?search_query={search_query}")
            time.sleep(2.5)
            results = driver.find_elements(By.ID, 'video-title')
            for result in results:
                href = result.get_attribute('href')
                if href and "/watch?v=" in href:
                    track_map[expected]["YouTubeLink"] = href
                    print(f"✅ Found: {href}")
                    updated += 1
                    break
        except Exception as e:
            print(f"❌ Error searching {expected}: {e}")

driver.quit()

# Save results
with open("tracks_corrected.json", "w", encoding="utf-8") as f:
    json.dump(list(track_map.values()), f, indent=2, ensure_ascii=False)

print(f"\n🎉 Updated {updated} tracks.")
