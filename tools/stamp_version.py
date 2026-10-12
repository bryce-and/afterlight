"""Cache-busting for the no-build setup.

Rewrites the import map in index.html so every game module URL carries a
version tag (./js/game.js -> ./js/game.js?v=TAG). Relative imports between
modules resolve through the map, so a new tag means the browser fetches a
consistent set of new files instead of mixing cached and fresh modules.

Usage: python3 tools/stamp_version.py [TAG]   (default: current time)
"""
import json, os, re, sys, time

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tag = sys.argv[1] if len(sys.argv) > 1 else time.strftime('%Y%m%d%H%M%S')
mods = sorted(f for f in os.listdir(os.path.join(root, 'js')) if f.endswith('.js'))
imports = {'three': 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'}
for f in mods:
    imports[f'./js/{f}'] = f'./js/{f}?v={tag}'
block = '<script type="importmap">\n' + json.dumps({'imports': imports}, indent=1) + '\n</script>'

path = os.path.join(root, 'index.html')
html = open(path).read()
html, n = re.subn(r'<script type="importmap">.*?</script>', lambda m: block, html, flags=re.S)
if n != 1:
    sys.exit('index.html: expected exactly one import map')
html = re.sub(r'<script type="module"[^>]*>.*?</script>', '<script type="module">import \'./js/main.js\';</script>', html, flags=re.S)
open(path, 'w').write(html)
print(f'stamped {len(mods)} modules with v={tag}')
