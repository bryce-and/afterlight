# Audit: Dreaming City (dc1-3) and Leviathan (lev1)

Read-only audit. Sources: js/level-dc.js (621 lines, read in full), js/level-leviathan.js (409 lines, read in full), LOCATIONS in js/data.js, game.js activity code. Nothing was run in the browser; all verdicts are from reading code, so "looks like" claims are inferred from geometry and are unverified visually.

## Cross-cutting findings

1. **Horde/Endless have no maps of their own.** `moveArena()` in game.js (line ~1100) rebuilds a mission map and uses its last zone (the boss room) as the arena (`arenaOrder`, `level.zones[last]`). So the arenas for these two destinations are exactly: dc1 Gate of the Mists, dc2 Oracle Temple, dc3 Wishing Chamber, lev1 Throne Room. Any fix to those four rooms is also an arena fix. Closed `room` rooms contain units, so these four rooms must stay roofed/walled.
2. **All three Dreaming City missions are the same skeleton.** Spawn (0,18), 144 to 160 m wide, 320 to 340 m long strip heading -z, zone centres about 70 to 75 m apart, a full-width `gateWall`/`cliffWall` with one 8 to 10 m gap between each zone, final boss room with a door in its south wall. Walking dc1, dc2 and dc3 is "pass through a gap, arrive in the next box" three times. That violates principle 3 ("make the three missions differ") more than any single zone does.
3. **Shared kit dressing repeated everywhere.** Every zone gets the same stack: `blight()` x3-6 with `light:true`, `banner()` x3-5, `lamp()` x3, `stub()` x4-7 (identical ruin stub), `crystal()` x2-3, `K.scatter(rock...)`, `mist()` discs, and 4 corner `spire()` at about (+-60, edge). Hand-listed coordinates, so not RNG-random, but they are placed in mirrored pairs on a loose grid with no relationship to the landmark. They read as "dressing sprinkled to hit a density quota". `stub()` and `blight()` are the biggest offenders (same silhouette, 40+ uses across the file).
4. **Repeated names.** "The Strand" is dc1 zone 3 and dc2 zone 1. "Gardens of Esila" is dc2 zone 2 and dc3 zone 2. Two different layouts under one name is fine only if they differ; they currently do not differ enough (both hedge + arch + fountain + pavilion + flowers on a flat lawn).
5. **Faction mismatch.** `faction: 'Taken'` for the Dreaming City, but the architecture is correctly Awoken ivory/lavender with Taken blight overlaid, which is right. The Taken enemy set should sit inside Awoken architecture; that works. The real mismatch risk is **Leviathan**: faction Cabal, but zone 2 adds Taken blight puddles (`blight()` in Royal Pools). Verify against the raid: I believe the Royal Pools are Cabal/Calus-Loyalist territory, not Taken-infested (unverified from memory). If the Taken are not meant to be there, remove the blight and use Cabal crowd (beast pens, Psions, Colossus).
6. **Leviathan is the opposite problem: strong structure, readable halls.** It is built as five clearly different sealed halls with a distinct shape each. Its weaknesses are flat/decor-heavy halls, a hedge maze that is only cover boxes, and the Pools ignoring the real "dive into pools" feel.
7. **Constraint notes.** Outdated constraints (no nav grid, AABB only) are ignored per brief. K.obox is already used in Leviathan; dc never uses oriented colliders or any elevated route above 2.4 m, so there is no vertical play in Dreaming City except dc2 balconies and dc3 terrace.

---

## dc1 "The Divalian Mists" (mood dusk, 4 zones, bounds x -72..72, z -292..30)

Real reference: the Divalian Mists patrol zone (fog-bound shoreline ruins, Awoken stone, Petra's arrival), then Rheasilvia (mountain terrace and Blind Well door), the Strand (coastal plaza under the Ruins), the Gate of the Mists (the Dreaming City entry).

| Zone | Real Destiny place | Currently builds | Verdict |
|---|---|---|---|
| Z0 Divalian Mists (0,-42) | Divalian Mists patrol zone: low fog, broken arches, Awoken ruined shoreline, Gateway to the City | Open plain, about 144 x 80 m. Mist discs, a stream strip and 3 rope bridges that are decor over flat ground (not real gaps), 4 arches (2 broken), 7 identical `stub` walls, 3 fallen columns, a half torus "great broken ring", 3 blight, 4 banners, 4 lamps, rock scatter, 6 spires at +-50 to 60. | **TWEAK**. Strongest scene of the three because the broken ring and arches give a silhouette, and fog is the mission's identity. Fix: bridges cross nothing (stream is only a 0.1 m decal, deck 0.28 m); either make the stream a visible depressed trench or delete the bridges. Replace 7 equal stubs with 2 to 3 larger ruin clusters that form a lane. Make the broken ring the clear landmark at the 40 m sight line. |
| Z1 Rheasilvia (-14,-110) | Rheasilvia: mountain approach with the sealed Blind Well door (iconic round gold-ringed door) and terraces | Open plain with a 3-step terrace on the east (22 x 30, 14 x 20, 7 x 10), a 14 m wall on the west with the sealed round door and gold rings, rock/blight/stub scatter, 5 banners in a diagonal line. | **TWEAK**. Blind Well door is a real, readable landmark and the terraces are good high ground. The centre is a scatter field (4 rocks, 3 blight, 4 stubs at ~(+-30,+-15)) that gives no flow. Fix: replace scatter with a switchback ramp up the east terraces and a low barricade line facing the door; the diagonal banner row looks like a debug line. |
| Z2 The Strand (10,-176) | The Strand: coastal Awoken plaza with a ruined statue, beach edge, the Gateway to the north | Ring: 22 m radius paving, gold ring, 9 columns placed on a circle at 23 m (alternate heights), 5 stubs, a toppled statue NW, 3 towers at +-62, 8 lamps on a ring radius 26, rocks inside. | **REBUILD**. This is the "circular plaza ringed by columns + lamps" pattern; dc1 Gate of the Mists, dc2 Oracle Temple and dc3 Wishing Chamber all use the same "concentric pad + gold torus + gold centre disc" motif, and two of them again use 8 to 9 radial pillars. Brief: make the Strand a sloping shoreline: a long diagonal causeway/pier running NE, a broken sea wall (low 1.4 m cover run) along the east half, a big toppled statue (the existing one, scaled up and placed as the central cover mass) lying across the path, one tall lighthouse-like tower at the NE end as the sight-line anchor, stairs down to a sunken beach pocket for the flank. No circle, no concentric pads. Connects: enters from the Rheasilvia gate at x=8, exits to a corridor leading into the Gate of the Mists. |
| Z3 Gate of the Mists (boss, 0,-242, room 58 x 52) | The Gate: Dreaming City portal/gate with Petra, a corrupted champion fight | Closed courtyard 58 x 52, 11 m walls, concentric dais (4 nested pads + gold ring), 4 corner pillars, 6 braziers at +-26, sealed gate with violet pane and gold ring on north wall, blight and stubs. | **TWEAK**. Reads well as a gate arena and the sealed portal is a great focal wall. Issues: concentric dais is identical to dc2 and dc3 (same pads, same gold torus, same gold centre disc); braziers are in a 3x2 mirrored grid. Fix: break the symmetry (make the dais a raised, offset platform in front of the gate with ramps, or a broken half-ring), place cover as two arc-shaped broken walls facing the gate, and vary pillar heights. Also arena for Horde/Endless: add 4 to 6 ground-level cover blocks so a wave arena is not an empty disc. |

## dc2 "The Spine of Keres" (day, 4 zones, bounds z -316..30)

Real reference: the Spine of Keres (jagged crystal-lined ridgeway), Gardens of Esila (garden terraces), Oracle Temple / Morgeth's Spire (Last Wish raid area "Morgeth's Spire" and the Oracle Temple).

| Zone | Real Destiny place | Currently builds | Verdict |
|---|---|---|---|
| Z0 The Strand (0,-46) | The Strand (see dc1) used as the first zone | Open plain: 3-step grassy hill east with 4-column shrine and spire, arches, 5 stubs, 2 fallen columns, 3 big rocks, banners, lamps, flowers, rock scatter. | **REBUILD**. Same name and nearly the same dressing as dc1's Mists and Strand. Mission is named "Spine of Keres" but the opening is a meadow. Brief: open on Esila's cliffs, not the Strand. Rename "Landing Ledge". Build it as a ridge approach: a diagonal path climbing a wide ramp, ruined Awoken pylon with one tall gold-crowned obelisk as landmark, low cover along a switchback, crystal formations pointing toward the Spine. East hill can stay (it is the only vertical element). |
| Z1 Gardens of Esila (-10,-122) | Gardens of Esila: terraced hanging garden with fountain and hedge-lined lawns | Open lawn with hedge rows (4 horizontal + 2 vertical), 3 arbors, a ruined fountain with crystal, a 10x10 green-roofed pavilion, west 2-step terrace, flowers, ivy spires, rock scatter. | **TWEAK**. Reasonable: fountain, pavilion and terrace give 3 landmarks. But hedge rows are straight bars at fixed offsets; arbors are three equal arches in a line. dc3 Zone 1 is the same idea. Fix: curve the hedges into two interlocking terraces, put the fountain in the centre plaza with 4 radiating paths, and let the pavilion be a 2-storey vantage. Or hand the full hedge-lane concept to dc3 and give dc2 the terraced slope only (see overlap). |
| Z2 Spine of Keres (0,-200) | Spine of Keres: narrow jagged crystal ridge, ribcage-like arches overhead | Interior 52 x 56, 12 m roof, rib arches every 7 m, two balconies 2.4 m with stairs, 4 pillars at +-10 x -182/-220, central glowing strip, crystals in rows, 6 lights. | **KEEP** (with small TWEAK). Best-matching zone in the mission: a ribbed hall with side balconies and a central glowing spine reads as a distinct silhouette. Small fix: crystals are placed in perfect rows of three on each flank at s*22/dz -12,0,12 and 4 in the corners; shift to uneven clusters; add real cover in the middle (4 rocks is thin for a 52x56 room). |
| Z3 Oracle Temple (boss, 0,-276, room 62 x 64) | Oracle Temple: colonnaded temple hall with the Oracle at the north end (Morgeth's Spire fight) | Roofed hall 62 x 64, 14 m, two colonnades of 5 pillars at +-22, concentric dais ring in centre, stepped 2-tier Oracle dais with a gold ring and core at the north, 4 braziers at +-14, crystals at corners. | **TWEAK**. The Oracle ring is a real landmark. Colonnade is a regular 5+5 grid and the central concentric dais is again the same motif. Fix: make the central paving a plain carpet/aisle, move cover to broken pillar clusters mid-hall, and keep the Oracle backdrop the only gold feature so it pulls the eye. |

## dc3 "The Wishing Chamber" (storm, 4 zones, bounds x -80..80, z -324..30)

Real reference: Harbinger's Seclude, Gardens of Esila, Blight (Taken-corrupted cave, Hollow), Wishing Wall / Riven's lair (the Last Wish raid chamber with the dragon skeleton and eggs).

| Zone | Real Destiny place | Currently builds | Verdict |
|---|---|---|---|
| Z0 Harbinger's Seclude (0,-44) | Harbinger's Seclude: Awoken sanctum with the Harbinger's tower, cloister paving and gold-rimmed pool | Corridor/avenue: a 5 m central paving strip 100 m long, 2 colonnade rows at x=+-34 (9 m spacing), side low walls with two gaps each, reflecting pool east with a statue, a 38 m tower west with floating rings, 4 statues on plinths, 4 blight, 4 banners, 3 crystals, scatter. | **TWEAK**. Tower + pool + colonnade gives it readable landmarks and the tall ring tower is the best skyline in the file. Issues: colonnade is a perfectly regular 8-pillar x 2 grid; 4 statues are placed at the four quadrants (-24,-20), (26,-22), (-22,-70), (18,-72); blight and banners are mirrored. Fix: break the grid by removing 3 to 4 pillars, group statues around the pool, make the pool a proper fight centrepiece with a stepped edge as cover. |
| Z1 Gardens of Esila (-4,-118) | Gardens of Esila (same as dc2) | 3 hedge-lane pairs at x=-26 and 22 with gaps, 6 arbor arches along x=-4 every 9 m, a greenhouse frame (glass panes) on the east, a 2.4 m west terrace, a blight fountain, flowers. | **TWEAK**. This is the second "Gardens of Esila" so the two currently overlap in assets (hedge, arbor, fountain, flowers). Keep dc3's lane/greenhouse concept as the "Gardens" and rebuild dc2's version as something else (above). The lanes are decent but the arbors are 6 identical arches in a row. Fix: group arbors in two clusters and vary hedge lengths. |
| Z2 Blight Hollow (6,-192) | Taken Blight cave/hollow: dark organic crater, orange veins | Ring: 28 m crater pad in black, 9 radial orange vein strips, rim of 16 big rocks on an ellipse (36 x 30) with a south and north opening, 5 big blight, 8 hanging stalactite cones (random positions), 4 small blight, 2 crystals, banners, 5 lights in a plus pattern. | **REBUILD**. Radial veins plus a circle of rocks plus a plus-pattern of 5 lights is the clearest "symmetrical but AI-random" zone. Stalactites are random positions with no purpose. Brief: carve it as a descending cavern, not a ring: a wide winding gorge that narrows in the middle into a 12 m choke, with blight nodes as destructible-looking cover on alternate sides (S-curve), one tall Taken spire/obelisk as the landmark, a raised rock shelf on one side for sniper posts, vein glows following the path rather than radiating. Connects: enters via the rock-ribbed gate at z=-154, exits through a narrow pass to the chamber door at z=-226. |
| Z3 The Wishing Chamber (boss, room 88 x 84) | Wishing Wall / Riven's lair: huge chamber with the skeleton of the Ahamkara, eggs, wish-light wells | Roofed 88 x 84 x 20 m. Concentric dais again (nested pads + vein ring + gold ring + core), 8 pillars, rib lattice on the roof, stepped nest dais with 5 eggs at the north, bone ribs arching over the dais, skull, 4 wish wells, 6 blight, banners 14 m, window strips. | **KEEP**, with one TWEAK. This is the mission's best zone: giant ribcage over a nest dais is a clear silhouette and matches the name. Fix: the 88 x 84 floor is large and mostly empty except the concentric circle; give it 6 to 8 mid-height cover blocks (broken pillars, bone arches), and drop the nested-circles pad (it duplicates dc1/dc2 boss rooms). As a Horde arena it needs ground cover. |

## lev1 "The Emperor's Throne" (5 zones, bounds x -66..66, z -270..94)

Real reference: Leviathan raid, plus the Imperial Barge approach: Docking Bay/Barge hangar, Pleasure Gardens (Emperor's pen of beasts and manicured gardens), Royal Pools (Calus's baths), the Gauntlet (long corridor with defence gates), the Throne Room (where Calus fights).

| Zone | Real Destiny place | Currently builds | Verdict |
|---|---|---|---|
| Z0 Docking Bay (0,38) | Leviathan Docking Bay / Imperial Barge landing hangar | Interior hangar 100 x 96 x 14 m: two gold rails, 4 pads with 2 barges, 6 cargo stacks along side walls, 2 mid cargo, 5 crates, side colonnade of 12 banner pillars, gantry beams, big sun over the door, 2 sloped bulwarks. | **TWEAK**. Clear function and sloped Cabal bulwarks are on theme. Weakness: all cargo stacks are against the side walls (x=+-43) and the centre is an empty 24 m lane, so the room plays as "walk straight, fight from the sides". Fix: add 3 to 4 mid-floor barge-shaped cover masses and a raised catwalk. |
| Z1 The Pleasure Gardens (0,-45) | Pleasure Gardens: lawns, hedge garden with pens and fountains under the Leviathan's open sky | Interior 100 x 80, 17 m, glass dome with gold lattice, 2 lawns, cross paths, 2 hedge mazes (3 x 4 cells, seed-hashed walls, outer ring closed), 2 beast pens, 2 fountains, 6 statues in a regular grid, 10 trees, 8 flower beds in a zig-zag. | **TWEAK**. The strongest lev zone: dome, mazes, pens are distinct. Problems: statues are in a 2 x 3 grid at (+-10,-34/-56) and (+-15,-45), trees are mirrored pairs, flower beds follow a formula (the "AI-random" look). Mazes are hashed walls and could leave unreachable pockets or dead-ends that are not designed (unverified). Fix: replace the statue grid with a statue avenue lining the main path, hand-design the maze walls into a readable cross, put War Beasts out of pens as part of the encounter. |
| Z2 The Royal Pools (0,-118) | Royal Pools: bathhouse/pool area in the Leviathan raid | Interior 112 x 66: 4 raised marble pool basins (solid blocks 2.2 m), canal with 2 gold bridges at x=-14 and 38, 12 colonnade pillars, 3 waterfall panes, 2 arches, gilded statue rising from east pool, 12 blight puddles, blue lights. | **TWEAK**. Good layout (canal, bridges, chokepoints) and the statue landmark is clear. Issues: pools are solid blocks you cannot enter (the real pool is wade/swim), blight puddles on a Cabal ship look pasted-on (see Taken note). Fix: remove blight or replace with Cabal pickets; sink one pool as a walkable shallow with low cover. Keep bridges. |
| Z3 The Gauntlet (0,-165.5) | The Gauntlet: long hold with Legion defences in series | Corridor 124 x 28, 10 m, central carpet with gold rails, banner pillars every 12 m both sides (18 total), 5 niches on one wall, 6 barricades, 2 zone gates at x=+-34 splitting it into 3 sections, red/ember lamps. | **TWEAK**. Linear red-gold corridor with gates in series is on-spec and unique among the five halls. Weakness: both side rows are 18 identical pillars, barricades are in near-mirrored pairs, and the corridor is a straight 124 m shooting gallery. Fix: stagger the pillars with a few missing, stagger barricade heights, and put one angled bulwark per section to break sightlines. |
| Z4 The Throne Room (boss, 0,-220.5, room 98 x 79) | Calus's Throne Room: raised throne, gold sunburst, columns and balconies | Closed chamber 100 x 80, 20 m: 3 gold rings and 8 radial gold spokes on the floor, a ring of 10 pillars on an ellipse, raised throne dais with gold wings and a sunburst on the back wall, 2 side balconies (4.8 m) with stairs, 3 chamfer walls, 6 light shafts, vaulted roof. | **TWEAK**. Excellent arena, matches the name and works as a Horde/Endless arena. Issues: the pillar ring and the 6 radial light shafts are formulaic; gold floor spokes and rings overlap the dc "concentric dais" idea. Fix: little cover on the open floor (only 10 pillars at the edge), so add 4 to 6 mid-floor cover pieces for wave arenas. |

---

## Overlap flags

- **Concentric dais motif**: dc1 Strand, dc1 Gate, dc2 Oracle Temple (central ring), dc3 Wishing Chamber, dc3 Blight Hollow. Five rooms share "nested paving circles + gold torus + gold centre disc + pillars on a circle".
- **Hedge + arbor + fountain + flowers**: dc2 Gardens of Esila and dc3 Gardens of Esila share the identical asset set. Also lev1 Pleasure Gardens uses fountain + hedges.
- **Same-named zones**: "The Strand" (dc1 Z2, dc2 Z0), "Gardens of Esila" (dc2 Z1, dc3 Z1).
- **Open meadow + spires + banners + blight**: dc1 Mists, dc1 Rheasilvia, dc2 Strand, dc2 Gardens, dc3 Seclude all open with the same "flat field, scattered stubs, mirrored banners, 4 corner spires" recipe.
- **Pillar-rows with gold caps**: dc1 Gate corners, dc2 Oracle colonnade, dc3 Seclude colonnade, dc3 Chamber pillars, lev1 Gauntlet and lev1 Hangar all use evenly spaced pillar rows.
- **Full-width wall with one gap**: every dc zone transition (about 8 uses). The three missions have the same skeleton.

## Faction-architecture flags

- lev1 Royal Pools: Taken blight on a Cabal ship (probably wrong, see cross-cutting #5).
- dc zones: Awoken ivory/lavender with Taken blight overlays is correct for the Dreaming City. No fortress walls, good. The `cliffWall` rock gates (dc2, dc3) are natural rock, not Awoken, but acceptable as cave mouths.
- lev1: marble and gold is Calus/Loyalist-correct; Cabal bulwarks present in the Docking Bay only. The Gauntlet and Throne Room could use more sloped Cabal geometry (plate bulwarks) to read as Cabal rather than generic opulent palace.

---

## Top REBUILD priorities (ranked)

1. **dc3 Blight Hollow**: radial ring crater is the most artificial layout; rebuild as a winding gorge with choke and shelf (brief above).
2. **dc1 The Strand**: circular column plaza duplicates three other rooms; rebuild as a shoreline causeway with a toppled-statue central cover (brief above).
3. **dc2 The Strand (Z0)**: wrong place for a mission called Spine of Keres, duplicates dc1's name and scatter; rebuild as a ridge approach with a switchback and an obelisk landmark.
4. **Mission skeleton (dc1/dc2/dc3)**: all three are the same 4-box strip with full-width gap walls. At least one mission should change structure (for example dc2 as a climbing ridge with a diagonal route, dc3 as a descent). This is an architecture task rather than a single zone.
5. **Concentric dais motif across five rooms** (dc1 Gate, dc2 Oracle, dc3 Chamber, dc1 Strand, dc3 Hollow): replace with one distinctive floor feature per room. Cheap and high payoff.
6. **Gardens of Esila duplicate (dc2 Z1 vs dc3 Z1)**: keep dc3 lane/greenhouse version, rebuild dc2 as a terraced slope with a stair plaza (no hedges), or rename.

Honorable mentions (TWEAK but worth doing in the same pass): wave-arena cover in all four boss rooms (dc1 Gate, dc2 Oracle, dc3 Chamber, lev1 Throne) since they double as Horde/Endless arenas; remove blight from Leviathan Pools.

---

# Elevation and rhythm

Tools assumed (checked in js/world.js): `K.platform(x,z,w,d,h,{stairs:[sides],stairW,y})` is the deck-with-stairs primitive (stairs on n/s/e/w, stackable with `y:` for tiers); `K.stairs(x,z,dir,w,rise)`. Ground stays y=0. Main-route stairs 5 m wide. Rhythm vocabulary: A = arena (combat), T = traversal (no combat), C/T = combat during traversal, N = new area reveal.

## dc1 The Divalian Mists

1. Elevation today: effectively flat. Only Rheasilvia has a 3-tier east terrace (max 2.4 m, optional side), a 3.2 m rock stub, and the Gate room's nothing. Bridges are decor. Max player height gain on the main route: 0 m.
2. Rhythm today: A (Mists) -> wall gap -> A (Rheasilvia) -> wall gap -> A (Strand) -> wall gap -> A (Gate). Four arenas in a row, 100 percent combat, zero traversal, zero reveal moments. The only things between zones are the instant gaps in full-width walls.
3. Proposal (fog mission, so verticality should be about what you cannot see):
   - Mists (stay open, A+T): keep open fog plain, but make the rope bridges real: two sunken 1.5 m-wide-trench-less approach is impossible, so instead raise the far bank. Put the stream crossing on a 2.4 m stone causeway (platform with 5 m stairs both ends) so the first beat is "climb out of the mist onto the causeway", fight C/T along it with Acolytes below on both sides. Broken ring is the landmark seen from the causeway top.
   - Traversal 1 (new, no combat, about 30 m): a stepped ramp-terrace path (3 flights of 5 m stairs, 1.2 m each) up the Rheasilvia flank to the Blind Well door, with the fog thinning (lights brighter) as you climb. This is the "N" beat.
   - Rheasilvia (A, multi-level): arena sits on the 2.4 m shelf, east terrace stays optional high ground, the Blind Well door wall is the back sight line. Combat down the stairs into the Strand.
   - Strand (A+C/T, shoreline brief): causeway/pier at 0 m with a sunken-looking beach pocket formed by walling it, plus a 3.6 m lookout tower with 5 m stairs on the NE end. Ends with a short covered colonnade corridor (T) into the Gate.
   - Gate (boss, closed room, stays): add a ground-floor cover set and a raised 1.6 m offset dais in front of the portal. No other change (it must stay closed).
   - Interior: none needed; keep the mission outdoors, the Gate room is the interior moment.

## dc2 The Spine of Keres

1. Elevation today: flat apart from a 2.4 m grass hill (optional), 1.6 m terraces in the Gardens (optional), and the Spine hall's 2.4 m side balconies (optional); Oracle dais 2.4 m total. The route itself never goes up. For a mission named "Spine of Keres" (a ridge climb) this is the biggest elevation miss in the set.
2. Rhythm today: A (Strand) -> A (Gardens) -> A (Spine, interior) -> A (Oracle). Two short tunnels exist but are inside the same zone door logic, so they are the only traversal and they are empty (no enemies, no reveal).
3. Proposal: make this the climbing mission, a switchback ascent.
   - Zone 0 "Landing Ledge" (A, open): ridge approach at 0 m with a tall obelisk, crystals pointing up the Spine. Stays open.
   - Traversal 1 (T, about 35 m): a 5 m wide stair-ramp zig-zag up to a 3.6 m shelf (three 1.2 m flights with landings, built from stacked `K.platform` with `y:`). Short C/T: a few Thrall rushers from the shelf above.
   - Gardens (A, terraced, 3.6 m): rebuild as a stepped garden: lower lawn 0 to 3.6 m with a fountain plaza, hedge-free; two terrace tiers connected by 5 m stairs on alternate sides so flow zig-zags. Stays open air.
   - Traversal 2 (T/C, the Spine proper): an enclosed rib-arched tunnel that climbs (another 2 flights up to about 7 m) with window gaps; one ambush pocket mid-way. This is the signature "spine" moment and the one interior.
   - Spine hall (A, interior, keep): now entered at 7 m height as a balcony level; floor is 0 m so you either drop... ground is flat so instead keep the hall at mid height: enter via a 5 m stair down to the hall floor from the tunnel's end, giving up/down in the same level. Side balconies at 2.4 m remain optional high ground.
   - Oracle Temple (boss, closed): keep roofed hall, stepped dais; remove central concentric floor, add broken pillar cover.
   - Net: 3 up phases, 1 down, 2 interiors, 3 traversal beats.

## dc3 The Wishing Chamber

1. Elevation today: flat except a 2.4 m west terrace (optional), 2.4 m dais and 3.2 m nest. The mission has a Blight Hollow zone that sounds like a descent but is flat; no real sense of going down.
2. Rhythm today: A (Seclude) -> A (Gardens) -> A (Hollow) -> A (Chamber), no traversal. Only the Seclude has a long avenue (about 80 m) that could be traversal but is a combat arena.
3. Proposal: make this the descent mission (stair descent with reversed framing).
   - Because ground is flat at 0, simulate descent by starting HIGH: build the first two zones as raised decks at 4.8 m (platform tiers `y:`) and descend by stairs into a floor-level Hollow. The Seclude's terrace plateau is a 4.8 m ivory court with a 5 m wide stair ramp down.
   - Seclude (A, keep landmark tower): fight on the high court at 4.8 m with tower + pool; the colonnade avenue becomes the T beat leaving the court (stairs down, C/T with Thrall).
   - Gardens (A, open, 2.4 m mid level): lane/greenhouse as is, hedges kept; the west terrace becomes the on-route step down; greenhouse can be walkable (interior beat, glass ribs, 2 doors).
   - Traversal (T/C, new): a roofed Taken-ridden corridor of dark rock descending in 3 flights (5 m wide, 1.2 m each) toward the Hollow. No-light, orange vein glow. This replaces the plain rock gate.
   - Blight Hollow (A, floor level 0, gorge brief): with the player now at the lowest point, enemy rim shelves at 2.4 to 3.6 m on both sides give top-down pressure.
   - Wishing Chamber (boss, closed): keep; enter from the Hollow via a short ramp up to the nest. Add cover.
   - Interior moments: greenhouse, descent corridor, Chamber.

## lev1 The Emperor's Throne

1. Elevation today: the best in the set but still mostly flat floors. Pools: 2.2 m solid basins (not walkable) and 0.6 m bridges; Gauntlet flat; Throne Room 1.6 m dais plus 4.8 m side balconies (optional). Route gain: about 1.6 m at the end.
2. Rhythm today: five closed halls joined by gold doors: A -> door -> A -> door -> A -> door -> A -> door -> A. Doors act as the "new area" beat, which works, but nothing is traversal: every hall is combat, and there is no combat-during-traversal. Gauntlet is the closest to traversal (long corridor) but it is a full arena with 6 barricades and 18 pillars.
3. Proposal (keep the halls, add a vertical layer and a real traversal):
   - Docking Bay (A, open interior): add a raised 3.6 m cargo catwalk across the north third with 5 m stairs at both ends so the player either fights under it or climbs; ends in a short cargo ramp to the door.
   - Pleasure Gardens (A, keep): add a 3.6 m terrace walkway round the dome edge with stairs, as sniper/Cabal-captain spots; keep mazes (hand-lay the walls).
   - Royal Pools (A+T): make one pool walkable shallow and replace the 0.6 m bridges with 1.8 m arched gold bridges (5 m stairs), enemies hold the far bank; this is the "combat during traversal" beat of the mission. Remove Taken blight unless verified.
   - Gauntlet (T/C): convert to true traversal: three sections, each with a different height (0, 1.8, 3.6 m) climbing by 5 m stair landings so you ascend toward the throne; fewer barricades, more angled bulwarks; the gates become the section breaks.
   - Throne Room (boss, closed): already a closed room; enter at the high end of the Gauntlet (3.6 m) and descend a grand stair into the room, then the dais back up at 1.6 m. Add mid-floor cover for Horde.
   - Stays open/flat: Pleasure Gardens floor (lawns), keep.

## Summary of rhythm changes

| Mission | Today | Proposed shape |
|---|---|---|
| dc1 | A A A A, flat | A+C/T on causeway, T climb, A on shelf, A+C/T shoreline with tower, boss |
| dc2 | A A A A, flat | A, T switchback up, A terraces, T+C rib tunnel climb, A hall, boss temple |
| dc3 | A A A A, flat | start high, A, T/C down colonnade, A garden with greenhouse, T/C dark descent, A gorge, boss |
| lev1 | A A A A A, halls flat | A, A (terraced), A+C/T bridges, T/C rising gauntlet, boss entered by grand stair |

Caveat: all proposals assume K.platform stacking and 5 m stairs behave on the nav grid as stated by the coordinator; I did not test any of it in the engine. The "start high, descend" trick for dc3 is a workaround for flat ground and needs a check that the 4.8 m starting deck leaves edges safe (rails or walls) so units do not fall; I did not verify how falling is handled.
