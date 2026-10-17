#!/bin/sh
# Runs tools/tests.html in headless Chrome and prints the summary plus any FAIL rows.
# Exit code 0 only when every test passes. Cheaper than opening the preview browser.
# Usage: sh tools/run_tests.sh
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$chrome" ] || { echo "Google Chrome not found at $chrome" >&2; exit 2; }

port=8199
python3 -m http.server "$port" --bind 127.0.0.1 --directory "$root" >/dev/null 2>&1 &
srv=$!
profile=$(mktemp -d)
trap 'kill $srv 2>/dev/null; wait $srv 2>/dev/null || true; rm -rf "$profile"' EXIT
sleep 1

dom=$("$chrome" --headless=new --disable-gpu --user-data-dir="$profile" \
  --virtual-time-budget=60000 --dump-dom "http://127.0.0.1:$port/tools/tests.html" 2>/dev/null)

summary=$(printf '%s' "$dom" | sed -n 's/.*<div id="summary"[^>]*>\([^<]*\)<.*/\1/p')
[ -n "$summary" ] || { echo "Could not read the test summary (page did not finish?)" >&2; exit 2; }
echo "$summary"
printf '%s' "$dom" | grep -o 'FAIL  [^<]*' || true
case "$summary" in *" 0 failed") exit 0 ;; *) exit 1 ;; esac
