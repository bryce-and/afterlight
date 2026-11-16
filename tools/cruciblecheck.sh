#!/bin/sh
# Headless Crucible check: an AI vs AI match to its end plus the networked-PvP damage rules, in headless Chrome.
# Usage: sh tools/cruciblecheck.sh [control|duel]      Exit code 1 on any ERROR line or a match that does not finish.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$chrome" ] || { echo "Google Chrome not found at $chrome" >&2; exit 2; }
mode=${1:-control}
port=$((8200 + $$ % 700))
python3 -m http.server "$port" --bind 127.0.0.1 --directory "$root" >/dev/null 2>&1 &
srv=$!
profile=$(mktemp -d)
trap 'kill $srv 2>/dev/null; wait $srv 2>/dev/null || true; rm -rf "$profile"' EXIT
sleep 1
dom=$("$chrome" --headless=new --user-data-dir="$profile" --enable-unsafe-swiftshader --use-angle=swiftshader \
  --virtual-time-budget=600000 --dump-dom "http://127.0.0.1:$port/tools/cruciblecheck.html?mode=$mode" 2>/dev/null)
res=$(printf '%s' "$dom" | python3 -c "import sys,re,html; m=re.search(r'<pre id=\"result\">(.*?)</pre>', sys.stdin.read(), re.S); print(html.unescape(m.group(1)) if m else 'no result (page did not finish)')")
echo "$res"
case "$res" in *ERROR*|*"no result"*|running|*"DID NOT"*) exit 1 ;; esac
exit 0
