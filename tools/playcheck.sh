#!/bin/sh
# Headless play-check with a meta loadout (legendary weapons plus an exotic, legendary armor, at the mission's Light; level 30).
# A bot fights through every zone of each mission and reports clear times, kills, deaths, damage taken, stalls and every page error.
# Usage: sh tools/playcheck.sh <location id> [mission indexes, comma separated] [tier: base|legendary|ultimate]
#   LOADOUT=starter sh tools/playcheck.sh earth 0      compare against the starter kit
#   CLASS=stalker SUB=prismatic ROT=2 sh tools/playcheck.sh earth 0   U27: a Prismatic meta loadout (ROT rotates its curated picks); drop SUB to compare a normal subclass
#   MOBILE=1 sh tools/playcheck.sh earth 0             U26: with Mobile mode on (slower strafe, wider hit boxes); compare against a run without it
#   EXOTIC="Coldheart" sh tools/playcheck.sh moon 1    force a named exotic weapon
#   sh tools/playcheck.sh endless_rogue 12             the same for Roguelike Endless
#   sh tools/playcheck.sh horde_rogue 12                     U24 Roguelike Horde: a bot plays 12 waves (boon picks, sealed room, fair spawns)
# Exit code 1 when a run errors or a zone does not clear. TIME CAP lines are a warning: the bot was too slow, the zone was finished raw.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$chrome" ] || { echo "Google Chrome not found at $chrome" >&2; exit 2; }
loc=${1:?location id (earth, moon, mars, titan, tangled, io, dc, leviathan)}
mi=${2:-0}
tier=${3:-base}
loadout=${LOADOUT:-meta}
mobile=${MOBILE:-0}
cls=${CLASS:-vanguard}
sub=${SUB:-}
rot=${ROT:-0}
exotic=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "${EXOTIC:-}")
port=$((8200 + $$ % 700))
python3 -m http.server "$port" --bind 127.0.0.1 --directory "$root" >/dev/null 2>&1 &
srv=$!
profile=$(mktemp -d)
trap 'kill $srv 2>/dev/null; wait $srv 2>/dev/null || true; rm -rf "$profile"' EXIT
sleep 1
dom=$("$chrome" --headless=new --user-data-dir="$profile" --enable-unsafe-swiftshader --use-angle=swiftshader \
  --virtual-time-budget=600000 --dump-dom "http://127.0.0.1:$port/tools/playcheck.html?loc=$loc&mi=$mi&tier=$tier&loadout=$loadout&exotic=$exotic&mobile=$mobile&cls=$cls&sub=$sub&rot=$rot" 2>/dev/null)
res=$(printf '%s' "$dom" | python3 -c "import sys,re,html; m=re.search(r'<pre id=\"result\">(.*?)</pre>', sys.stdin.read(), re.S); print(html.unescape(m.group(1)) if m else 'no result (page did not finish)')")
echo "$res"
case "$res" in *ERROR*|*"no result"*|running) exit 1 ;; esac
case "$res" in *PROBLEM*) exit 1 ;; esac
case "$loc" in horde_rogue|endless_rogue) exit 0 ;; esac
printf '%s\n' "$res" | grep -E '^  .*: ' | grep -vq ': cleared' && exit 1
exit 0
