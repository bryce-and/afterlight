# U17f "Open Frontier" (wave 5), v3.8: Gate B proposal

Status: drafted 2026-11-03, revised the same day with Bryce's answers (Spider's lair and the Spider, falling allowed, three factions, the Dreaming City split off); waiting on Bryce's approval. Chained after U17e in the same session. Scope change from the roadmap: U17f is the Tangled Shore alone; the Dreaming City and the remaining NPC moves become U17g. Branch when approved: `update/17f-open-frontier-tangled`, cut from the U17e branch tip.

## Objective

Add the Tangled Shore patrol zone (`ts_patrol`, `js/patrol-tangled.js`) on the U17a framework: a free-roam map of floating rocks lashed together with cable and scrap over a cloud abyss you can fall into, with beacons, two public events with a heroic mechanic, ambient camps of three factions, intentional paths from the landing to every area, Sparrow routes, the Spider in his lair and the Petra Venj meeting. After this wave, six of the seven patrol zones exist.

## References and brief

`docs/reference/README.md`, section "Tangled Shore patrol zone" (six patrol screenshots, the Spider's throne room, two of the Spider, two of Petra), plus `tangled-shore-floating-rocks.webp`. They set the vibe; they are not blueprints.

**Map rule:** walkways, rails and platforms sit on what is under them, and a path over sloped ground follows the slope. Rocks in the sky may float on purpose; whatever the player walks on is a whole rock island with its own underside, or a bridge anchored at both ends.

## Scope

Purple dusk, a cloud sea far below, and a vast broken ring of debris round a glowing core hanging in the sky.

**Factions** (Bryce, 2026-11-03; this replaces the 2026-11-02 "all Scorn" rule for the patrol zone only, the campaign missions and activities stay Scorn)
- **Fallen** across most of the Shore: rogue crews on the chained rocks and the outer decks. The Spider's own crew at Thieves' Landing is not hostile.
- **Scorn** in some spots: the flats and Trapper's Cave, marked with their white sigils, totems and ether cans.
- **Hive** at the crashed Hive ship (Jetsam of Saturn). Hive units carry the Moon palette (`pal`, as the Earth Hive Ritual does since H16).

**Areas** (zone names from the existing Tangled Shore data)
- **Landing: Thieves' Landing.** A cavern under a rock ceiling hung with bulbous Fallen pods; rounded Fallen huts on steel stilts with orange glyphs and red eye-lights, red banners, walkways over blue mist. A safe hub: no camps, Spider's crew standing about as scenery. Petra Venj waits here.
- **The Spider's lair.** Off the landing: a tall lit tower door between Fallen domes, a plank bridge with circle-marked panels and a crane lowering a cargo net. Inside, **the throne room**: green cargo netting hung like tent walls, bare hanging lamps, green pods and crates, a cable-strewn deck, the Spider on his raised throne with two spear-carrying guards either side.
- **The Rift: chained rocks.** Floating islands lashed together with cables and chains, plank bridges and scrap decks between them, eye-lit Fallen cranes with cargo cradles. Fallen camps. The main Sparrow route crosses on wide decks; narrow plank bridges are on foot.
- **Jetsam of Saturn: the crashed Hive ship.** A colossal plated hull lying on its side over a rocky hollow, small green lights along it. Its overhang shelters a debris slope; a cave under it glows green and leads into **a walkable interior** (a broken hold and corridor). Hive camps.
- **The Scorn flats.** Open pale sand with dry scrub, low dark rocks, rusted wreck ribs, Scorn sigils on boulders, totems. The widest open ground, good for Sparrow riding.
- **Four-Holed Cove / Trapper's Cave.** A rock ring holed through over the void (Fallen), and a low cave the Scorn use as a den.

**Falling (new for patrol):** ledges are open. Walking or riding off one kills the player, who tumbles (ragdoll) on the way down and wakes at the landing. This reuses the Tower's `voidAt` and `player.fallDie()` (U16d), with the death banner text passed in rather than fixed to the Last City. The Sparrow dismounts on the fall. No revive is spent, as on the Tower. Enemies: nav keeps them off edges; one that is knocked off dies.

**Sky:** a patrol-only sky prop for the broken ring and its glowing core (dark blocky debris segments round an emissive white-violet centre, in the purple haze), and the cloud sea as a plane far below (`seaY`, with `hideCliffs` so island undersides read as floating). The campaign Tangled Shore sky stays as it is.

**Faction kits:** `FACTION_KITS` entries using the role-to-unit map U17e adds: `scorn` (Stalker, Raider, Lurker, Wraith, Ravager, Screeb, Chieftain, Abomination), the existing `fallen` and `hive`. Fallen and Scorn take their default looks.

**Events (new)**
- `ether_resupply`: the Scorn haul ether across the flats to a totem ring. Marked targets: Scorn Chieftains.
- `hive_awakening` (working name): the crashed ship wakes and the Hive pour out of the hold. Marked targets: Hive Knights.

The Fallen get camps, a Bounty and a Clear beacon, not an event.

**Beacons:** at least five, spread across all three factions: the chained rocks (Fallen), Four-Holed Cove (Fallen), the flats (Scorn), Trapper's Cave (Scorn), and one Clear inside the Hive ship's hold.

**Petra Venj:** a model in `models-npc.js` from the references (Awoken skin and glowing eye, red side-swept hair, an eyepatch, cream fur-collared jacket and scarf, glowing yellow chest sigil, plum scaled suit, bracers, cape, thigh knife). A meeting in `quests.js` `PATROL_MEETINGS` and `story.js` `PATROL_TALKS`, with a quest (working title "The Queen's Wrath"). Her campaign comms lines stay.

**The Spider:** a seated NPC model from the references: a huge, heavy-set Fallen Baron in a round throne-rig of tanks and pipes on short legs, a pale crested and spiked helmet with glowing blue eyes, a grey cowl, a long dark robe, four arms. Two guard models with quill-spike crests, spears and blue-lit claws. He has talk lines when you walk up (like the Tower NPCs); no quest in this update.

**Wiring:** export `TANGLED_KIT` from `level-tangled.js` (it already has cable, chain, floater, shanty, crane, hull wall, totem and ether can helpers); `world.js` `LEVEL_SETS`, `patrol-data.js` (map, events, kits, a `voidAt` for the patrol world), the patrol tick calling `fallDie`, the Director's Patrol button on the Tangled Shore. New shared props go in `patrol-kit.js` only if reusable.

**Release (chained):** Update Log entry, version stamp, docs. This is the last update of the chain, so the title card ("Open Frontier", Version 3.8) gets new artwork, Tangled Shore art. U17e ships without new artwork.

## Exclusions
- The Dreaming City patrol zone and the remaining NPC moves out of the comms (U17g, its own Gate B).
- A Spider quest or bounty vendor. Any change to the Tangled Shore campaign missions, activities (still all Scorn) or campaign sky.
- New Fallen or Hive enemy models (EMR). Fixing floating rails on existing maps (LQC).
- No Light scaling in patrol (U18), no save change. No full co-op QA unless Bryce asks.

## Dependencies
U17e (Io, v3.7): the faction kit role-to-unit map, finished and released first. U17d (Scorn units, default looks). U16d: `voidAt` and `fallDie`. U17c: `seaY`, `hideCliffs`, `patrol-kit.js`. H16: Hive palette in another destination.

## Risks
1. **Falling in co-op.** `fallDie` was built for the Tower, where nobody fights. In patrol, a fall during an event must not count as a revive-able down, and a teammate must see the body tumble. I check the death and respawn sync messages; a full two-client check only if Bryce asks.
2. **Falling and the Sparrow.** Riding fast over narrow bridges could feel punishing. Sparrow routes stay on wide decks with clear edges; narrow planks are foot paths.
3. **Three factions sharing a small map of islands.** Camps must not wander into each other or into the safe hub; each camp, beacon and event names its faction, and nav leashes keep them on their island. Checked in the preview.
4. **Cavern landing and throne room.** One fog and light setup covers the whole map; their mood comes from emissive pods, lamps, banners and eye-lights.
5. **Patrol spawn code is shared** by all six zones; I re-run `patrolboot` on the other five.

## Test plan
- `sh tools/run_tests.sh`, plus unit tests for the Tangled `PATROL_DATA` entry (in bounds, events complete), the Scorn kit map and the patrol `voidAt` (void off the islands, solid on them).
- `tools/patrolboot.js` `check()` on the Tangled Shore (every area reachable on foot without jumping a gap, Sparrow routes rideable) and on the five other zones.
- `tools/leveltest.js` and `tools/zfight.js` on the zone, plus a check that no walkable surface or rail floats.
- Preview playthrough with no console errors: land at Thieves' Landing and ride to every area; walk into the Spider's throne room and hear him; one beacon of each type and both events including a heroic; meet Petra and finish her quest; walk into the Hive ship's hold; walk off a ledge (tumble, "You Fell", wake at the landing) and ride off one on the Sparrow; return to orbit.
- Screenshots of the key areas sent to Bryce at the end. Co-op: ask Bryce before ending the session.

## Acceptance criteria
- The Director offers Patrol on the Tangled Shore; it loads with no console errors and all tests pass.
- It reads as chained floating rocks over a cloud abyss under the broken ring, with Thieves' Landing, the Spider's throne room, the crashed Hive ship you can go inside, and Scorn-marked flats.
- Fallen, Scorn and Hive each hold their own areas with camps spawning their real units; at least five beacons; two events with a working heroic.
- Every area is reachable by an intentional path; no walkway or rail floats; falling off a ledge kills and ragdolls the player and wakes them at the landing.
- Petra Venj can be met at Thieves' Landing and her quest completes; the Spider sits in his lair with his guards and talks.
- The other five patrol zones behave as before. No save change (SAVE_VERSION stays 10).
