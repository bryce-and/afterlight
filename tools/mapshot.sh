#!/bin/sh
# Headless screenshot of hand-picked views of one mission, for checking terrain and skies without the browser pane.
# Usage: sh tools/mapshot.sh <location id> <mission index> <out.png> '<views json>' [bright] [fov]
#   views: [["name",[x,y,z],[x,y,z]], ...]  eye then target; y is metres above the ground under that point; up to 6 views (2 per row)
#   e.g.  sh tools/mapshot.sh moon 1 /tmp/m2.png '[["causeway",[0,2,10],[0,4,-70]],["sky",[0,2,18],[0,60,-400]]]'
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$chrome" ] || { echo "Google Chrome not found at $chrome" >&2; exit 2; }
loc=${1:?location id}; mi=${2:?mission index}; out=${3:?output png}; views=${4:?views json}; bright=${5:-0.5}; fov=${6:-75}
port=$((8200 + $$ % 700))
python3 -m http.server "$port" --bind 127.0.0.1 --directory "$root" >/dev/null 2>&1 &
srv=$!
profile=$(mktemp -d)
trap 'kill $srv 2>/dev/null; wait $srv 2>/dev/null || true; rm -rf "$profile"' EXIT
sleep 1
enc=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$views")
"$chrome" --headless=new --user-data-dir="$profile" --enable-unsafe-swiftshader --use-angle=swiftshader --hide-scrollbars \
  --window-size=1400,1220 --virtual-time-budget=60000 --screenshot="$out" \
  "http://127.0.0.1:$port/tools/maptest.html?loc=$loc&mi=$mi&bright=$bright&fov=$fov&views=$enc" >/dev/null 2>&1
echo "$out"
