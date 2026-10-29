# U17c "Open Frontier" (wave 3), v3.5: Gate B proposal

Status: revised 2026-10-29 with Bryce's Titan and Io references and briefs; waiting on his approval. Branch when approved: `update/17c-open-frontier-titan-io`.

Scope change 2026-10-29 (Bryce): U17c shipped Titan only as v3.5; the Io half becomes U17d.

## Objective

Add the Titan and Io patrol zones on the U17a framework. Each zone is a free-roam map with beacons, public events with a heroic mechanic, ambient camps, intentional paths from the landing to every area, Sparrow routes and one NPC meeting. Each must have its own recognisable architecture. After this wave, five of the seven patrol zones exist.

**Build order:** Titan first, then a pause for Bryce's go-ahead, then Io. One release (v3.5) after both are done; nothing is published at the pause.

## References and briefs

Everything is in `docs/reference/README.md` (sections "Titan patrol zone", "Io patrol zone" and "All patrol zones"), plus the earlier `titan-rigs.webp`, `io-giants-scar.webp` and `io-mossy-teal-ruin.webp`. As always, they set the vibe; they are not blueprints.

**A rule for every new map:** walkways, rails and platforms sit on what is under them, and a path over sloped ground follows the slope. Rails stand on the deck edge, never floating. (Fixing the existing maps is roadmap row LQC, not this update.) Vex scenery blocks that float on purpose are the exception, since floating geometry is how the Vex build; nothing the player walks on floats.

## Scope: Titan (`t_patrol`, `js/patrol-titan.js`)

The whole map is high above the methane sea, in two halves with distinct looks, joined by bridges.

**1. The Rigs (industrial infrastructure for the arcology).**
- **Landing: The Rig.** A broad deck with the dish, lattice masts and pipe stacks.
- **Rig stations.** Big metal buildings on red stilt legs with checkered markings: white and teal walls with portholes, red and orange corporate blocks, silos, cranes and heavy machinery, hazard-striped floors, numbered blocks. The colours are vibrant against the grey-green haze.
- **Siren's Watch.** A tall tower rig with a climb to a lookout over the sea.
- **Pipe bridges with cable rails** between rigs, wide enough for the Sparrow: these are the Sparrow tracks. The rails stand on the bridge, and the bridges hang from the masts.
- **Sloane's command post** on The Rig, with a quest (working title "Arcology Watch").

**2. The Arcology (a ruined sci-fi utopia inside a biosphere).**
- **The dome.** A huge glass-lattice biosphere on the rigs. Inside are curved, terraced towers with strip windows, overgrown plazas, ponds, white kiosk pillars, pink and blue domed screens, and curved white paths with stairs up to raised gardens. Vines hang from the terraces. It was pristine once; nature has taken it back.
- **Hive in parts of it, not all.** The Solarium and one tower wing are taken over by Hive ritualists: gunk, green crystals and egg clusters on the floors and walls. The rest is clean ruin and jungle. That way the Hive zones read clearly against the rest.
- **The sunken gallery.** Part of the arcology goes under the ocean: a ramp down from the dome into an enclosed glass corridor below the sea line, with the sea visible through the windows (Sunken Labs feel). It ends in a Hive-held chamber.
- **On foot.** The arcology is mostly walking; a boulevard through the dome takes the Sparrow.

**Faction:** Hive only, in Titan's colours.

**Events (new):**
- `rig_breach`: the Hive climb out of the sea onto a rig station. Marked targets: Wizards.
- `brood_hatch`: egg clusters in the Solarium hatch. Marked targets: Brood Knights.

**Beacons:** at least four, spread across the Rigs, the dome, the Hive wing and the sunken gallery.

**The sea:** it stays unwalkable. `level-titan.js` already turns every non-deck cell into a sea slab with a tall invisible collider, so nobody can fall in. I reuse that.

## Scope: Io (`i_patrol`, `js/patrol-io.js`)

A barren rocky world with a green surface, cut by canyons and valleys. The Vex are the main presence, the Taken are there too, and the Red Legion holds a base.

- **Landing: Lost Oasis.** A still lake, a huge pale petrified tree with twisted roots, an arch, mossy teal rock.
- **Canyons and valleys.** Layered yellow-green mesas with dirt paths cut between them: the road network runs through the canyons, with ramps up onto the mesas. Also the canyon of the white woven tree with its glowing crown, rock spires and a stream.
- **Giant's Scar.** The Cabal drill column in its ringed base, braced by the crane arm, on flat sulfur slabs.
- **The Red Legion base.** The same Cabal look as Mars and the Leviathan (heavy armoured walls, barricades, landed drop ships), with **walkable interiors**: a hangar, a command hall and corridors to fight through.
- **Terrabase Charon.** A curved, raised human base with an arched gate and a round landing pad, now abandoned. A black **Taken blight** sphere crackles over the rocks beside it, with Taken around it. **Asher Mir** works in a lab here, with a quest (working title "The Last Touch").
- **The Pyramidion, enterable.** The exterior is a vast tilted block of stepped, layered Vex stone with a red glow beneath it. Inside, the goal is scale:
  - an enclosed volume far bigger than any room in the game so far (my target is about 140 m across and 70 m tall, to be checked against performance);
  - huge diagonal slabs meeting overhead, angled walkways that descend through floating and leaning Vex blocks, and a lit gate far below;
  - a sunken pit glowing red under a suspended red cube, ringed by stone pillars.
  
  The paths inside are angled ramps that follow the slab they sit on. The Pyramidion's campaign mission stays separate; this is the patrol space.
- **Factions:** the Vex across the canyons and the Pyramidion, the Taken at the blight, and the Red Legion at Giant's Scar and its base. New `FACTION_KITS` entries for `vex` and `taken`, so camps and beacons can name a faction with `f`.

**Events (new):**
- `vex_incursion`: a Vex gate opens in a canyon. Marked targets: Minotaurs.
- `taken_blight`: the blight at Terrabase Charon surges. Marked targets: Taken Captains.

**Beacons:** at least four, including one inside the Pyramidion and one clear inside the Cabal base.

## Shared work
- Export `TITAN_KIT` from `level-titan.js` and `IO_KIT` from `level-io.js` (as Moon and Mars did); new shared props (pipe bridge, rig legs, Hive growth, Vex slab) go in `patrol-kit.js` when both maps need them.
- **Wiring:** `world.js` `LEVEL_SETS`, `patrol-data.js` (maps, events, faction kits), the Director's Patrol button for both destinations, `quests.js` `PATROL_MEETINGS`, `story.js` `PATROL_TALKS`.
- **NPC models** in `models-npc.js`:
  - **Sloane:** dark grey hair, a spiked blue-grey pauldron, a white chest plate, blue-grey armour (`sloane.png`).
  - **Asher Mir:** blue-grey skin, white hair with red at the side, a high-collared orange coat, a red Vex arm, a bandolier (`asher-mir.png`).
- **Release:** Update Log entry, version stamp, docs, and a new title card ("Open Frontier", Version 3.5) with artwork from one of the two zones.

## Exclusions
- The Tangled Shore and Dreaming City zones, and the remaining NPC moves (U17d). Asher Mir comes forward into this wave; nobody else moves.
- Fixing floating rails and paths on existing maps (LQC).
- No new enemy units or bosses (every unit needed exists); no Light scaling in patrol (U18); no save change.
- No full co-op QA unless Bryce asks.

## Dependencies
U17b (released v3.4): the patrol framework, `patrol-kit.js`, `FACTION_KITS`, the terrain types, and Titan's sea-platform code from U16e.

## Risks
1. **The Pyramidion's scale versus performance and lighting.** One fog and light setup covers the whole patrol map, so the interior can't get its own darker atmosphere. I would carry its mood with emissive Vex light and the red core instead. A volume that big adds draw calls. Mitigation: `merge: true`, a light pool, and logging the draw call count against the Mars patrol. If it is too heavy, I'll come back to you before cutting its size.
2. **The dome on Titan** has the same lighting limit: inside and outside share one fog. The glass roof and the teal haze suit that, but the "pristine once" brightness has to come from materials, not separate lighting.
3. **Below the sea line.** Ground can't go below 0, so I build "under the ocean" by raising the decks high and drawing the sea surface above the sunken gallery's floor. I'll check this in the preview early.
4. **Three factions on Io.** Mixed factions can pick up the wrong palette (the H16 bug). Each camp, beacon and event names its faction and palette, and I check each one in the preview.
5. **The Taken.** Apart from the Dreaming City, the Taken have little use in the patrol framework so far. Their `FACTION_KITS` names and palette need checking against the Dreaming City's.

## Test plan
- `sh tools/run_tests.sh`, plus unit tests for the new `PATROL_DATA` entries: beacons, events, camps and NPCs inside bounds, event specs complete, faction kits valid.
- `tools/patrolboot.js` `check()` on both maps: everything reachable on foot from the landing, and the Sparrow routes rideable.
- `tools/leveltest.js` and `tools/zfight.js` on both maps, plus a check that no walkable surface or rail floats (spot checks in the preview, and a scripted look at rails over the terrain height where I can make one).
- A preview playthrough of each zone, with no console errors:
  - land and ride to every area;
  - run one beacon of each type and both public events, including a heroic;
  - meet the NPC and finish the quest;
  - die and wake at the landing;
  - return to orbit;
  - on Titan, walk down into the sunken gallery; on Io, walk the Pyramidion from its gate to the red core.
- Screenshots of the key areas of each zone, sent to Bryce at the Titan pause and again at the end.
- Co-op: ask Bryce before ending the session.

## Acceptance criteria
- The Director offers Patrol on Titan and Io; both load with no console errors, and all tests pass.
- Titan reads as two zones: industrial rigs and an overgrown biosphere arcology, all above the sea, with Hive growth in parts of the arcology only and a sunken section.
- Io reads as green canyons and valleys with the Vex first, a Taken blight, a Cabal base you can go inside, and a Pyramidion interior that feels huge.
- Every area can be reached from the landing by an intentional path; no walkway or rail floats.
- Each zone has at least four beacons, two public events with a working heroic mechanic, and camps spread across the map.
- Sloane and Asher Mir can be met, and their quests complete.
- No save change (SAVE_VERSION stays 10).
