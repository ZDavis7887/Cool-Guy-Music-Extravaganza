import os
import json
import random
import re
from typing import Optional, Dict, Any, List

import pandas as pd
from flask import Flask, jsonify, send_from_directory

# ---- CONFIG ----
CSV_PATH = "MCGBGTV Master List - Toons.csv"  # put file in same folder as app.py
LINK_COL_INDEX = 4  # Column E = 0:A,1:B,2:C,3:D,4:E
CACHE_PATH = "toons_seen_cache.json"  # optional: helps reduce repeats across restarts
# --------------

app = Flask(__name__)

def load_links(csv_path: str, col_index: int) -> List[str]:
    df = pd.read_csv(csv_path)
    if df.shape[1] <= col_index:
        raise ValueError(f"CSV has only {df.shape[1]} columns; cannot read column index {col_index} (E).")

    series = df.iloc[:, col_index].dropna().astype(str).map(str.strip)
    links = [x for x in series.tolist() if x]

    # de-dupe while preserving order
    seen = set()
    out = []
    for url in links:
        if url not in seen:
            out.append(url)
            seen.add(url)
    return out

def video_id_from_url(url: str) -> Optional[str]:
    """
    Extract YouTube video id from common formats:
    - https://www.youtube.com/watch?v=VIDEOID
    - https://youtu.be/VIDEOID
    - https://www.youtube.com/embed/VIDEOID
    - https://www.youtube.com/shorts/VIDEOID
    Also handles extra params like &t=, &list=, etc.
    """
    if not url:
        return None

    # watch?v=
    m = re.search(r"[?&]v=([A-Za-z0-9_-]{6,})", url)
    if m:
        return m.group(1)

    # youtu.be/
    m = re.search(r"youtu\.be/([A-Za-z0-9_-]{6,})", url)
    if m:
        return m.group(1)

    # /embed/
    m = re.search(r"/embed/([A-Za-z0-9_-]{6,})", url)
    if m:
        return m.group(1)

    # /shorts/
    m = re.search(r"/shorts/([A-Za-z0-9_-]{6,})", url)
    if m:
        return m.group(1)

    return None

def load_seen(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        return {"seen": []}
    try:
        with open(path, "r", encoding="utf-8") as f:
            obj = json.load(f)
        if isinstance(obj, dict) and isinstance(obj.get("seen"), list):
            return obj
    except Exception:
        pass
    return {"seen": []}

def save_seen(path: str, seen_list: List[str]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"seen": seen_list[-2000:]}, f, indent=2)

# Load data at startup
LINKS = load_links(CSV_PATH, LINK_COL_INDEX)
SEEN = load_seen(CACHE_PATH)["seen"]  # list of urls (optional repeat reduction)

@app.get("/")
def home():
    # index.html must be in same folder as app.py
    return send_from_directory(".", "index.html")

@app.get("/health")
def health():
    return jsonify({
        "ok": True,
        "links_loaded": len(LINKS),
        "seen_count": len(SEEN),
        "csv_path": CSV_PATH,
        "link_col_index": LINK_COL_INDEX
    })

@app.get("/next")
def next_item():
    if not LINKS:
        return jsonify({"error": "No links loaded"}), 500

    # Try to avoid repeats by picking from unseen first
    unseen = [u for u in LINKS if u not in set(SEEN)]
    pool = unseen if unseen else LINKS

    # Keep trying until we find a url with a valid video id (up to a few attempts)
    for _ in range(12):
        url = random.choice(pool)
        vid = video_id_from_url(url)
        if vid:
            SEEN.append(url)
            save_seen(CACHE_PATH, SEEN)
            return jsonify({
                "url": url,
                "videoId": vid
            })

    return jsonify({"error": "Could not find a playable YouTube videoId in recent picks."}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)