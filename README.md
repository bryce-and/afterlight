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
- **Character screen** in the style of Destiny: 3D class model, weapons left, armor right, flyouts to swap gear, item cards, hold F to dismantle.
- **Loot**: engrams drop from enemies, boss caches give rare-or-better gear, five rarities up to Exotic, random perks, power level, infusion, dismantling for Glimmer.
- Progress saves to the browser's localStorage.

## Co-op (fireteams of up to 3)

On the Director screen, **Create Fireteam** to get a 6-character code, or type a friend's code and **Join**. The leader picks the mission and launches everyone.

- Free: players connect directly over WebRTC (PeerJS's public matchmaking server), and the game itself is hosted on GitHub Pages. No game server.
- The leader's browser runs enemies and the mission; members send their hits to the leader.
- Each player gets their own loot: every kill rolls separate drops for each player, and everyone opens their own boss cache.
- Each extra player adds about 50% more enemies; bosses get more health and call more adds.
- No friendly fire. No mission failure in co-op: you respawn after 6 seconds.
- Some strict school, work, or mobile networks block direct connections; there's no relay server to fall back on.
- `?localtest` in the URL connects tabs of the same browser locally, for testing co-op on one computer.
- Co-op doesn't work inside the Claude artifact viewer, which blocks WebRTC. Use the GitHub Pages link.

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
| `js/net.js` / `js/coop.js` | Fireteam networking and co-op game sync |
