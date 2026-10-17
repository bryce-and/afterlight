#!/bin/sh
# Release in two commands (docs/OVERHAUL_ROADMAP.md, release checklist).
#
#   sh tools/release.sh prep VERSION   Update Log entry check, headless tests, version stamp.
#                                      Then review the diff and make the code and docs commits.
#   sh tools/release.sh ship VERSION   Clean tree required. Fast-forwards main to the update
#                                      branch, pushes, tags vVERSION, creates the GitHub release
#                                      from the Update Log entry, waits for GitHub Pages to serve it.
#
# Still manual: the co-op check (two ?localtest tabs), the play-check, the save check and the
# title screen check, all in the preview browser.
set -eu
cd "$(dirname "$0")/.."
cmd=${1:-}; ver=${2:-}
[ -n "$cmd" ] && [ -n "$ver" ] || { sed -n 2,11p "$0"; exit 2; }

top=$(python3 tools/release_notes.py --top)
[ "$top" = "$ver" ] || { echo "js/releases.js: newest Update Log entry is $top, not $ver" >&2; exit 1; }

case "$cmd" in
prep)
  sh tools/run_tests.sh
  python3 tools/stamp_version.py
  git status --short
  ;;
ship)
  [ -z "$(git status --porcelain)" ] || { echo "Working tree not clean; commit first." >&2; exit 1; }
  git rev-parse -q --verify "refs/tags/v$ver" >/dev/null && { echo "Tag v$ver already exists." >&2; exit 1; }
  branch=$(git branch --show-current)
  if [ "$branch" != main ]; then
    git checkout main
    git merge --ff-only "$branch"
  fi
  git push origin main
  git tag "v$ver"
  git push origin "v$ver"
  notes=$(mktemp)
  python3 tools/release_notes.py "$ver" | tail -n +2 > "$notes"
  gh release create "v$ver" --title "$(python3 tools/release_notes.py "$ver" | head -1)" --notes-file "$notes"
  rm -f "$notes"

  stamp=$(sed -n 's/.*style\.css?v=\([0-9]*\).*/\1/p' index.html)
  url=$(gh api "repos/{owner}/{repo}/pages" --jq .html_url)
  echo "Waiting for $url to serve stamp $stamp ..."
  i=0
  while [ $i -lt 40 ]; do
    if curl -fsS "$url?nocache=$(date +%s)" | grep -q "v=$stamp"; then
      echo "Pages live: $url serves v=$stamp"
      exit 0
    fi
    i=$((i + 1)); sleep 15
  done
  echo "Pages did not show v=$stamp within 10 minutes. Check: gh run list --limit 3" >&2
  exit 1
  ;;
*) sed -n 2,11p "$0"; exit 2 ;;
esac
