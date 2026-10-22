# U16e builder guide: terrain, sky and the rebuilt maps

For anyone (a builder agent included) editing one `js/level-<dest>.js`. Read `docs/U16e_PROPOSAL.md`, your destination's `docs/level-audit/` file (zone verdicts, rebuild briefs, "Elevation and rhythm") and `docs/reference/README.md` (images are for vibe, never copied) first.

## Terrain (js/terrain.js)
A map gets a `terrain: [...]` list beside `bounds` and `zones`. Plain data, later features win. Without it the map is flat, as before.
- `{ type: 'plateau', x, z, w, d, h, ry, edge }` flat top at height h (world metres), skirt of `edge` m (default 6).
- `{ type: 'ramp', x0, z0, x1, z1, width, h0, h1, edge }` a path climbing h0 to h1 along the segment; `width` is the flat lane, `edge` the side skirt (default 6).
- `{ type: 'mound', x, z, r, h }` and `{ type: 'basin', x, z, r, flat, depth, rim, rimW }` are ADDED to what is there.
- **Ground never goes below 0.** To sink an area, raise its surroundings (a descent is a high plateau stepping down to 0).
- **Slope rule:** the player walks up to rise/run 0.55 (about 29 degrees). Steeper ground is a wall (a cliff). A ramp's own slope is (h1-h0)/length, so a 7.2 m climb needs at least 13 m of run; use 20+ for a gentle one. A short `edge` makes a cliff, which is how you get plateaus with walls round them. Heavy units use the nav grid and steps up to 0.65 per 1 m cell, so a main route should stay under 0.5.
- **Main routes onto high ground must be terrain ramps.** The nav grid treats any collider more than 2.2 m above the ground as a wall, and `K.stairs` risers (0.4 per 0.6 m run) cannot be crossed by enemies on 1 m cells. So stairs and decks above 2.2 m are optional player-only flanks and perches. A plateau reachable only by a jump or a stair is a trap for enemies.
- **List plateaus before the ramps that join them**, or the plateau skirt overrides the ramp and kinks the slope.
- `findSpawn` does not check slope: keep each zone's 7 to 19 m ring on walkable ground.
- The ground mesh uses 2 m cells on a terrain map, so features narrower than about 4 m look rough.

## Kit semantics on terrain (js/world.js makeKit)
- **Every y the kit takes is measured from the ground under (x, z).** `K.box(x, z, ..., { y: 2 })` sits 2 m above the terrain there. This holds for box, obox, mesh, cyl, cone, rock, wall, room, light, collider, ocollider, prop, door and platform. `K.ground(x, z)` returns the terrain height; `{ abs: true }` on K.box makes y a world height.
- Boxes standing on the ground (y = 0) get a skirt down to the lowest ground under them, so they never float on a slope. Walls and rooms follow the terrain under each segment.
- `K.platform` computes its top from the ground at its centre. Its stairs start on the ground at the foot and climb exactly to the deck, whatever the slope does.
- **Rooms (`K.room`) and boss rooms need flat ground under them.** Put a `plateau` of the room's size (edge 3 or so) under it, or build it where the terrain is already level. Keep roofed rooms at one height.
- Colliders on a slope are measured from the terrain at their centre, so keep tall single colliders (walls) in segments of 8 m or less.
- Zone centres and the spawn stand on the terrain automatically. Zones activate within 24 m (28 boss), enemies spawn 7 to 19 m from the zone centre, so keep those rings walkable (ramps and ground, not cliff faces or pits).
- Lights placed with `K.light(x, y, z, ...)`: y is above the ground there.

## Level rhythm (Bryce's rule)
Areas follow: **area + combat, traversal, combat during traversal, new area.** Not every zone needs verticality or an interior; leave open ground open. Most missions need a real up or down. No arena-after-arena strips. Name landmarks after the real Destiny place and keep every zone's layout different from its neighbours. Keep Destiny names.

## Sky (js/sky.js)
Each destination has a sky and `MISSION_SKIES` overrides it per mission. A map may also carry `sky: { ... }` beside `terrain` to override or add keys (the spec is documented at the top of `js/sky.js`). Tune your missions' skies to match the places you build; every mission must read as its own sky.

## Checks (run from the repo root; all headless, no browser pane needed)
- `sh tools/run_tests.sh` unit tests, must stay all green.
- `sh tools/maptest.sh <loc> 0,1,2` per destination: starts each mission, clears every zone, reports meshes and colliders, spawns inside colliders (must be 0), UNREACHABLE zones (must be none), z-fight pairs (target 0; explain any left) and the terrain range.
- `sh tools/mapshot.sh <loc> <mi> <out.png> '<views json>'` renders up to 6 views to a PNG; read it with the Read tool. Eye and target are `[x, y, z]` with y above the ground there. Use it to check every new zone and the sky.

## Scratchpad
Write temporary files only into your own subfolder of the scratchpad (named after your destination); builders share the parent folder and have overwritten each other's files before.
