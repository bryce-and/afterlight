# U17e "Open Frontier" (wave 4), v3.7: Gate B proposal

Status: drafted 2026-11-02; waiting on Bryce's approval. Split from the U17d draft on 2026-11-02 (Bryce): U17d is the Vex and Taken rework, this is the Io patrol zone and is built after it, on the final enemies. Branch when approved: `update/17e-open-frontier-io`.

## Objective

Add the Io patrol zone (`i_patrol`, `js/patrol-io.js`) on the U17a framework: a free-roam map with beacons, two public events with a heroic mechanic, ambient camps, intentional paths from the landing to every area, Sparrow routes and the Asher Mir meeting. After this wave, five of the seven patrol zones exist.

## References and brief

`docs/reference/README.md`, section "Io patrol zone", plus `io-giants-scar.webp` and `io-mossy-teal-ruin.webp`. They set the vibe; they are not blueprints.

**Map rule:** walkways, rails and platforms sit on what is under them, and a path over sloped ground follows the slope. Vex scenery blocks may float on purpose; nothing the player walks on floats.

## Scope

A barren rocky world with a green surface, cut by canyons and valleys. The Vex are the main presence, the Taken are there too, and the Red Legion holds a base.

**Areas**
- **Landing: Lost Oasis.** A still lake, a huge pale petrified tree with twisted roots, an arch, mossy teal rock. Jupiter on the horizon.
- **Canyons and valleys.** Layered yellow-green mesas with dirt paths between them. The road network runs through the canyons, with ramps up onto the mesas. These are the Sparrow tracks.
- **White Tree canyon.** A white woven tree glowing at its crown, sand, dark rock spires and a stream.
- **Giant's Scar.** The Cabal drill column in its ringed base, braced by the crane arm, on flat sulfur slabs.
- **Red Legion base.** The Cabal look from Mars and the Leviathan, with **walkable interiors**: a hangar, a command hall and corridors.
- **Terrabase Charon.** A curved, raised human base with an arched gate and a round landing pad, abandoned. A black **Taken blight** sphere crackles over the rocks beside it. **Asher Mir** works in a lab here.
- **The Pyramidion, enterable.** Outside: a vast tilted block of stepped Vex stone with a red glow beneath. Inside, the goal is scale:
  - an enclosed volume far bigger than any room so far (target about 140 m across and 70 m tall, checked against performance);
  - huge diagonal slabs meeting overhead, angled ramps descending through floating and leaning Vex blocks, a lit gate far below;
  - a sunken pit glowing red under a suspended red cube, ringed by stone pillars.

  The Pyramidion campaign mission stays separate; this is the patrol space.

**Factions in patrol:** `FACTION_KITS` entries for `vex` and `taken`. Today a kit only renames the base unit types; it gains an optional role to unit map so camps spawn the real Vex and Taken units (as reworked in U17d). Colour comes from each faction's default look (U17d), so patrol data passes no `pal`.

**Events (new)**
- `vex_incursion`: a Vex gate opens in a canyon. Marked targets: Minotaurs.
- `taken_blight`: the blight at Terrabase Charon surges. Marked targets: Taken Captains.

**Beacons:** at least five, across the canyons, Giant's Scar, the blight, one inside the Pyramidion and one Clear inside the Cabal base.

**Asher Mir:** a model in `models-npc.js` from `asher-mir.png` (blue-grey skin, white hair with red at the side, a high-collared orange coat, a red Vex arm, a bandolier and belt); a meeting in `quests.js` `PATROL_MEETINGS` and `story.js` `PATROL_TALKS`, with a quest (working title "The Last Touch").

**Ground colour:** the campaign Io is sulfur yellow, cream and teal. The patrol ground is yellow-green, as in the Pyramidion exterior image. The campaign stays as it is.

**Wiring:** export `IO_KIT` from `level-io.js`; `world.js` `LEVEL_SETS`, `patrol-data.js` (map, events, kits), the Director's Patrol button on Io. New shared props go in `patrol-kit.js` only if reusable.

**Release:** Update Log entry, version stamp, docs, and a new title card ("Open Frontier", Version 3.7) with Io artwork.

## Exclusions
- The Tangled Shore and Dreaming City patrol zones and the remaining NPC moves (U17f).
- Fixing floating rails and paths on existing maps (LQC).
- Enemy models and looks (U17d). No changes to the Io campaign missions or the Io sky.
- No Light scaling in patrol (U18), no save change. No full co-op QA unless Bryce asks.

## Dependencies
U17d (the reworked Vex and Taken, default faction looks). U17c (released v3.5): the patrol framework, `patrol-kit.js`, `FACTION_KITS`.

## Risks
1. **The Pyramidion's scale versus performance and lighting.** One fog and light setup covers the whole patrol map, so the interior can't get its own darker atmosphere. Its mood comes from emissive Vex light and the red core. Mitigation: `merge: true`, a light pool, and logging draw calls against the Mars and Titan patrols. If it is too heavy, I come back to Bryce before cutting its size.
2. **Three factions on one map.** Every camp, beacon and event names its faction, and I check each in the preview.
3. **Patrol spawn code is shared** by all five zones. The faction kit change must leave Earth, Moon, Mars and Titan behaving as before; I re-run `patrolboot` on all of them.
4. **Interiors and the Sparrow.** The Cabal base and Pyramidion interiors are on foot; no Sparrow-width entries, rather than new blocking code.

## Test plan
- `sh tools/run_tests.sh`, plus unit tests for the Io `PATROL_DATA` entry (in bounds, events complete) and the faction kit unit map.
- `tools/patrolboot.js` `check()` on Io (everything reachable on foot, Sparrow routes rideable) and on the four existing zones.
- `tools/leveltest.js` and `tools/zfight.js` on Io, plus a check that no walkable surface or rail floats.
- Preview playthrough with no console errors: land and ride to every area; one beacon of each type and both events including a heroic; meet Asher Mir and finish the quest; walk the Pyramidion from its gate to the red core; fight through the Cabal base; die and wake at the landing; return to orbit.
- Screenshots of the key areas sent to Bryce at the end. Co-op: ask Bryce before ending the session.

## Acceptance criteria
- The Director offers Patrol on Io; it loads with no console errors and all tests pass.
- Io reads as green canyons and valleys with the Vex first, a Taken blight, a Cabal base you can go inside, and a Pyramidion interior that feels huge.
- Every area is reachable by an intentional path; no walkway or rail floats.
- At least five beacons, two events with a working heroic, camps across the map spawning the real Vex and Taken units.
- Asher Mir can be met and his quest completes.
- The other four patrol zones behave as before. No save change (SAVE_VERSION stays 10).
