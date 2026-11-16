# U16e "High Ground" (v3.1): approved Gate B proposal

Approved by Bryce on 2026-10-21, to be built in a separate chat. Released as v3.1 (engine, skyboxes, waves 1 and 2) and v3.2 (waves 3 and 4). A major update: new name, title-screen artwork, Update Log and Roadmap entries.

## Objective
Make the maps feel like Destiny places. Ground rises and falls, every mission has its own sky, and the flattest or most repetitive missions are rebuilt with climbs, descents and interiors. The reference images in `docs/reference/` are for **vibe, not copying**: capture the essence of each destination (its colours, silhouettes, scale, mood and how it plays), then build an original low-poly version.

## Design rule from Bryce
Not every zone needs verticality or an interior. Apply them where they fit and leave other zones open. Most missions should have an up/down in elevation. Destiny separates areas as: **area + combat, traversal, combat during traversal, new area.** Each mission should follow that rhythm.

## Scope
1. **Terrain engine.**
   - A per-map `groundAt(x, z)` height function built from ramps, plateaus, mounds and basins (a small feature API in the level files).
   - Player and enemy physics (`js/colliders.js` has a hard `pos.y <= 0` floor today), the nav grid (`js/nav.js` already has a height grid from colliders), spawns (`findSpawn` in `js/game.js`), pickups, projectile impacts, falling and the visual ground (`buildGround` in `js/world.js` already takes a `heightAt`, currently decoration) all read from it.
   - Props and colliders sit on the terrain automatically. Walkable slope capped at about 30 degrees. Heavy units still use nav-grid ramps and steps, so main-route stairs stay 5 m wide.
   - The height comes from map data, so co-op needs no new sync. Maps with no terrain data stay flat, so nothing existing breaks. About 110 places across about 25 files assume y = 0; `grep "y = 0"` finds them.
2. **Skyboxes.** A data-driven sky per destination with a per-mission override: gradient dome, stars, the sky body and distant silhouette layers (the Tower's `loc.vista` is the precedent; sky today is a flat colour plus fog and `loc.skyBody` in `js/world.js`). Examples: Moon with Earth overhead, Dreaming City green aurora and floating spires, Titan teal haze and Saturn, Mars orange dust and ridges, Tangled Shore floating rocks, Io teal fog.
3. **Level rebuilds** from the audit in `docs/level-audit/` (zone verdicts, rebuild briefs, and an "Elevation and rhythm" section per mission):
   - **v3.1 wave 1:** Moon and Dreaming City. **Wave 2:** Earth and Mars.
   - **v3.2 waves 3 and 4:** Io, Titan, Tangled Shore, Leviathan.
4. Reference images kept for the U17 patrol zones.

## Exclusions
The Tower (rebuilt in v3.0), new enemies, loot, story, patrol zones (U17).

## Dependencies
U13a nav grid and oriented colliders, and the v3.0 maps (done).

## Risks
- Terrain touches physics, nav, spawns, projectiles and every map file. Prototype on one map first (Moon m2, the Hellmouth descent).
- Heavy units on slopes are untested on the nav grid.
- Rebuilt maps can break collision, nav or z-fighting. Run `tools/leveltest.js` and `tools/zfight.js` on every one.
- Builder agents hit a session rate limit in the first attempt; give each one file (`js/level-<dest>.js`) so they cannot collide, and do the engine work yourself first because the builders depend on it.

## Test plan
`sh tools/run_tests.sh` plus new terrain unit tests (height lookup, slope limit, enemy and projectile ground contact). `tools/leveltest.js` and `tools/zfight.js` per rebuilt map, a playthrough of each rebuilt mission, a check of each skybox, screenshots of each new sky and rebuilt zone. State what was not checked.

## Acceptance criteria
- Players, enemies, spawns, pickups and projectiles follow terrain.
- Every mission in the released waves has its own sky and a real traversal rhythm, with no arena-after-arena strip.
- Each destination reads as its Destiny original in spirit.
- All tests pass, no console errors.

## Engine facts learned during the audit (until the terrain engine lands)
`K.platform` is a solid box (`y` option stacks terraces), `K.stairs` rises 0.4 m per 0.6 m of run, boss rooms double as horde arenas (keep them closed rooms with ground cover), zones activate within 24 m (28 boss), enemies spawn 7 to 19 m from the zone centre.
