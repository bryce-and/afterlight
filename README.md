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

- **v4.5 "Darkness" (U22)**: Stasis and Strand subclasses for all three classes, six in all (unlocking at level 28), each with a second, original super of the opposite type, plus Darkness grenades, enemy freezes and shatters, and Darkness enemies.
- **v4.4 "Exotic Missions" (U21)**: The Whisper, the first exotic mission, five segments deep under Io. A 20-minute timer that never adds time, a boss called Aurix (a Hollowed Mind), puzzles and jump sections between encounters, and restricted respawns. Unlocks at level 30 for every fireteam member and is listed in Activities. Its exclusive exotic shotgun, Blight Edge, is guaranteed on the first clear; repeat clears give two legendaries.
- **v4.3 "Legend and Ultimate II" (U20b)**: unlock animations and reward menus. A Legendary clear lets you keep one of three exotic armor and one of three exotic weapons; an Ultimate clear lets you keep two of five of each. Unclaimed menus wait for you in Orbit. The Legendary campaign's final boss, the Leviathan, drops an exotic on every clear, and Ultimate gives an exotic on each mission's first clear. Skip Campaign (hold to confirm) raises a Guardian to the level of a full base clear and gives a set of Light 200 legendary gear, with no mission drops. Ultimate enemies sit at your Light or the mission's Light, whichever is higher, plus 50. Legendary and Ultimate enemies come in greater numbers (1.25x and 1.5x). I opens the full Character screen anywhere. Each slot holds 9 items besides the equipped one, and extras go to the Postmaster (up to 50).
- **v4.2 "Legend and Ultimate" (U20a)**: campaign tiers. Base, Legendary and Ultimate are picked per Guardian from the Director. Legendary enemies sit at your Light +25 and Ultimate at +50, with no revives in Ultimate (in a fireteam any death ends the run). Legendary missions run at Light 200 to 300 and Ultimate at 300 to 350. Legendary unlocks on a base clear, Ultimate on a Legendary clear, and an Ultimate clear unlocks both for every Guardian. Equipped armor can be infused in place (Shift+Click the equipped slot).
- **v3.9 "Open Frontier" (wave 6)**: The Dreaming City becomes a patrol zone, the last of the seven. You land on the Strand under a colossal Awoken arch-spire, and paths and bridges reach the Divalian Mists, the court of the Blind Well, the Gardens of Esila, the towers and palace of Rheasilvia, a purple crystal cavern and Aphelion's Rest. Taken and Scorn hold it, with six beacons and two public events, The Blind Well (new, a light ring you hold shut) and Ether Resupply. Petra Venj is met on the Strand with the quest The Torn Veil. Patrol enemies notice you within 60 m or when you hurt them, and walk back to camp when they lose you.
- **v3.8 "Open Frontier" (wave 5)**: The Tangled Shore becomes a patrol zone. Thieves' Landing is a safe cavern under a rock ceiling, with the Spider's lair and throne room, the chained rocks of the Rift, Four-Holed Cove, a crashed Hive ship with a walkable hold, and the Scorn flats and Trapper's Cave. Fallen, Scorn and Hive, six beacons, and two new public events, Ether Resupply and Hive Awakening, both with a heroic mechanic. Petra Venj is met in the patrol zone, with the quest The Queen's Wrath. The abyss between the rocks is a fall: step off and you die.
- **v3.7 "Open Frontier" (wave 4)**: Io becomes a patrol zone. Green canyons and valleys, a Red Legion base with walkable interiors, the Taken blight at Terrabase Charon, and the Pyramidion, an enterable colossal Vex block with a large interior hall and a red-glowing pit. Vex, Taken and Red Legion camps. Seven beacons and two new public events, Vex Incursion and Taken Blight, both with a heroic mechanic. Asher Mir is met in the patrol zone, with the quest The Last Touch.
- **v3.6 "Vex and Taken" (U17d)**: New Vex models from Bryce's references, bronze and black with a red eye, and new Taken models with black flames off the head and shoulders. A shared sniper skill with an aim line for the Vex Hobgoblin, Taken Vandal and new Taken Hobgoblin. Supplicant and Taken Incendior are retired. Each faction keeps one look on every destination, and the Tangled Shore is Scorn.
- **v3.5 "Open Frontier" (wave 3)**: Titan becomes a patrol zone. Oil-rig stations stand on red stilt legs above the methane sea, joined by pipe bridges the Sparrow can ride. The biosphere arcology under its glass dome is overgrown, and the Hive have nested in the Solarium and one tower wing. Sloane waits at her command post, and the Sunken Gallery runs down under the sea. New public events: Rig Breach and Brood Hatch.
- **v3.4 "Open Frontier" (wave 2)**: the Moon and Mars become patrol zones. The Moon has Fallen in the ruined colony and the Hive in its caves and catacombs; Mars has a buried city to fight through, subway tunnels, and a Cabal fortress on a mesa. Roads run from each landing to every area, and the Sparrow has tracks to ride. New NPCs: Eris Morn on the Moon and Ana Bray on Mars.
- **v3.3 "Open Frontier"**: the Cosmodrome opens up as a patrol zone with no timer and no end. Beacons pay engrams and XP (Bounties and Clear missions), public events turn Heroic when you kill the marked targets in time, camps wake as you near them, Tab pulls out your Ghost, and holding E summons a Sparrow. Patrol is on Earth for now; the Sparrow is off in campaign missions.
- **v3.2 "High Ground II"**: the same terrain and sky treatment for Io, Titan, the Tangled Shore and the Leviathan, with every mission rebuilt around climbs, descents and a real up and down.
- **v3.1 "High Ground"**: terrain height, so the ground rises and falls under enemies, projectiles, pickups and the player (ramps, plateaus, mounds and basins); a data-driven sky for each destination and mission; and rebuilt levels on the Moon, the Dreaming City, Earth and Mars with climbs and high ground.
- **v3.0 "Deep Halls"**: the Tower rebuilt from the Destiny 1 map (Watch, vaulted Hall of Guardians with the sunken war table, Tower North with the Speaker's orrery, a Hangar with a workshop and faction bays), symbols above the Tower's people instead of text labels, flickering textures fixed, a white and gold Leviathan, boss rooms that lock behind you, and levels in the Moon's Hive caverns.
- **v2.9 "The Vex"**: a new faction, the Vex, with Goblins, Harpies, Minotaurs, Hydras, Cyclops and more, filling the Pyramidion on Io; Destiny 2 units added to the older factions; and rebuilt Taken Phalanx and Scorn Lurker guards.
- **v2.7 "The Last City"**: the Tower, a walkable hub reached from Orbit, with the Vanguard debriefing you between acts; a Quests tab that tracks the campaign for each Guardian; a Postmaster that takes overflow gear; an Exotic Kiosk; and a shooting range.
- **v2.6 "The Ghost's Story"**: a campaign of 22 missions across 8 destinations, narrated by your Ghost with a subtitle bar; objectives in missions (hold, activate, retrieve, destroy, survive); the Dreaming City, and a Leviathan finale where Calus is revealed as a robot copy; closed boss rooms, interiors, stairs and platforms; unlimited lights; new bosses Morgeth, Veshra and a Taken champion; two new armor sets; campaign progress per Guardian; middle-click item lock.
- **v2.5 "New Factions"**: the Taken and the Scorn are full factions with their own units, models and abilities; they break into missions on Io and the Tangled Shore, and the Glaive fires a bolt you can watch fly.
- **v2.4 "Hostile Intent II"**: every enemy comes as a minor (red bar) or major (orange bar) variant, majors with more health; factions fight differently; some enemies wear elemental shields that a burst of the matching element breaks, and some throw grenades; bosses alternate pushing and holding; the ammo meter replaces random ammo drops; harder with three Guardians.
- **v2.2 "Resonance"**: rebuilt sound. Weapons, abilities and enemies have their own layered sounds, placed in the world with stereo and distance; music moves between explore, tense, combat and boss; the pause menu has an Effects slider.
- **v2.1 "Arsenal II"**: Swords, Sidearms, Glaives, Trace Rifles and special-ammo Grenade Launchers, 14 more Destiny 2 exotics, heavier hits with leaner heavy ammo.
- **v2.0 "Decrypted"**: every weapon is named, perks come in Destiny 2 columns, rarity is gated by your level, and the right-click inspect screen and Exotic Collection are new.
- **v1.9 "Eyes Up, Guardian"**: burst supers hover while they cast, the Sentinel barrier blocks enemy shots for your whole team, Hellion lobs burning bolts, Void VFX are reworked, a D2-style Modify screen, and Fonts for every stat.
- **3 Guardians, 15 subclasses**: play a Titan, a Hunter and a Warlock on one account. Each has its own gear, inventory and Light; your level, glimmer, shaders and vault are shared, and gear moves between Guardians through the vault.
- **Subclasses**: each class starts with two subclasses, unlocks its third at level 10 and its Stasis and Strand subclasses at level 28. Every subclass has a melee, and on the subclass screen you choose its super (33 in all, new ones unlocked on the reward track), a class jump (Blink for Arcstriders and Voidwalkers), a grenade from its element, a class ability from its class (Sunsingers also get Phoenix Dive), two of its aspects (five per subclass, four for Sentinel) and the fragments they open (eight per element).
- **Guardian levels 1 to 40**: XP from kills (shared by the fireteam), missions and caches. The Level tab is a reward track: a Legendary every 3 levels, Exotics at 20 and 40. Drop rarity climbs with your level.
- **12 weapon types** (every player gets one of each) in primary / special / heavy slots, each with Destiny's archetypes (Adaptive, Rapid-Fire, High-Impact, Precision...) that fix its stats. Named legendaries always have the same archetype and element. Kinetic, Solar, Arc, Void, Stasis and Strand weapons; aim down sights, reloads, recoil, precision damage, elemental shields.
- **Combat HUD**: buffs and exotic effects with timers (general above the abilities, weapon perks below), enemy name and health on aim, damage numbers that drift aside, a gold super bar when charged. Enemies flinch on heavy hits.
- **8 destinations, 22 missions**: Earth (the Cosmodrome), the Moon, Mars, Io, Titan, the Tangled Shore, the Dreaming City and the Leviathan, each mission ending in a boss. Horde and Endless activities.
- **Character screen** in the style of Destiny: 3D class model wearing your armor, weapons left, armor right, flyouts to swap gear, item cards, hold F to dismantle. Stats and mods live on the Mods screen.
- **Armor and style**: armor shows on your Guardian. Six destination armor sets with 3-piece bonuses, eight exotics per class (drops favor the ones you haven't found yet), and 10 shaders from mission caches that recolor all of your armor.
- **Loot**: engrams drop from enemies, boss caches give rare-or-better gear, five rarities up to Exotic, random perks, Light (up to 350), infusion, dismantling for Glimmer.
- Progress saves to the browser's localStorage (`afterlight_save_v2`). The pre-overhaul save, if any, is kept untouched in `afterlight_backup_v1`.
- The title screen has an **Update Log** (shipped updates) and a **Roadmap** (teasers), both from `js/releases.js`.

## Co-op (fireteams of up to 3)

On the Director screen, **Create Fireteam** to get a 6-character code, or type a friend's code and **Join**. The leader picks the mission, everyone presses **Ready Up**, and it launches when the last Guardian is ready.

- Free: players connect directly over WebRTC (PeerJS's public matchmaking server), and the game itself is hosted on GitHub Pages. No game server.
- The leader's browser runs enemies and the mission; members send their hits to the leader.
- Each player gets their own loot: every kill rolls separate drops for each player, and everyone opens their own boss cache.
- Each extra player adds about 50% more enemies; bosses get more health and call more adds.
- No friendly fire. A downed player can be revived by a teammate (hold E) or spends a pooled life (3 lives for two players, 5 for three). If everyone is down with no lives left before the activity is complete, it fails. When the boss falls or the final cache appears, everyone downed gets back up.
- Some strict school, work, or mobile networks block direct connections; there's no relay server to fall back on.
- `?localtest` in the URL connects tabs of the same browser locally, for testing co-op on one computer.
- Co-op doesn't work inside the Claude artifact viewer, which blocks WebRTC. Use the GitHub Pages link.

## Controls

WASD move, Shift sprint (Icarus Dash in the air), Space jump (press or hold in air for class jump), mouse aim, LMB fire, RMB aim down sights, R reload, 1/2/3 or wheel switch weapon, Q grenade, B melee, V charged melee ability, C class ability, F super, E interact, Esc pause.

## Code map

| File | What it does |
|---|---|
| `js/main.js` | Renderer, input, main loop |
| `js/game.js` | Missions, waves, combat, projectiles, pickups, loot cache |
| `js/player.js` | Movement, weapons, abilities, supers |
| `js/enemies.js` | Enemy models, AI, boss mechanics, enemy projectiles |
| `js/models-fallen.js`, `js/models-hive.js`, `js/models-cabal.js`, `js/models-scorn.js` | Enemy models for the Fallen, Hive, Cabal and Scorn, built from Bryce's reference images (v4.0). With the Vex and Taken (v3.6), every faction now has reference-based models |
| `js/colliders.js`, `js/physics.js` | Collider math (including yawed boxes) and line of sight |
| `js/nav.js`, `js/ai.js`, `js/navdebug.js` | Enemy navigation grid and A*, leash, cover and melee rules, nav debug overlay |
| `js/world.js` | Procedural level generation and the orbit planet |
| `js/terrain.js` | Terrain height per map (plateau, ramp, mound, basin) and `groundAt`, used by physics, nav, enemies, projectiles and spawns |
| `js/sky.js` | Data-driven skies per destination, with per-mission overrides |
| `js/patrol.js` | Patrol zones: beacons, public events, ambient camps, NPC meetings, fireteam snapshot |
| `js/patrol-data.js` | Patrol tuning and data per map (pure data, testable without THREE) |
| `js/patrol-earth.js` | The Earth (Cosmodrome) patrol map |
| `js/patrol-kit.js` | Shared patrol helpers (roads, torches, fire pits, lanterns, halls) |
| `js/patrol-moon.js` | The Moon patrol map |
| `js/patrol-mars.js` | The Mars patrol map |
| `js/patrol-titan.js` | The Titan patrol map |
| `js/patrol-io.js` | The Io patrol map |
| `js/patrol-tangled.js` | The Tangled Shore patrol map |
| `js/patrol-dreaming.js` | The Dreaming City patrol map |
| `js/sparrow.js` | Ghost view, Sparrow controller and models |
| `js/data.js` | All tuning: classes, weapons, perks, enemies, locations |
| `js/loot.js` / `js/save.js` | Item generation, inventory, save file (schema version + migrations) |
| `js/armor.js` | Armor 2.0: six stats and tiers, mods (57), energy, sockets, orbs of power and armor charge tuning, v4 to v5 stat migration |
| `js/mods-ui.js` | The Mods screen (stats and mods) that slides in from the character screen |
| `js/style.js` | Armor looks, destination sets and set bonuses, shaders, appearance (what fireteams see) |
| `js/characters.js` | Guardian models built from the worn armor's looks and shader |
| `js/frames.js` | Weapon archetypes (Destiny frames), named legendaries, archetype-fixed stats and handling |
| `js/progression.js` | Level curve, XP values, reward track, drop rarity by level, Light cap |
| `js/status.js` | Status-effect registry (player buffs and exotic effects shown on the HUD, enemy debuffs) |
| `js/subclass.js` | Subclass registry: shared grenades and class abilities, supers, class jumps, aspects, fragments, loadout rules |
| `js/ability-icons.js` | Generated icons for abilities, aspects and fragments |
| `js/combat.js` | Combat tuning and rules: super gain, spread, stagger, chain targets, weapon tier scaling |
| `js/releases.js` | Title-screen Update Log and Roadmap content |
| `js/ui.js` | Menus, inventory, HUD |
| `js/net.js` / `js/coop.js` | Fireteam networking and co-op game sync |

## Tests

With the game running locally, open http://localhost:8123/tools/tests.html. It runs the unit tests (progression, loot and weapon archetypes, armor stats and mods, sets and shaders, characters, save and migrations, content data, subclass loadouts, status effects, combat rules, Update Log/Roadmap) against an in-memory store, so your real save is untouched. `tools/leveltest.js` smoke-tests a mission map from the browser console (see the comment at its top), and `tools/navtest.js` does the same for enemy navigation and the new attacks. `sh tools/unitshot.sh <out.png> <units>` renders a headless line-up of enemy models (front, three-quarters, side).

## Releasing

See the release checklist in `docs/OVERHAUL_ROADMAP.md`. Overhaul status and decisions live in `docs/`.
