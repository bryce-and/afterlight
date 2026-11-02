#!/bin/sh
# Headless screenshot of enemy models (front, three-quarters and side), for checking unit models without the browser pane.
# Usage: sh tools/unitshot.sh <out.png> <unit,unit,...> [location id] [crit]
#   e.g.  sh tools/unitshot.sh /tmp/vex.png vx_goblin,vx_hobgoblin io      (crit=1 tints precision-hit meshes magenta)
#   Generic units take a faction prefix: scrappers:grunt, hollow:captain, legion:heavy.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$chrome" ] || { echo "Google Chrome not found at $chrome" >&2; exit 2; }
out=${1:?output png}; units=${2:?units}; loc=${3:-io}; crit=${4:-0}
n=$(printf '%s' "$units" | awk -F, '{print NF}')
rows=$(( (n * 3 + 5) / 6 ))
h=$(( rows * 305 + 40 ))
port=$((8200 + $$ % 700))
python3 -m http.server "$port" --bind 127.0.0.1 --directory "$root" >/dev/null 2>&1 &
srv=$!
profile=$(mktemp -d)
trap 'kill $srv 2>/dev/null; wait $srv 2>/dev/null || true; rm -rf "$profile"' EXIT
sleep 1
"$chrome" --headless=new --user-data-dir="$profile" --enable-unsafe-swiftshader --use-angle=swiftshader --hide-scrollbars \
  --window-size=1400,"$h" --virtual-time-budget=60000 --screenshot="$out" \
  "http://127.0.0.1:$port/tools/unitshot.html?units=$units&loc=$loc&crit=$crit" >/dev/null 2>&1
echo "$out"
