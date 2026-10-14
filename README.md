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

- **3 classes, 9 subclasses**: each class starts with two subclasses and unlocks its third at level 10. Every subclass has a super, melee and jump, and on the subclass screen you choose a grenade from its element, a class ability from its class, two aspects and the fragments they open.
- **Guardian levels 1 to 40**: XP from kills (shared by the fireteam), missions and caches. The Level tab is a reward track: a Legendary every 3 levels, Exotics at 20 and 40. Drop rarity climbs with your level.
- **12 weapon types** (every player gets one of each) in primary / special / heavy slots, aim down sights, reloads, recoil, precision damage, elemental shields.
- **Combat HUD**: buffs and exotic effects with timers (general above the abilities, weapon perks below), enemy name and health on aim, damage numbers that drift aside, a gold super bar when charged. Enemies flinch on heavy hits.
- **6 destinations, 18 missions**: the Cosmodrome, the Moon, Mars, Titan, the Tangled Shore and Io, each mission ending in a boss. Horde and Endless activities.
- **Character screen** in the style of Destiny: 3D class model, weapons left, armor right, flyouts to swap gear, item cards, hold F to dismantle.
- **Loot**: engrams drop from enemies, boss caches give rare-or-better gear, five rarities up to Exotic, random perks, Light (up to 200), infusion, dismantling for Glimmer.
- Progress saves to the browser's localStorage (`afterlight_save_v2`). The pre-overhaul save, if any, is kept untouched in `afterlight_backup_v1`.
- The title screen has an **Update Log** (shipped updates) and a **Roadmap** (teasers), both from `js/releases.js`.

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
| `js/loot.js` / `js/save.js` | Item generation, inventory, save file (schema version + migrations) |
| `js/progression.js` | Level curve, XP values, reward track, drop rarity by level, Light cap |
| `js/status.js` | Status-effect registry (player buffs and exotic effects shown on the HUD, enemy debuffs) |
| `js/subclass.js` | Subclass registry: shared grenades and class abilities, aspects, fragments, loadout rules |
| `js/ability-icons.js` | Generated icons for abilities, aspects and fragments |
| `js/combat.js` | Combat tuning and rules: super gain, spread, stagger, chain targets, weapon tier scaling |
| `js/releases.js` | Title-screen Update Log and Roadmap content |
| `js/ui.js` | Menus, inventory, HUD |
| `js/net.js` / `js/coop.js` | Fireteam networking and co-op game sync |

## Tests

With the game running locally, open http://localhost:8123/tools/tests.html. It runs the unit tests (progression, loot, save and migrations, content data, subclass loadouts, status effects, combat rules, Update Log/Roadmap) against an in-memory store, so your real save is untouched. `tools/leveltest.js` smoke-tests a mission map from the browser console (see the comment at its top).

## Releasing

See the release checklist in `docs/OVERHAUL_ROADMAP.md`. Overhaul status and decisions live in `docs/`.
