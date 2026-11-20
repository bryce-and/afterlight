# U32 "Dropships" (v5.7): Gate B proposal

Status: waiting on Bryce's approval. Number and name are provisional (U31 v5.6 is the latest release in the roadmap).

## Objective
Enemies stop appearing out of thin air. Each reinforcement group arrives by a faction-styled ship that flies in from off-screen, hovers over the spawn point, drops its units to the ground, then flies away.

## How it works today (scout findings)
- All zone enemies go through `spawnUnit` (`js/game.js:301`); `spawnWave` (`:317`) picks spots with `findSpawn` (`:281`). Dungeons and patrol use wrappers (`dungeon.js:208/215`, `exotic-missions.js:178`, `patrol.js:134/487`).
- The only entrance effect is a ring/sparks burst and a 0.45 s scale-in (`spawnT`, `js/enemies.js:262, 324`). While `spawnT < 1` the enemy does not act.
- No ship or vehicle code exists. Co-op: the host broadcasts `sp` per enemy (`js/coop.js:261`), clients build proxies.

## Scope
1. New module `js/dropships.js`: a `Dropship` entity (model, flight path, drop timing) plus a faction ship builder (Cabal, Fallen, Hive, Vex, Scorn, Taken variants; low-poly, reuses `enemyColors`).
2. Flight sequence: approach from a point 80 to 120 m out at altitude, decelerate, hover ~9 m up (about 1.5 s), release units (small stagger, each falls or rappels to the ground), thrusters flare, ship climbs and leaves, then is removed.
3. Spawn integration: `spawnWave` groups enemies that would spawn together into one drop. Units are created at the ship's hatch in a "dropping" state: not targetable, no AI, no damage dealt or taken until they land (a new gate beside `spawnT`, `enemies.js:324`, plus `enemy-skills.js:60`). On landing they trigger the existing ring/sparks and go live.
4. Ship does not shoot and is not a target in this update (see exclusions).
5. Co-op: host runs the logic; one new message `ds` (ship id, drop point, approach heading, unit netIds, start time). Clients render the ship and proxies animate the fall. Enemy `sp` messages stay as they are, with a `dr` flag so clients keep them inert until landing.
6. Settings: "Dropship entrances" on/off toggle for low-end machines (default on).

## Exclusions
- Interiors, dungeons and small rooms: they keep the current instant spawn (halls are 5.6 to 8 m high, ships don't fit). Decided per location by an open-sky check (clear ceiling above the drop point, a `spawnClear`-style test).
- Bosses, Tower dummies, Crucible/PvP, suicide-unit spawns, and shank packs behind the player's back keep current behavior.
- No shootable ships, no ship-based missions, no new enemy types, no balance changes, no save change.

## Dependencies and risks
- Spawn timing change: units become active ~2 to 3 s later than today. Waves counted by `waveStep` / `aliveIn(zone)` gates (`dungeon.js:417`) must not read a dropping enemy as "alive and fighting" or as "dead". Mitigation: dropping units count as alive but are untargetable.
- Co-op desync: clients must not see enemies shooting before landing. Mitigation: `dr` flag plus a host-side landing time.
- Auto-aim, radar and enemy plates must skip dropping units (about 160 `alive` checks; I will add one helper rather than edit each).
- Performance: one ship at a time per drop, capped at 3 simultaneous ships; low-poly, no per-frame allocation.
- Horde/Endless pacing: heavy waves with many ships could look crowded; merge nearby spawns into one ship.
- Unverified: whether `js/sparrow.js` has reusable flight code; whether any destination has low sky (to be checked in build).

## Test plan
- Unit tests in `tools/tests.js`: drop planner (grouping, open-sky check, stagger), dropping-state gating (not targetable, no damage, counts as alive), landing sets state live, timing is deterministic from a seed.
- `sh tools/run_tests.sh` and `sh tools/playcheck.sh` on at least one outdoor mission per faction; compare clear times against a pre-change run (expect +2 to 3 s per wave, no bot deaths from untargetable gaps).
- Preview browser: screenshots of each faction ship at the hover moment, plus the toggle.
- Co-op: two `?localtest` tabs see the same ship and landing (I'll ask before running).

## Acceptance criteria
- On outdoor zones, no enemy appears without a ship; ship arrives from out of view, drops units, departs, and is gone.
- Enemies cannot be hurt or act before landing; no wave stalls or ends early.
- Interiors and bosses behave exactly as before; toggle off restores the old spawn.
- All tests pass, playcheck has no console errors, co-op clients match the host.

## Approved (2026-11-20) with Bryce's answers
Approved as proposed. Units drop to the ground (no beam-down). The ship's departure is visible. Applies to missions, Horde/Endless and patrol events, outdoors only. Indoors is a separate future update.

## Open questions (answered above)
1. Rappel/fall style: units drop and land with a short thud, or a slow beam-down? (I recommend drop.)
2. Should the ship's departure be visible to the player (yes, recommended), or just fade out of sight?
3. Do you want it for patrol/open-world events too, or missions and Horde/Endless only? (Recommend both outdoors.)
