# Afterlight

A low-poly, Destiny-inspired looter shooter that runs in the browser. Three.js, no build step.

## Play locally

```bash
python3 -m http.server 8123
```

Then open http://localhost:8123. ES modules need a web server, so opening `index.html` directly from disk will not work.

## Deploy to GitHub Pages

Push this folder to a repo, then in the repo go to **Settings > Pages**, set the source to the `main` branch, root folder. The game will be live at `https://<you>.github.io/<repo>/`.

## What's in it

- **3 classes**: Titan (Sunbreaker), Hunter (Gunslinger), Warlock (Voidwalker). Each has a grenade, melee, class ability, super, and jump.
- **12 weapon types** (every player gets one of each) in primary / special / heavy slots, aim down sights, reloads, recoil, precision damage, elemental shields.
- **3 destinations, 9 missions**: the Cosmodrome (Fallen), the Moon (Hive), and Mars (Cabal) and a boss at the end.
- **Loot**: engrams drop from enemies, boss caches give rare-or-better gear, five rarities up to Exotic, random perks, power level, infusion, dismantling for Glimmer.
- Progress saves to the browser's localStorage.

## Controls

WASD move, Shift sprint, Space jump (press or hold in air for class jump), mouse aim, LMB fire, RMB aim down sights, R reload, 1/2/3 or wheel switch weapon, Q grenade, V melee, F charged melee ability, C class ability, X super, E interact, Esc pause.

## Code map

| File | What it does |
|---|---|
| `js/main.js` | Renderer, input, main loop |
| `js/game.js` | Missions, waves, combat, projectiles, pickups, loot cache |
| `js/player.js` | Movement, weapons, abilities, supers |
| `js/enemies.js` | Enemy models, AI, boss mechanics, enemy projectiles |
| `js/world.js` | Procedural level generation and the orbit planet |
| `js/data.js` | All tuning: classes, weapons, perks, enemies, locations |
| `js/loot.js` / `js/save.js` | Item generation, inventory, save file |
| `js/ui.js` | Menus, inventory, HUD |
