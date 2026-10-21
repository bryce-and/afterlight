#!/bin/sh
# Headless per-map check: zones clear, spawns, reachability, z-fights, terrain range. Needs no browser pane, so builders can run it.
# Usage: sh tools/maptest.sh <location id> [mission indexes, comma separated]     e.g.  sh tools/maptest.sh moon 0,1,2
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$chrome" ] || { echo "Google Chrome not found at $chrome" >&2; exit 2; }
loc=${1:?location id (earth, moon, mars, titan, tangled, io, dc, leviathan)}
mi=${2:-0,1,2}
port=$((8200 + $$ % 700))
python3 -m http.server "$port" --bind 127.0.0.1 --directory "$root" >/dev/null 2>&1 &
srv=$!
profile=$(mktemp -d)
trap 'kill $srv 2>/dev/null; wait $srv 2>/dev/null || true; rm -rf "$profile"' EXIT
sleep 1
dom=$("$chrome" --headless=new --user-data-dir="$profile" --enable-unsafe-swiftshader --use-angle=swiftshader \
  --virtual-time-budget=120000 --dump-dom "http://127.0.0.1:$port/tools/maptest.html?loc=$loc&mi=$mi" 2>/dev/null)
printf '%s' "$dom" | python3 -c "import sys,re,html; m=re.search(r'<pre id=\"result\">(.*?)</pre>', sys.stdin.read(), re.S); print(html.unescape(m.group(1)) if m else 'no result (page did not finish)')"
