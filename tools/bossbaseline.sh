#!/bin/sh
# Prints the boss model baselines as JSON (tools/boss-baselines.json is this output's "out"). Usage: sh tools/bossbaseline.sh > /tmp/b.json
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
port=$((8900 + $$ % 90))
python3 -m http.server "$port" --bind 127.0.0.1 --directory "$root" >/dev/null 2>&1 &
srv=$!
profile=$(mktemp -d)
trap 'kill $srv 2>/dev/null; wait $srv 2>/dev/null || true; rm -rf "$profile"' EXIT
sleep 1
"$chrome" --headless=new --disable-gpu --user-data-dir="$profile" --virtual-time-budget=30000 --dump-dom "http://127.0.0.1:$port/tools/bossbaseline.html" 2>/dev/null | sed -n 's/.*BASELINE\(.*\)END.*/\1/p' | head -1
