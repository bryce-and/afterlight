# U21 v4.4 "Exotic Missions": approved scope and build contract

Gate B approved by Bryce on 2026-11-08. References: `docs/reference/exotic-whisper/` (`boss-falls.webp` is the final boss room, its sun-ring is decor only; `red-shaft.webp` is the Red Shaft climb; `green-chasm.webp` is the Green Chasm descent).

## Design rules (Bryce, 2026-11-08)
- One designed, intentional path through the mission. No branching routes except dead ends in jump puzzles.
- One mechanic, introduced in the first encounter and iterated on in every later encounter and the boss.
- Traversal sections between encounters: jump puzzles where the player finds the right path while fighting.
- A puzzle element.
- The final boss is soloable but somewhat difficult.
- Custom assets and areas: exotic missions (and later dungeons and raids) must feel unique, not reuse patrol or campaign maps.

## Rules
- **Timer:** 20:00 (data, `timeLimit`), starts at launch, never adds time. At 0 every player is sent to orbit with no rewards ("Mission failed: out of time").
- **Finish:** killing the final boss freezes the timer. The final chest appears; opening it drops the rewards; then the usual Mission End return-to-orbit timer runs.
- **Respawns restricted:**
  - Solo: dying restarts the current segment: you respawn at its checkpoint, its enemies and mechanic state reset (gate closed, eyes unshot, blights back, boss back to full health and phase 1). No revive count; the timer is the only limit.
  - Fireteam: a dead player never respawns on their own (no pooled lives, no down timer); only a teammate's revive brings them back. If every player is dead (a wipe), everyone respawns at the segment checkpoint and the segment resets as solo.
  - Falling into the void (below `voidY`): solo, same as a death (segment restart). Fireteam: your downed body is placed at your last safe grounded position, revivable there.
  - When the boss dies, downed players get up (`reviveForCompletion`).
- **Enemy Light:** your combat Light + 10 (fireteam: leader's combat Light). Mission rewards roll on each player's own Light.
- **Unlock:** player level 30. Listed in the Activities tab under an "Exotic Missions" heading with best time; locked below level 30 with "Requires level 30".
- **Rewards:** first clear: **Blight Edge** (new exotic, below) for each player whose Guardian has not cleared it. Repeat clears: two legendary drops at your Light. Blight Edge is in no random exotic pool (drops, tier exotic rolls, reward menus, kiosks for unowned exotics). Whisper of the Worm stays a normal random exotic (Bryce, 2026-11-08).
- **Blight Edge:** Void exotic shotgun, special slot, Taken look (black with white flame wisps). Perk Blight Harvest: kills have a 50% chance (100% on precision kills, Bryce 2026-11-08) to leave a blight bomb that pulses 1.2 s then detonates (4 m, Void damage, weakens survivors 4 s); a bomb kill has a 25% chance to chain another bomb, at most 3 links. Bombs never hurt players.
- **Save v13 (additive):** per Guardian `exoticMissions: { whisper: { clears: 0, bestTime: null } }` (bestTime in seconds).

## The Whisper: Attunement
Vex **conduits** (waist-high bronze Vex pillars throwing a pale shaft of light, about 1.2 m radius) give **Attuned** (status registry, about 20 s, refreshed while standing in the light, buff HUD icon). While Attuned:
- **Vex eyes** (teal glowing sockets set in walls, as in `red-shaft.webp`) become visible and shootable; when not Attuned they are dark, untargetable decor.
- **Phase blocks** (translucent teal Vex cubes) become solid; otherwise you fall through them. Other players see them by their own Attuned state (per player).

| # | id | Segment | Kind | Look | Mechanic |
|---|---|---|---|---|---|
| 1 | descent | The Descent | encounter | Dim bronze Vex cavern entrance down from Io's surface, low amber light | One conduit. Shoot 3 eyes to open the gate (any order). Light Taken resistance. |
| 2 | shaft | The Red Shaft | traversal | `red-shaft.webp`: vertical red-lit Vex shaft, wall sockets with teal eyes as decor | Climb over phase blocks (solid only while Attuned) with re-attune conduits on ledges partway up. Dead-end branches and falls. Taken harassment (Taken Vandals or Psions on ledges). Exit trigger at the top. |
| 3 | gallery | Blight Gallery | encounter | Original: black and white Taken-blighted Vex hall | Glyph puzzle: a glyph board shows the order (symbols on the eyes) for 4 of 6 eyes; a wrong eye resets the set and spawns a wave. Taken blight spheres near conduits drain Attuned (no Attuned while inside their aura) until destroyed. Two conduits far apart. Gate opens on success. |
| 4 | chasm | The Green Chasm | traversal | `green-chasm.webp`: narrow mossy teal canyon, light from above | Drop down through narrow ledges; only some ledges lead on (others end over the void). A short phase-block bridge mid-way. Taken ambush points with trigger radii. Exit trigger at the bottom. |
| 5 | falls | The Falls (boss) | boss | `boss-falls.webp`: golden haze, four waterfalls between Vex block cliffs, giant sun-ring hanging above as decor | Boss "Aurix, Hollowed Mind" (Taken Vex Mind) is immune. Its glyph (floating above it) shows an order for 3 eyes (phase 1), 4 (phase 2), 5 (phase 3) among 8 eyes on the arena walls. Correct order opens a damage phase (about 12 s) and the boss loses a third of its health at most per phase. Phase 2: only one of four conduits is lit at a time and it moves every 15 s. Phase 3: blight spheres drain Attuned plus Taken adds. Boss attacks: slow void orbs plus a ground blight pulse. Health and adds scale with fireteam size; timings do not. |

## Build contract (file ownership)
Two builders work at the same time on disjoint files. Neither edits the other's files.

**Builder A (framework):** `js/exotic-missions.js` (new: registry, start, update, timer, checkpoints, segment reset, respawn rules, boss freeze, chest, rewards, co-op sync hooks), `js/mechanics.js` (new: reusable mechanic handlers: conduits and Attuned, eyes, phase blocks, glyph order, blight drain, gates, boss immunity phases), `js/game.js`, `js/player.js`, `js/coop.js`, `js/ui.js`, `js/save.js`, `js/characters.js`, `js/loot.js`, `js/rewards.js`, `js/tower-ui.js`, `js/status.js`, `js/bosses.js`, `js/data.js`, `js/progression.js`, `css/*`, `index.html`, `tools/tests.js`.

**Builder B (level and boss model):** `js/level-whisper.js` (new), `js/world.js` (only to register the set in `LEVEL_SETS` and any small builder hook it needs, nothing else), `js/models-vex.js` or `js/models-taken.js` (only the new boss builder), `js/sky.js` (only a new sky entry if needed).

### Layout contract: `js/level-whisper.js`
Default export: the level set `{ whisper: { ...level data, build(kit) {...} } }` as the other `level-*.js` files, so `buildLevel(WHISPER_LOC, { id: 'whisper', ... })` builds all static geometry (terrain, walls, cliffs, static platforms, waterfalls, sun-ring, sockets decor, lighting, fog). It builds no interactive objects.

Named export `WHISPER_LOC`: a location object shaped like a `LOCATIONS` entry (id `whisper`, name `The Whisper`, colors, fog, light, sunDir, faction `taken` with Vex where useful) so `buildLevel` works without adding it to the Director's `LOCATIONS`.

Named export `WHISPER_LAYOUT` (positions in world units, y is the surface height to stand on unless noted):
```js
{
  spawn: [x, y, z],
  voidY: -40,                    // below this you have fallen
  segments: [
    { id: 'descent', name: 'The Descent', kind: 'encounter',
      checkpoint: [x, y, z], region: { minX, maxX, minZ, maxZ, minY, maxY },
      conduits: [[x, y, z]], eyes: [{ p: [x, y, z], n: [nx, nz] }],   // n: the wall normal the eye faces
      gate: { p: [x, y, z], w, h, axis: 'x' | 'z' },                  // an opening left in the geometry for A's gate
      spawns: [[x, y, z], ...], exit: null },
    { id: 'shaft', name: 'The Red Shaft', kind: 'traversal',
      checkpoint, region, conduits: [...], phaseBlocks: [{ p: [x, y, z], s: [w, h, d] }, ...],
      spawns: [...], exit: { p: [x, y, z], r } },                     // reaching exit completes the segment
    { id: 'gallery', name: 'Blight Gallery', kind: 'encounter',
      checkpoint, region, conduits: [a, b], eyes: [6 entries], glyph: [x, y, z], blights: [[x, y, z], ...], gate, spawns },
    { id: 'chasm', name: 'The Green Chasm', kind: 'traversal',
      checkpoint, region, phaseBlocks: [...], conduits: [...], ambush: [{ p: [x, y, z], r, spawns: [[x, y, z], ...] }], exit },
    { id: 'falls', name: 'The Falls', kind: 'boss',
      checkpoint, region, room: { minX, maxX, minZ, maxZ }, boss: [x, y, z], glyph: [x, y, z],
      conduits: [4 entries], eyes: [8 entries], blights: [...], spawns: [...], chest: [x, y, z] },
  ],
}
```
Every jump in a traversal must be makeable with the base jump (no class double or triple jump required) and must be checked against the player's jump constants in `js/player.js`/`js/physics.js`. Phase blocks are the only way across their gaps. Static platforms and phase blocks together form exactly one route that works, plus dead ends.

### Boss model contract
Builder B adds a model key `takenMind` to the boss model registry (`BOSS_MODELS` in `js/bosses.js` is A's file: B instead exports `buildTakenMind()` from the models file it owns, returning a THREE.Group about 5 m tall with a named child `eye` (the weak point), and A registers it). Look: a Vex Mind frame (bronze, black, red eye) taken over by the Taken: black body, white flame wisps at the head and shoulders, as the U17d Taken.
