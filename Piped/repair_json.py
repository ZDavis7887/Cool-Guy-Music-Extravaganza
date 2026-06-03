import re
import json

IN_PATH = "tracks_dates.json"
OUT_PATH = "tracks_dates_repaired.json"

# Matches ASCII control chars except: \t \n \r (we'll handle those separately)
CTRL_CHARS = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F]")

with open(IN_PATH, "r", encoding="utf-8", errors="replace") as f:
    raw = f.read()

# 1) Remove illegal control characters
raw = CTRL_CHARS.sub("", raw)

# 2) Replace literal tabs/newlines INSIDE JSON strings is tricky,
# but if the file got corrupted, often these are literal characters in values.
# A pragmatic cleanup is to replace raw newlines and tabs with escaped versions.
# This can fix many "invalid control character" cases.
raw = raw.replace("\t", "\\t")
raw = raw.replace("\r", "\\r")
raw = raw.replace("\n", "\\n")

# Write the cleaned text
with open(OUT_PATH, "w", encoding="utf-8") as f:
    f.write(raw)

# Validate
try:
    with open(OUT_PATH, "r", encoding="utf-8") as f:
        json.load(f)
    print(f"Repaired JSON written to: {OUT_PATH} (and it validates)")
except json.JSONDecodeError as e:
    print("Still invalid after repair:", e)