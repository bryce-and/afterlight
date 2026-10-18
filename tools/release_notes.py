"""Prints the GitHub release title and body for one Update Log entry in js/releases.js.

Usage: python3 tools/release_notes.py VERSION        -> title on line 1, body after
       python3 tools/release_notes.py --top          -> version of the newest entry
"""
import os, re, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(root, 'js', 'releases.js')).read()
src = src[src.index('export const RELEASES'):src.index('export const titleRelease')]
STR = r"'((?:[^'\\]|\\.)*)'"
unq = lambda s: re.sub(r'\\(.)', r'\1', s)
entries = re.split(r'\n  \{\n', src)[1:]

def field(block, key):
    m = re.search(key + r':\s*' + STR, block)
    if not m:
        sys.exit(f'releases.js: entry has no {key}')
    return unq(m.group(1))

if sys.argv[1:] == ['--top']:
    print(field(entries[0], 'version'))
    sys.exit()
if len(sys.argv) != 2:
    sys.exit(__doc__)
for block in entries:
    if field(block, 'version') == sys.argv[1]:
        notes = block[block.index('notes:'):]
        notes = notes[:notes.index('\n    ],')]  # the notes array only, not the art that follows it
        print(f"v{sys.argv[1]} {field(block, 'name')}")
        print(field(block, 'summary') + '\n')
        for n in re.findall(STR, notes):
            print('- ' + unq(n))
        break
else:
    sys.exit(f'releases.js: no Update Log entry for {sys.argv[1]}')
