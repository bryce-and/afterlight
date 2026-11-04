# U17g "Open Frontier" (wave 6), v3.9: Gate B proposal

Status: drafted 2026-11-04, revised the same day with Bryce's answers (references, Petra Venj as the NPC, Taken and Scorn, falling allowed); Gate B approved by Bryce 2026-11-04, with a patrol-wide change folded in (below). Branch: `update/17g-open-frontier-dreaming`, cut from `main` (v3.8).

## Objective

Add the Dreaming City patrol zone (`dc_patrol`, `js/patrol-dreaming.js`) on the U17a framework: rocky cliffs over a sea of cloud, the Divalian Mists, ornate Awoken palaces, purple crystal caverns and statues, under a glowing ring torn in the sky. Beacons, two public events with a heroic mechanic, ambient Taken and Scorn camps, intentional paths from the landing to every area, Sparrow routes, falling off ledges, and a second Petra Venj meeting. After this wave all seven patrol zones exist and the U17 "Open Frontier" track is complete.

## References and brief

`docs/reference/README.md`, section "Dreaming City patrol zone" (ten images from Bryce, 2026-11-04), plus `dreaming-city-tower-bridges.webp`. They are inspiration, not blueprints. Campaign `js/level-dc.js` already has the palette (ivory, lavender, dusk violet, gold trim, ice crystal, blight black with orange veins) and the patrol reuses it, adding the cyan Awoken light lines and the pink-lilac palace stone from the references.

**Map rule:** walkways, rails and platforms sit on what is under them, and a path over sloped ground follows the slope. Bridges are anchored at both ends.

**Uniqueness:** the campaign maps already use Divalian Mists, Rheasilvia, The Strand, Gardens of Esila, Spine of Keres, the Oracle Temple, Blight Hollow and the Wishing Chamber. The patrol may reuse place names (as Thieves' Landing did) but no area copies a campaign zone's layout or landmark set. I check them side by side.

## Scope

Violet dusk with gold light on the stone, a sea of cloud below the cliffs, and in the sky a huge glowing white-violet ring, the landmark in every outdoor reference.

**Factions** (Bryce, 2026-11-04)
- **Taken** through the Mists, the Gardens, the palace and the caverns (the U17d `taken` kit).
- **Scorn** at Aphelion's Rest and the lower decks of Rheasilvia (the U17f `scorn` kit), with their white sigils, totems and ether cans.
- Awoken never appear as enemies (2026-10-20 decision). Awoken Corsairs stand about the landing as scenery.

**Areas**
- **Landing: the Strand.** A rocky shore of wet flat stone and boulders in low mist, a colossal pointed Awoken arch-spire with lit lattice glass rising behind it (`dc-patrol-shore-arch-spire`). Beached skiffs, a Corsair post with lavender banners. A safe hub, no camps. Petra Venj waits here.
- **Divalian Mists.** A grassy cliff top over the cloud sea with a pale fortified palace wall along the edge: thin spires, a ribbed dome, a round sealed door (`dc-patrol-cliff-palace-wall`). Below it in thick mist, a round court ringed by dark needle spires holding **the Blind Well**: a mushroom-capped pedestal of dark ribs round a glowing cyan column, on a round plate with a cyan light ring (`dc-patrol-blind-well`). Taken camps.
- **Gardens of Esila.** Reached through a narrow gorge under an overgrown arch (`dc-patrol-gorge-arch`). Terraces of white curving paths and low walls, round planters with mossy boulders, gnarled bonsai trees, blade-like white pylons, and on the rocks above a vine-covered lattice dome with a ringed door (`dc-patrol-garden-terraces-dome`, `dc-patrol-overgrown-dome-spire-court`). Taken camps, blight creeping in.
- **Rheasilvia: towers and the palace.** Tall ivory towers joined by wide arched bridges over a gorge (the existing tower-and-bridges reference); the main Sparrow route runs on the bridge decks, Scorn camps on the lower decks. One tower opens into **a walkable palace**: a pink-lilac court with a huge carved white arch and curved planters (`dc-patrol-palace-court-portal`), through to a dark pillared hall with a round sunken pool and a lit orb pedestal (`dc-patrol-dark-pillared-hall`). Taken inside.
- **The crystal caverns** (working name; Harbinger's Seclude is the nearest Destiny place). A purple crystalline cavern under the cliffs: a wide stair with a glowing centre line rising past two tall hooded statues holding orbs to a ring-crowned sealed door, dark pillars wrapped in green lattice lamps (`dc-patrol-crystal-hall-stair`, `dc-patrol-statues-stair`). Taken camp; a Clear beacon at the top of the stair.
- **Aphelion's Rest.** Cliffside ruins over the sea: broken colonnades and a toppled spire lying across a ledge. A Scorn den.

**Falling** (Bryce, 2026-11-04: as on the Tangled Shore): the cliff edges and the bridge sides are open. Walking or riding off one kills the player, who tumbles (ragdoll) and wakes on the Strand. Reuses the U17f patrol `voidBelow`, `voidAt` and `player.fallDie()` with the cloud sea (`abyss: true`) below the cliffs. No revive spent; the Sparrow dismounts. Enemies: nav keeps them off edges; one knocked off dies.

**Sky:** a patrol-only sky prop for the torn ring (concentric broken white-violet bands round a bright core, faint streaks), placed so it reads from the Strand, the Mists and the Gardens. The campaign Dreaming City sky stays as it is.

**Events**
- `blind_well` (new): Taken pour out of the well in waves while a Guardian holds the plate; the well charges while someone stands in the light ring. Marked targets for the heroic: Taken Captains, then a Taken Ogre.
- `ether_resupply` (reused from U17f, data only): the Scorn haul ether up through Aphelion's Rest to a totem ring. Marked targets: Scorn Chieftains. Reusing it keeps the event system data-driven; if Bryce wants a Scorn event of the Dreaming City's own, that is a scope change.

**Beacons:** at least five, across both factions: the Mists cliff top (Bounty, Taken), the Gardens terraces (Clear, Taken), Rheasilvia lower deck (Bounty, Scorn), Aphelion's Rest (Clear, Scorn), and one Clear at the top of the crystal cavern stair (Taken).

**Petra Venj, second meeting** (Bryce, 2026-11-04): her U17f model, a second meeting `petra_dc` in `quests.js` `PATROL_MEETINGS` (`place: 'patrol:dc'`) and `story.js` `PATROL_TALKS`, with its own quest (working title "The Torn Veil"). The Tangled Shore meeting stays. Her campaign comms lines stay.

**Remaining NPC moves:** with Petra here, nothing is left to move. Every comms speaker with a body who does not live in the Tower now has a patrol meeting; Mara Sov stays a comms voice. The roadmap item closes with this wave.

**Wiring:** export `DC_KIT` from `level-dc.js` (spire, bridge, crystal, blight helpers), `world.js` `LEVEL_SETS`, `patrol-data.js` (map, events, kits, `voidBelow`), the Director's Patrol button on the Dreaming City. New shared props (statues, the sky ring) go in `patrol-kit.js` only if reusable.

**Folded in (Bryce, 2026-11-04), patrol-wide**
- **Patrol notice range 60 m.** In patrol zones, enemies only notice a player within 60 m; past that they walk back to their camp. An enemy that is damaged notices whoever hurt it from any range for 8 s after each hit. Applies to all seven zones. The campaign and other activities are unchanged.
- **Ghost hold fix.** The E and O holds filled at a third of their speed (the Ghost animation dipped every third frame), so orbit took about 15 s. Fixed; the times stay 1 s and 5 s.

**Release:** Update Log entry, Roadmap teaser, version stamp 3.9, docs. If this is the last update of the session, the title card ("Open Frontier", Version 3.9) gets new Dreaming City artwork.

## Exclusions
- The Leviathan and the Tower (no patrol zone, 2026-10-24).
- The Shattered Throne, Ascendant Challenges and the portals as working teleports, the weekly curse cycle, Riven, a Mara Sov model.
- Any change to the three Dreaming City campaign missions or their sky.
- New Taken or Scorn enemy models. Fixing floating rails on existing maps (LQC, next).
- No Light scaling in patrol (U18), no save change. No full co-op QA unless Bryce asks.

## Dependencies
U17f (v3.8, released): patrol falling, the `scorn` kit, `ether_resupply`, PATROL_TALKS, the Petra model. U17d: the `taken` kit. U17c: `seaY`, `hideCliffs`, `patrol-kit.js`. U15: the Dreaming City campaign kit and palette.

## Risks
1. **Looking like the campaign maps.** The campaign covers the Mists, the Gardens and the Spine; the patrol versions must be different layouts. Checked side by side in the preview.
2. **Two interiors and a cavern under one fog and light setup** (max 6 `K.light` per map). Their mood comes from emissive cyan lines, lattice lamps, crystals and the orb pedestal, as the Tangled Shore cavern did.
3. **The Blind Well hold plate** is new event logic. If it does not fit the event framework cleanly I fall back to a wave event without the plate and say so.
4. **Petra in two patrol zones.** The meeting code keys on meeting id, not NPC id; I confirm a second Petra meeting does not clash with the first (quest state, markers, talk lines) with a unit test.
5. **Falling near busy areas.** The Blind Well court and the bridges are close to edges; railings or low walls where fights happen, open edges elsewhere. Sparrow routes stay on wide decks.
6. **Patrol spawn code is shared** by all seven zones; I re-run `patrolboot` on the other six. Mesh budget: distant spires and the palace wall's far side use `K.edge` with no colliders.

## Test plan
- `sh tools/run_tests.sh`, plus unit tests for the Dreaming City `PATROL_DATA` entry (in bounds, events complete), the patrol `voidAt` (void off the cliffs, solid on them) and the two Petra meetings side by side.
- `tools/patrolboot.js` `check()` on the Dreaming City (every area reachable on foot without jumping a gap, Sparrow routes rideable) and on the six other zones.
- `tools/leveltest.js` and `tools/zfight.js` on the zone, plus a check that no walkable surface or rail floats.
- Preview playthrough with no console errors: land on the Strand and ride to every area; walk the palace and the crystal cavern stair; one beacon of each type and both events including a heroic; meet Petra and finish her quest (with the Tangled Shore quest both undone and done); walk off a cliff and ride off one on the Sparrow; return to orbit.
- Screenshots of the key areas sent to Bryce at the end. Co-op: ask Bryce before ending the session.

## Acceptance criteria
- The Director offers Patrol on the Dreaming City; it loads with no console errors and all tests pass.
- It reads as the Dreaming City: rocky cliffs over the cloud sea under the torn ring, the Divalian Mists with the Blind Well, the Gardens, Rheasilvia's towers and a walkable palace, a purple crystal cavern with statues, none copying a campaign zone.
- Taken and Scorn each hold their own areas with camps spawning their real units; at least five beacons; two events with a working heroic.
- Every area is reachable by an intentional path; no walkway or rail floats; falling off a ledge kills and ragdolls the player and wakes them on the Strand.
- Petra Venj can be met on the Strand and her quest completes, independent of her Tangled Shore quest.
- In every patrol zone, an enemy further than 60 m from every player does not come after them.
- The other six patrol zones behave as before (apart from the patrol-wide notice range). No save change (SAVE_VERSION stays 10).
