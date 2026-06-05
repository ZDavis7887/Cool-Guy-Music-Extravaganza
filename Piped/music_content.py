#!/usr/bin/env python3
#RUN THE FOLLOWING EVERY 30 DAYS
#python music_content.py --api-key AIzaSyAy7hztoIzmTm-JLaUa1woMPbxvzJ5gsZE --since-days 30
#FOR NEW CONTENT TO ADD TO LIST
# python music_content.py --api-key AIzaSyAy7hztoIzmTm-JLaUa1woMPbxvzJ5gsZE --depth 10

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional, Tuple

import requests
from dateutil import parser as dateparser

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"


# ---------------------------
# Channel seeds
# ---------------------------
DEFAULT_CHANNEL_SEEDS = [
  "@fantano",
  "@deepcuts_",
  "@professorskye",
  "@TrashTheory",
  "@Polyphonic",
  "@Middle8",
  "@micthesnare",
  "@Volkgeist",
  "@DiggingtheGreats",
  "@RockNRollTrueStories",
  "@ThePunkRockMBA",
  "@punkrockhistory",          # The Punk Rock History Podcast
  "@historyofrockmusicinfivesongs",
  "@AlfoMedia",
  "@SoundFieldShow",
  "@TheLineofBestFit",
  "@SpectrumPulse",
  "@toddintheshadows",
  "@BangerTV",
  "@SeaOfTranquility",
  "@NotesReviews",
  "@DeadEndHipHop",
  "@PadChennington",
  "@Rocked",
  "@JustinHawkinsRidesAgain",
  "@TheMetalTempestYT",
  "@hiphopmadness",
  "grungeHQ",
  "@TheHardTimesNews",
  "@BehindtMusic",
  "@StreamMusicandMore",
  "@EveryAlbumEver",
  "@RAWMUSICTV",
  

]


# ---------------------------
# Filtering logic
# ---------------------------
EXCLUDE_TITLE_RE = re.compile(
    r"\b(official\s+video|music\s+video|lyrics|lyric\s+video|audio\s+only|"
    r"full\s+album|album\s+stream|playlist|shorts?|teaser|trailer|mv)\b",
    re.IGNORECASE,
)


# ---------------------------
# Utilities
# ---------------------------
def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def parse_iso8601_duration(duration: str) -> int:
    """Parse ISO 8601 duration like 'PT1H2M10S' into seconds."""
    hours = minutes = seconds = 0
    m = re.match(r"^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$", duration)
    if not m:
        return 0
    if m.group(1): hours = int(m.group(1))
    if m.group(2): minutes = int(m.group(2))
    if m.group(3): seconds = int(m.group(3))
    return hours * 3600 + minutes * 60 + seconds

def safe_get(d: dict, path: List[str], default=None):
    cur = d
    for p in path:
        if not isinstance(cur, dict) or p not in cur:
            return default
        cur = cur[p]
    return cur

def api_get(endpoint: str, params: dict, api_key: str, retries: int = 3) -> dict:
    url = f"{YOUTUBE_API_BASE}/{endpoint}"
    params = {**params, "key": api_key}
    last_err = None
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, timeout=30)
            if r.status_code == 200:
                return r.json()
            last_err = f"HTTP {r.status_code}: {r.text[:300]}"
        except Exception as e:
            last_err = str(e)
        time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"YouTube API error calling {endpoint}: {last_err}")

def load_cache(path: str) -> dict:
    if not path or not os.path.exists(path):
        return {"seen_video_ids": {}, "last_run_utc": None}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_cache(path: str, cache: dict) -> None:
    if not path:
        return
    cache["last_run_utc"] = iso_now()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)

def load_existing_features(path: str) -> List[dict]:
    """Loads existing items from features.json securely."""
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except Exception:
            return []
    return []

def append_single_feature_to_json(path: str, item: dict) -> None:
    """Safely appends a single item to the JSON array without rewriting manually."""
    dataset = load_existing_features(path)
    # Double check link duplicates before adding
    if not any(f.get('YouTubeLink') == item['YouTubeLink'] for f in dataset):
        dataset.append(item)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(dataset, f, indent=4, ensure_ascii=False)


# ---------------------------
# Main harvesting
# ---------------------------
@dataclass
class HarvestConfig:
    api_key: str
    out_json: str
    cache_path: str
    seeds: List[str]
    min_minutes: int
    since_days: Optional[int]
    after: Optional[str]
    before: Optional[str]
    include_shorts: bool
    max_pages: int


def within_window(published_at: str, after_iso: Optional[str], before_iso: Optional[str]) -> bool:
    dt = dateparser.isoparse(published_at)
    if after_iso:
        after_dt = dateparser.isoparse(after_iso)
        if dt < after_dt:
            return False
    if before_iso:
        before_dt = dateparser.isoparse(before_iso)
        if dt > before_dt:
            return False
    return True


# ---------------------------
# Channel resolution
# ---------------------------
def resolve_channel_id(seed: str, api_key: str) -> Optional[str]:
    # 1. Clean up potential invisible whitespace/formatting strings
    clean_seed = re.sub(r'[^a-zA-Z0-9_-]', '', seed).strip()

    # 2. Direct Validation: If it's a structural channel ID, return it immediately
    if clean_seed.startswith("UC") and len(clean_seed) == 24:
        return clean_seed

    # 3. Handle Handles: If it's a handle, search for the channel ID
    search_query = clean_seed if clean_seed.startswith("@") else f"@{clean_seed}"
    try:
        data = api_get(
            "search",
            {"part": "snippet", "q": search_query, "type": "channel", "maxResults": 1},
            api_key,
        )
        items = data.get("items", [])
        if items:
            return safe_get(items[0], ["snippet", "channelId"]) or safe_get(items[0], ["id", "channelId"])
    except Exception:
        pass

    return None


def get_uploads_playlist_id(channel_id: str, api_key: str) -> Optional[str]:
    data = api_get(
        "channels",
        {"part": "contentDetails", "id": channel_id, "maxResults": 1},
        api_key,
    )
    items = data.get("items", [])
    if not items:
        return None
    return safe_get(items[0], ["contentDetails", "relatedPlaylists", "uploads"])


def list_playlist_video_ids(playlist_id: str, api_key: str, max_pages: int = 2) -> List[str]:
    video_ids: List[str] = []
    page_token = None

    for _ in range(max_pages):
        params = {
            "part": "contentDetails",
            "playlistId": playlist_id,
            "maxResults": 50,
        }
        if page_token:
            params["pageToken"] = page_token

        data = api_get("playlistItems", params, api_key)
        items = data.get("items", [])
        for it in items:
            vid = safe_get(it, ["contentDetails", "videoId"])
            if vid:
                video_ids.append(vid)

        page_token = data.get("nextPageToken")
        if not page_token:
            break

    return video_ids


def fetch_videos_details(video_ids: List[str], api_key: str) -> List[dict]:
    out: List[dict] = []
    for i in range(0, len(video_ids), 50):
        chunk = video_ids[i : i + 50]
        data = api_get(
            "videos",
            {
                "part": "snippet,contentDetails,statistics",
                "id": ",".join(chunk),
                "maxResults": 50,
            },
            api_key,
        )
        out.extend(data.get("items", []))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api-key", required=True, help="YouTube Data API v3 key")
    ap.add_argument("--out", default="features.json", help="Output JSON path")
    ap.add_argument("--cache", default="youtube_music_cache.json", help="Cache JSON tracker path")
    ap.add_argument("--seeds", default=None, help="Optional text file path containing custom seeds")
    ap.add_argument("--min-minutes", type=int, default=15, help="Minimum video length minutes")
    ap.add_argument("--since-days", type=int, default=None, help="Include videos published in the last N days")
    ap.add_argument("--after", default=None, help="Include videos published after this ISO date")
    ap.add_argument("--before", default=None, help="Include videos published before this ISO date")
    ap.add_argument("--include-shorts", action="store_true", help="Allow shorts content to bypass filters")
    ap.add_argument("--depth", type=int, default=2, help="Number of playlist pages to fetch per channel")
    args = ap.parse_args()

    seeds = DEFAULT_CHANNEL_SEEDS[:]
    if args.seeds:
        with open(args.seeds, "r", encoding="utf-8") as f:
            seeds = [ln.strip() for ln in f if ln.strip() and not ln.strip().startswith("#")]

    after_iso = args.after
    before_iso = args.before
    if args.since_days is not None:
        after_dt = datetime.now(timezone.utc) - timedelta(days=args.since_days)
        after_iso = after_dt.isoformat().replace("+00:00", "Z")

    cfg = HarvestConfig(
        api_key=args.api_key,
        out_json=args.out,
        cache_path=args.cache,
        seeds=seeds,
        min_minutes=args.min_minutes,
        since_days=args.since_days,
        after=after_iso,
        before=before_iso,
        include_shorts=args.include_shorts,
        max_pages=args.depth
    )

    cache = load_cache(cfg.cache_path)
    seen: Dict[str, str] = cache.get("seen_video_ids", {})

    # Read current state to measure delta calculations
    initial_count = len(load_existing_features(cfg.out_json))
    grand_added_count = 0

    resolved_channels: List[Tuple[str, str]] = []

    print(f"[i] Seeds total: {len(cfg.seeds)}")
    print(f"[i] Target Output File: {cfg.out_json}")
    print(f"[i] Current database features tally: {initial_count}")
    print(f"[i] Query Depth limit per channel: {cfg.max_pages} pages")

    for seed in cfg.seeds:
        try:
            cid = resolve_channel_id(seed, cfg.api_key)
            if not cid:
                print(f"[!] Could not resolve channel: {seed}")
                continue
            resolved_channels.append((seed, cid))
        except Exception as err:
            print(f"[!] Error resolving channel {seed}: {err}")
            continue

    print(f"[i] Resolved channels: {len(resolved_channels)}")

    for seed, channel_id in resolved_channels:
        try:
            uploads = get_uploads_playlist_id(channel_id, cfg.api_key)
            if not uploads:
                print(f"[!] No uploads playlist path found for: {seed}")
                continue

            video_ids = list_playlist_video_ids(uploads, cfg.api_key, max_pages=cfg.max_pages)
            if not video_ids:
                continue

            video_ids = [vid for vid in video_ids if vid not in seen]

            if not video_ids:
                print(f"[i] No new content found for: {seed}")
                continue

            videos = fetch_videos_details(video_ids, cfg.api_key)
            channel_added_count = 0

            for v in videos:
                vid = v.get("id")
                snippet = v.get("snippet", {})
                content = v.get("contentDetails", {})

                title = snippet.get("title", "").strip()
                channel_title = snippet.get("channelTitle", "").strip()
                published_at = snippet.get("publishedAt")
                if not published_at:
                    continue

                if not within_window(published_at, cfg.after, cfg.before):
                    continue

                if EXCLUDE_TITLE_RE.search(title):
                    continue

                duration_sec = parse_iso8601_duration(content.get("duration", "PT0S"))

                if not cfg.include_shorts and duration_sec < 60:
                    continue

                if duration_sec < cfg.min_minutes * 60:
                    continue

                title_lower = title.lower()
                content_type = "Music Feature"
                if "review" in title_lower or "one hit wonderland" in title_lower: 
                    content_type = "Album Review"
                elif "interview" in title_lower: 
                    content_type = "Artist Interview"
                elif any(x in title_lower for x in ["documentary", "retrospective", "history", "story", "trainwreckords"]): 
                    content_type = "Documentary"
                elif any(x in title_lower for x in ["deep dive", "essay", "explained", "dive"]): 
                    content_type = "Music Deep Dive"

                url = f"https://www.youtube.com/watch?v={vid}"

                feature_item = {
                    "Artist": "Various Artists",
                    "Title": title,
                    "YouTubeLink": url,
                    "Type": content_type,
                    "Source": channel_title or seed,
                    "Summary": f"A curated music feature from {channel_title or seed}."
                }

                # Safe atomic append check execution
                current_deck = load_existing_features(cfg.out_json)
                if not any(f.get('YouTubeLink') == url for f in current_deck):
                    append_single_feature_to_json(cfg.out_json, feature_item)
                    channel_added_count += 1
                    grand_added_count += 1
                    seen[vid] = published_at

            print(f"  [SUCCESS] Siphoned +{channel_added_count} new features from {channel_title or seed}")
        except Exception as e:
            print(f"[!] Error processing channel data for {seed}: {e}")
            continue

    if grand_added_count > 0:
        print(f"\n[✓] Grand Total: Appended {grand_added_count} brand-new items into {cfg.out_json}")
    else:
        print("\n[i] Scan completed. No new tracks found to append.")

    cache["seen_video_ids"] = seen
    save_cache(cfg.cache_path, cache)
    print(f"[✓] Tracker cache updated: {cfg.cache_path}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[!] Execution interrupted.")
        sys.exit(1)