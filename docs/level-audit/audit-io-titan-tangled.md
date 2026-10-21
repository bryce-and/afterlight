# Zone audit: Io, Titan, Tangled Shore

Scope: js/level-io.js, js/level-titan.js, js/level-tangled.js (read in full), mission metadata in js/data.js LOCATIONS. Read-only; no repo file changed.
Method: static read of build code. Nothing was run in a browser, so "reads as" judgments are from geometry and coordinates, not screenshots. Destiny references are from memory; where I am less sure of the exact in-game place I say "verify". Constraints from the skill file about no pathfinding / only axis-aligned colliders are ignored as instructed.

Legend: KEEP, TWEAK (small fix), REBUILD (layout brief given).

## 1. Cross-cutting findings (read these first)

1. Nearly every boss room is the same machine. K.room with one 10 to 21 m door on the SOUTH wall, a zone-clear K.door in it, two mirrored side platforms with outward stairs (W and E), a ring or two rows of pillars/plates, a central feature. Mirrored side-deck pairs: io1 Rupture (rim ledges), io3 Protheon (galleries), t1 Helipad (firing decks), t2 Containment Lab (balconies), t3 Choir (balconies), ts3 Ether Spire (firing decks). That is 6 of 10 boss arenas. Only io2 Drill (single east gantry), ts1 Scrapyard (west gantry plus stage) and ts2 Cavern (back dais) break it. Suggest: vary entry side, make the decks asymmetric (one deck, one ramp, a bridge across, a pit), and give each boss one signature structure that is not a deck.
2. Ring-of-stuff layouts recur: io1 Rupture (cliff ring r=27 to 30, spire ring r=21 every 30 deg), ts1 Scrapyard (junk pile ring r=28 via ringAround), ts3 Scorn Encampment (spike ring r=24 plus totem ring r=15) and ts3 Ether Spire (plate/spike ring r=30 plus totems). The Encampment and the boss arena of ts3 are the same composition at different radii. Evenly spaced angular rings look generated, not designed.
3. Mirrored/gridded hand lists. Pillars/columns on exact grids: io3 Aphix Conduit (2 x 5 vexPillar at x=3,25), io3 Gate (4 vexPillars at +-30/+-44), io3 Chamber (4 at +-15), t2 Arcology Interior (2 x 4 columns at x=+-14), t3 Underbelly (7 x 4 stilt grid at 13 m pitch), t3 Choir (2 x 4 columns at hx+-20, 8 braziers in 4 mirrored pairs), t1 Plaza (4 planters at (8/32, -138/-162)), io2 Terrabase (hab blocks on a 2 x 2 grid at x=-19/-53, z=-20/-52 plus mirrored catwalks), io3 Excavation (three concentric rectangles).
4. Shared kit across a destination makes zones read alike even when the footprint differs:
   - Titan: every zone uses arco() pale blocks with amber window bands, tank(), stack() containers, and a sprinkle of hive() + creep() (2 to 4 per zone, same silhouette). Titan zones are distinguished by room shape and little else.
   - Io3: Conduit, Gate and Chamber all use vexPillar + vexCube + MILK floor lines + gold/brass bands. The floor cross-lines (flat strips of MILK) appear in all three.
   - Tangled: shanty/packBlock hut language is reused in ts1 (town), ts2 (Trapper camp and Warrens) and ts3 (Scorn camp), and cliffRun/K.rock/sky() scenery is identical in all three missions.
5. Random scatter (K.scatter, K.R inside loops) is used for filler in: io1 Lost Oasis (rocks+props), io3 Excavation (rocks), ts1 market square (crates), Cove (rocks, cover), Scrapyard (crates, scrap boxes, 8 random mine pods), ts2 Trapper camp (rocks), Warrens (random-polar egg sacs), ts3 Jetsam (rocks), Encampment (cover), Approach (random plate heights). These are the places that read "AI random". None of it has a purpose in the cover logic.
6. Mission-name vs place mismatches: t2 "The Sunken Labs" has nothing sunken (flat floor, 0.22 m water decal in one room). t3 zone "The Methane Sea" is a normal platform with crates; the sea is only a collider and a color. ts1 "Four-Holed Cove" has a tide decal, an arch and a wall with holes, no real cove shape. io2 "Echo Mesa": the mesas are pushed to the map edges (|x| 60 to 75) while the zone is two parallel walls on a flat strip.
7. Faction check: Cabal (io2) good, with bulwark slope plates and hazard lights. Vex (io3) good. Hive on Titan is applied as a creeping overlay on Golden Age buildings, appropriate. Fallen (ts1) good. Scorn (ts3) good: bone, ether, spikes. Minor: io2 boss is the Psion Flayers but the Drill compound has no Psion content (Psions are Cabal telepaths; add Psion pods / mind-link rig). io3 Excavation Site XII is a Legion dig crew with Vex relics: acceptable story-wise but there is almost no Legion presence beyond 5 barricades/crates.
8. Destination-level variety is OK. Io: plain/canyon/crater, base/mesa/pads/compound, dig/hall/plaza/chamber. Titan: open deck, interiors, split platforms. Tangled: town, gorge/cave, wreck field. Weak point is within-mission: t2 is four rectangular roofed rooms on one axis (widths 74/70/64/58, bounds only 76 wide).

## 2. Per-zone verdicts

### IO

| Mission | Zone | Real place to imitate | What it builds now | Verdict |
|---|---|---|---|---|
| io1 | Lost Oasis | Io patrol "Lost Oasis" (sulfur basin, teal pools, Traveler-light ruins; verify exact layout) | Wide open plain 160 m wide. 8 pools, 5 geysers, 16 spires, 6 mounds from hard-coded coordinate lists, 3 cracks, plus K.scatter rocks and props. No path, no center, no silhouette; pools and spires are sprinkled evenly across the field. Single light. | REBUILD |
| io1 | Giant's Scar | Io "Giant's Scar" (huge canyon with enormous fossil ribs) | Rust-wall canyon, 6 m slab pairs with random heights, flared ends, 5 slanted ribs overhead (tilted, random jitter), glowing crack down the floor, two leaning slabs, west ledge. Strong linear read, correct mood. Ribs are straight boxes with the same width (56 m) each; scatter of 5 rocks/3 spires is minor. | KEEP (TWEAK: vary rib spans/heights so they read as one giant skeleton, add a gap/arch you pass under) |
| io1 | The Rupture (boss) | Io's Rupture, the crater where the Traveler touched down (Taken Captain boss) | Cliff ring r 27 to 30 with a gated mouth, 9 evenly spaced white spires at r=21, 4 small spires/rocks at r=14, diagonal glowing fissure, 2 mirrored rim ledges, Taken blight blobs. Good fissure and light shaft landmark. Ring spacing is mechanical (every 30 deg) and ledges mirror. | TWEAK: de-regularize spire ring (cluster and gap it, 2 to 3 big shards instead of 9 equal), make ledges asymmetric, put one big fallen rib/ramp as cover; Taken blight is the hook, add 2 blight pools as hazards |
| io2 | Terrabase Charon | Terrabase Charon (Golden Age research base on Io; Cabal-occupied; verify) | 4 domes at corners, a 34 m lattice antenna (good landmark), 8 hab blocks on a near 2 x 2 grid with mirrored catwalks and alleys, 30 x 30 courtyard floor decal. Reads as a tidy cross grid, hab blocks are the same family. Nice Golden Age palette though. | TWEAK: break the grid (one long hangar/lab slab, one collapsed block, offset alleys), tie the antenna into a Legion-seized radio post, lean the bulwark/Legion pushing in from one side so the base reads as being taken |
| io2 | Echo Mesa | Io patrol "Echo Mesa" (rust mesas, Cabal outposts on plateaus; verify) | Two near-identical bulwark lines (z=-68 and z=-108, both 44 to 46 m long, both t=3, h=8, face +1, banners on, 2 gaps each, 4 hazard posts each) plus two mini bulwarks, 4 barricades. Six mesas pushed to the far edges, so the center is a flat parade ground. This is the clearest copy-paste in the three files. The zone shares nothing of the real "mesa" read. | REBUILD (brief below) |
| io2 | Landing Pads | Cabal landing zone (Io Cabal pads and gunship dock; verify) | Three `landing()` platforms (all same hazard-stripe kit, 18/16/12 m), a parked dropship, two hovering Threshers, two pylons, 3 hazard containers. Cabal faction right. Pads are small and hug the edges, center is the floor-level ring decal. Reads OK but has no big silhouette. | TWEAK: make one big raised pad with a docked dropship the sight-line anchor, ramp up to it, fuel/ammo line; keep other pads smaller and different heights |
| io2 | The Drill (boss) | Red Legion drill rig on Io (Psion Flayers boss; verify) | 52 x 52 bulwark-walled compound, drill rig tower (50 m, glowing core, 4 corner legs) off-center at (36,-232), scaffold, pipe, east gun gantry, barricades. Clean landmark, correct faction, single gantry (good asymmetry). Missing Psion element. | KEEP (TWEAK: add Psion pods or mind-link nodes so the boss theme shows, move one barricade pair off the symmetric positions) |
| io3 | Excavation Site XII | Io "Excavation Site XII" (Cabal dig around Vex ruin; verify) | Three concentric rectangles drawn as flat decals (52x44, 28x22, 12x10) with 1.4 m and 0.9 m walls with gaps, 2 cranes, 4 floodlights, 2 scaffolds, 2 Vex relics, 3 scatter rocks, 2 overlook decks. Concentric nesting is grid-like; "terraces" are not really terraces (ground is flat, walls are only 1 m). Cranes and floodlights are good. | TWEAK: replace concentric rectangles with one irregular dig pit (stepped K.platform ledges around a hole), put the cranes over it, add a half-excavated Vex gate as the silhouette |
| io3 | Aphix Conduit | Aphix Conduit, Vex conduit on Io (verify) | Roofed hall 58 m long: side walls, side-aisle roofs, open nave with skylight beams, 2 x 5 pillars exactly on a grid, milky floor channels, 6 floating cubes, 2 floor cubes. Good Vex palette and a coherent nave. Pillars are the only cover and perfectly uniform. | TWEAK: break the pillar grid (some toppled/short, a central platform or gate arch), add one raised Vex walkway or bridge, otherwise keep |
| io3 | Pyramidion Gate | Vex plaza before a Pyramidion gate (verify) | 95 m black cone pyramid with glow bands, a plinth wall 88 x 88 on the north face, gate portal with red octahedron, plaza with 4 mirrored vexPillars (+-30,-176; +-44,-150), 6 cubes, 2 Legion barricades, glow strips to the gate, 2 mirrored platforms. The pyramid is a strong landmark. The plaza is mirrored and thin on cover; the zone center (0,-163) is empty. | TWEAK: de-mirror the pillars (one fallen), add a central Vex construct (obelisk cluster) as cover, vary platform sides |
| io3 | Protheon's Chamber (boss) | Interior of the Pyramidion, Mind chamber (Protheon, Modular Mind; verify) | Roofed 48 x 48 hall, 4 great pillars at +-15, 5 Vex gate rings on walls, central dais with floating ring and red eye, 8 radial glow lines, mirrored galleries. Strong, readable, but a mirror-symmetric square room like other Vex halls. | KEEP (TWEAK: asymmetry on the galleries, floor cubes as cover are tiny; add 2 larger shards) |

### TITAN

| Mission | Zone | Real place to imitate | What it builds now | Verdict |
|---|---|---|---|---|
| t1 | The Rig | Titan "The Rig" (offshore drilling platform with derrick, cranes, containers; verify) | Whole mission is one 160 x 280 m deck. Rig zone: 10 container stacks on hand-listed coordinates with mixed rotation, 2 cranes, pipe racks, 3 tanks, 3 hive clusters, 1 catwalk. There is no derrick or drill tower at all, so nothing says "rig". Container stacks look scattered (random rot, no rows or lanes). | REBUILD (brief below) |
| t1 | Siren's Watch | Titan "Siren's Watch" (comm tower area; verify) | One strong landmark: 46 m comms tower on a walkway deck at (-55,-100), amber bands, antenna. Surroundings: 3 stacks, 3 low walls, 2 hive. Tower is at the map edge, the zone center (-25,-90) is mostly empty deck with low cover. | TWEAK: move/stretch the deck toward the zone center so the tower dominates, add a gantry/catwalk rising to the tower deck, replace the three random low walls with a deliberate firing line |
| t1 | Arcology Plaza | Titan Arcology plaza (Golden Age towers, planted square; verify) | 5 pale blocks (24, 14, 20, 10, 16 m) around a 4-planter square, skybridge at 10 m, overlook deck. Planters are a 2 x 2 grid. Tall buildings on the periphery, center open. Decent, but amber window bands and block silhouettes duplicate t2 and t3 exterior. | TWEAK: break planter grid, add a ground-floor entrance recess or atrium cut so the plaza feels lived in, one big sculpture/fountain as center |
| t1 | Rig Helipad (boss) | Titan rig helipad (Kathok, Swordbearer; tomb ship; verify) | 64 x 64 hangar room, round pad r=25, ring of 9 Hive spires at r=26 spaced evenly, tomb ship cone overhead (distinct), 2 mirrored firing decks, 5 hive clusters. Ring spacing even. Tomb ship is a good silhouette. | TWEAK: break the even spire ring; the helipad is walled in a hangar, so open one wall to the sea or add a fallen crane to match "rig" |
| t2 | Arcology Interior | Titan Arcology lobby/hall (verify) | Roofed 74 x 54 hall: 8 columns on a 2 x 4 grid, 3 x 3 grid of ceiling lamps, reception counter, 2 planters, mezzanine each side, 4 crates, 3 hive. Reads as generic hall. Facade box above room. Grid columns and mirrored mezzanines. | TWEAK: break the grid, add a central stairwell/escalator pit or a fallen ceiling section, replace crates with lobby furniture clusters |
| t2 | The Solarium | Golden Age atrium with glass dome (Titan arcology; verify) | 70 x 64 room under a real dome (frame ribs, rings), 5 planter trees, two long platforms, dry pool, scraps. Best zone in t2: dome is a strong silhouette. Still symmetric (tree positions at +-16). | KEEP (TWEAK: stagger two trees, add a fallen section of dome) |
| t2 | Flooded Labs | Flooded Titan lab (verify) | 64 x 54 room, half roofed, 0.22 m water decal, benches in mirrored rows (x +-24, z 4 values), 6 specimen tanks, glass partitions, control deck. Reads as a lab. Rows of benches are the only cover, mirrored. "Flooded" is a decal, nothing sunken. | TWEAK: sink a channel as actual lower area using K.platform around a recess (or fake with thin ceiling collapse + deeper water mesh), stagger benches, one big central tank as landmark |
| t2 | Containment Lab (boss) | Hive-overrun containment lab (Ir Halak, Brood Wizard; verify) | 58 x 62 room, 3 chitin rib arches, crystals in the corners, 2 balconies, ruptured vessel at the back with 6 spikes. Strong back wall focus. Balconies mirror as elsewhere. | KEEP (TWEAK: one balcony only, offset) |
| t3 | The Methane Sea | Titan sea rig (open water, rig platform; verify) | 60 x 60 platform, derrick, crane, 5 container stacks, tank, pipe, 2 hive clusters. Reads like a smaller version of t1's Rig, same props. Sea is only a collider. | TWEAK: differentiate from t1 Rig: make it a flare-stack/methane-burner platform with a visible flame and a floating pontoon dock, rely on a different silhouette |
| t3 | Spine of Keres | Hive spine / bridge (Savathun's Song strike path; verify) | Narrow 12 m bridges with 6 identical rib arches (every 9 m, 12 m wide cross-beam and cone), pipelines both sides; a 40 x 40 hub with arco, tank, 2 stacks, overlook. The arches are a coherent rhythm and a nice read. Hub is sparse. | TWEAK: vary arch height/lean, break one arch (collapsed), add a real central structure in the hub |
| t3 | Arcology Underbelly | Underside of the arcology on stilts (verify) | 90 x 53 platform under a hull box; 27 stilts on an exact 7 x 4 grid (13 m pitch, same amber ring), overhead beams on a grid, hanging ducts, 3 chitin pillars, 2 stacks, 2 hive. Perfect lattice, so cover is a uniform forest; no focal point. | REBUILD (brief below) |
| t3 | The Hive Nest | Hive nest beneath Titan (verify) | 80 x 55 platform, west and north chitin spike walls, 2 big rib arches, 4 egg-sac clusters, obelisk, 4 hive clusters, 3 creep patches, sealed door. Generic Hive stuff, reasonable. Central area is open. | TWEAK: make the rib arches a long procession toward the throne, add a spawn pit / pool, one tall tomb silhouette |
| t3 | Choir of Savathûn (boss) | Hive throne hall of Savathun's choir (Sedrak; verify) | 56 x 58 roofed hall, 2 x 4 columns exactly mirrored, 8 braziers in mirrored pairs, 2 choir balconies, altar and throne at back, ceiling stalactites. Good focal altar. Layout near-identical to t2 Containment Lab (room + 2 balconies + ribs). | TWEAK: break pillar symmetry, give the choir a literal choir loft (curved tiers) around the altar, one single balcony |

### TANGLED SHORE

| Mission | Zone | Real place to imitate | What it builds now | Verdict |
|---|---|---|---|---|
| ts1 | Thieves' Landing | Thieves' Landing (Spider's floating shanty town, lantern strings; verify) | Main N-S alley x -3.5..3.5 lined with packBlock shanties (random sizes 4.5 to 8 m), side alleys, a ring market square with stalls, 6 lantern poles with strings, Spider's den hall on the west, banners, floating rock with anchor cable. Dense and readable, strongest Tangled zone. packBlock fill yields rows of similar huts; lantern strings are nice. | KEEP (TWEAK: raise a few huts to 2 to 3 storeys, add a rope bridge/zip line, keep the Spider's den hall as the landmark) |
| ts1 | Four-Holed Cove | Cove under a holed rock wall (verify; name suggests a unique place) | 30 x 30 flat dark tide-pool decal, 3 rocks, skiff, ledge, rock arch (nice), the great holed wall with 4 holes of which 2 walkable, K.scatter rocks and cover, one hut. East half of the map only; west is a plain rock mass. The "holes" are the idea but the cove is a flat yard. | TWEAK: carve the cove: a crescent of rock cliff around the pool, make the holed wall the visible backdrop and 2 holes into side caves with cover, remove K.scatter cover |
| ts1 | The Trickster's Scrapyard (boss) | Scrap arena of a Fallen Baron (Araskes; verify) | 64 x 70 rock-walled yard, ring of 16 junk piles at r=28 (angular ring), 2 skiffs, 8 random mine pods, K.scatter crates + scrap boxes, dais with banners and bounty board, crane, west gantry. A "junkyard" should be rows of wrecks and a crane. Right now it is a ring plus random scatter. | TWEAK (borderline REBUILD): replace ring and scatter with 3 lanes of stacked wrecks, put mine pods in a deliberate minefield strip (the mission desc says "mind the mines"), crane as magnet landmark |
| ts2 | Trapper's Cave | Trapper's Cave style Fallen/Hive camp (verify) | Cliffside camp under a 26 m west cliff (cliffRun random heights), cave mouth as box recess, ether cans, tents (cones), pelt racks, cages, fire ring, 2 shanties, K.scatter rocks. Nicely themed. Composition is loose, tents and racks scattered. | TWEAK: group camp into a tight cluster around the fire against the cave, leave the rest as open firing lane |
| ts2 | The Rift | Tangled Shore "The Rift" gorge with chains overhead (matches the skill example) | 56 m wide gorge, cliffRun both sides to z -160, 4 chain spans overhead with lantern/cage/hook, rope bridge high above, 2 ledges, rocks, 2 low walls, skiff. Excellent match and the clearest silhouette in the mission. | KEEP |
| ts2 | Hive-Tainted Warrens | Hive-tainted Fallen warrens (verify) | 9 shanties from a hand list (left and right columns at x=-22..-34 and 33..34 mirrored, plus 2 front), 2 scrap canopies, 7 hive growths, 2 chitin arches, 8 random-polar egg sacs. Wide open yard, mirrored huts. Warrens should be tight; this is a field. | REBUILD (brief below) |
| ts2 | The Mindbender's Cavern (boss) | Mindbender's ritual cavern (Reksis Vahn; verify) | K.room 56 x 52 with stuffed rock mass above, 14 random cave rocks, 12 random stalactites, ritual rings, consoles mirrored, shock pylons mirrored, 4 round pillars at corners, servitor ico hanging. A rectangle with decor. The ritual ring and servitor are a decent center. | TWEAK: shape irregular walls with large inward bulges, add a raised ritual dais loop with two asymmetric entries, reduce mirrored consoles |
| ts3 | Jetsam of Saturn | Jetsam of Saturn (patrol zone of crashed ships; verify) | Giant listing ketch on the west edge, buried freighter bow, engine section on its side, skiff, hull ribs, ~13 scattered plates and 6 fires, K.scatter rocks. Large wrecks are good landmarks. The middle is plates at random orientation. | TWEAK: arrange plates into a path of broken hull-corridor, centre a crashed-ship spine that forms a lane, drop scatter rocks |
| ts3 | Scorn Encampment | Scorn camp, bone-and-scrap palisade around an ether source (verify) | Ring of 14 spike barricades r=24 (two gaps), ring of 7 totems r=15 jittered, 3 outer totems, 4 shanties, 3 ether cans, 2 banners, K.scatter cover, one lookout. This is a ring of spikes plus a ring of totems, the same composition as the boss arena. | REBUILD (brief below) |
| ts3 | The Fanatic's Approach | Approach to Fikrul (Scorn procession; verify) | Two walls of 4 leaning hull plates each (mirrored rows), 9 totems at hand coordinates, 4 loose plates, chained wreck gate. Corridor shape is clear; totems look scattered rather than processional. | TWEAK: line totems along the axis with a rhythm, add Scorn gate banners, give the corridor one pinch point and one wide pocket |
| ts3 | Fikrul's Ether Spire (boss) | Scorn arena around an ether spire (verify) | 76 x 64 hull-walled room; tall ether spire at (0,-241) (very good landmark: stacked drums, orb, horns, tanks, cables), ring of plates/spikes r=30 with gaps, 6 totems, 2 mirrored firing decks. | KEEP (TWEAK: break the ring regularity; one firing deck) |

## 3. REBUILD briefs

### io2 / Echo Mesa (zone center 18,-88)
Problem: two parallel 46 m bulwark lines (z=-68, z=-108) with the same gaps, banners and posts; mesas pushed to x=+-60..75. No Echo Mesa silhouette.
Brief:
1. Layout: a canyon shelf. Put one big central mesa (about 28 x 24, 12 to 14 m high, with a ramp/stairs on its south end) at (28,-92). The player route runs around its west side through a 14 m lane; the east side is a narrower 8 m lane closed by a single short bulwark with one gate.
2. Landmarks: the central mesa topped with a Legion gun emplacement and a banner; a Cabal bulwark chicane (2 short offset walls, not parallel) at the mouth of the zone; a big rock "echo" arch on the west.
3. Sight lines: from the zone entrance only the mesa face and the chicane are visible; the overwatch gun on top is visible from the lane, so the player is forced to use the walls for cover.
4. Cover: staggered Cabal barricades near the mesa foot; fallen mesa chunks (use K.rock big); drop all pairs of mirrored hazard posts.
5. Connections: south end opens from Terrabase (route x=-30 to 10), north end narrows to the Landing Pads at (-22,-152) via a ramp past the west mesa.

### t1 / The Rig (zone center 30,-35)
Problem: scatter of container stacks and no derrick; the name "Rig" has no signature structure.
Brief:
1. Layout: a working oil rig deck. Place a derrick/drill tower (30 to 40 m, lattice, flare stack beside it) at (30,-35) as the signature, ringed by a raised walkway.
2. Landmarks: derrick, flare with glow, two cranes (keep), pipe racks converging on the derrick like spokes.
3. Cover: container stacks arranged in 3 parallel lanes (rows with gaps), not random; 2 low tank clusters; a catwalk with stairs on the east.
4. Sight lines: the derrick blocks the central line; lanes channel the player to Siren's Watch to the northwest.
5. Connections: the spawn deck at z=20 leads into lane 1; keep exit toward (-25,-90).

### io1 / Lost Oasis (zone center -8,-42)
Problem: 8 pools, 5 geysers, 16 spires, 6 mounds, scatter rocks, all evenly spread over a 160 m field.
Brief:
1. Layout: a sunken oasis basin about 60 m across. One large teal lake (r=14) in the center with a crusted rim; the route is a curved shore path around the east side.
2. Landmarks: a ruined Traveler-light arch or shrine on the far shore; a single big geyser column behind the lake as a beacon.
3. Cover: 3 clusters of spires (3 to 5 each) and mounds on the shore, not scattered over the field; geysers kept to 2 and used as hazards/steam concealment.
4. Sight lines: lake is open sky; the far shrine is visible from the spawn; clusters break the line.
5. Connections: spawn at (0,18) enters from the south; exit narrows between two big spire clusters into the Giant's Scar canyon at (6,-112).

### t3 / Arcology Underbelly (zone center -20,-160)
Problem: 27 stilts on an exact 7 x 4 grid with identical amber rings; overhead beams on a grid.
Brief:
1. Layout: a huge support structure under the hull. Replace the grid with 4 to 5 colossal support columns (r=4 to 5, 14 m) in an irregular cluster plus a few thin stilts clumped near them.
2. Landmarks: a vertical service shaft with lift cage and a hanging pipe bundle; a collapsed walkway tilted across the platform.
3. Cover: columns with ring ledges; a central maintenance catwalk raised on K.platform with two stairs; clumps of pipes and hive growth at the base of columns.
4. Sight lines: columns obstruct long shots along z; the lift shaft is the main orientation point.
5. Connections: north bridge at x 14..26, z -135; exit west to the Hive Nest bridge at (-42..-28, -188..-200).

### ts2 / Hive-Tainted Warrens (zone center 10,-180)
Problem: wide open yard, 9 huts in mirrored columns, 7 random growths, egg sacs placed by random polar coords.
Brief:
1. Layout: a maze-like lair. Fill the 80 m wide space with 3 interlocking clusters of huts joined by tarps and chitin arches, forming 3 narrow lanes (5 to 6 m) and 1 central chamber (14 m).
2. Landmarks: a giant Hive-grown central egg mound (chitin dome with green glow) in the center chamber; a tall canopy of scrap and chitin over the entrance lane.
3. Cover: huts at different angles and heights, some tipped; egg sacs only inside huts and under canopies (purposeful), not random.
4. Sight lines: blocked by clusters; only the central mound and the cavern gate are visible from inside the lanes.
5. Connections: gorge mouth at (0,-160) feeds all lanes; the cavern gate at (0,-224) is visible at the end of the central lane.

### ts3 / Scorn Encampment (zone center 26,-96)
Problem: ring of spikes plus ring of totems; same composition as the boss arena.
Brief:
1. Layout: a bone-and-scrap hold on a rise. Build it as a rectangle palisade (about 40 x 30) with 2 gates (south and west) and an inner raised bone scaffold, instead of a ring.
2. Landmarks: a central ether pylon (tall, glowing) with ether cans clustered around it; a skull/horn gate arch at the main gate.
3. Cover: spike barricades as short straight runs forming a funnel inside the gate; totems only at the gate and the pylon; small huts along the back wall.
4. Sight lines: the pylon glow visible from the Jetsam wreck field; palisade blocks view of the inside until the player is at the gate.
5. Connections: entry from the wreck field at the southwest (-30,-45); exit northwest toward the Approach corridor at (-8,-130).

## 4. Shared-layout / shared-landmark flags (summary)

- Boss-arena template shared: io3 Protheon, t1 Helipad, t2 Containment Lab, t3 Choir, ts3 Spire (mirrored side decks + south door).
- Ring composition shared: io1 Rupture, ts1 Scrapyard, ts3 Encampment, ts3 Spire.
- Pillar-grid shared: io3 Conduit, io3 Gate, io3 Chamber, t2 Interior, t3 Underbelly, t3 Choir.
- Titan exterior kit shared: t1 Plaza, t2 facade, t3 Underbelly (all arco() with amber bands). The Rig (t1) and The Methane Sea (t3) are the same prop set (stacks, crane, tank, pipe).
- Tangled: Trapper's Cave camp, Warrens and Scorn Encampment all rely on shanty()+hiveGrowth()/totem scatter; cliffRun terrain is shared by ts1 and ts2.

## 5. Elevation and rhythm (second pass)

Note: these three destinations hold 9 missions (io1-3, t1-3, ts1-3), not 10.

Engine facts used (js/world.js makeKit): K.platform is a SOLID box (so nothing is walkable underneath) with K.stairs at 0.4 m steps / 0.6 m run, so a 3 m deck needs a 4.5 m run per flight and a 2.4 m deck about 3.6 m. A "bridge" is a long thin solid platform; the ground below is blocked, so use bridges over gaps that are already blocked (rock, sea, a pit made of colliders), not over open floor you want to fight under. Every existing deck in these files is 6 to 14 m wide, 2.4 to 3.2 m high, with stairs 2.4 to 4 m wide, reached off to the side. Those are optional perches, not routes. Main-route stairs need 5 m wide (stairW: 5).

Profile today (all 9 missions): ground at 0 for the whole route. Elevation exists only as optional side decks (2.4 to 3.2 m) and scenery (towers, pyramid, dome, cliffs, none enterable). No mission has a forced climb or descent.

Rhythm vocabulary: A = area + combat, T = traversal (no combat), CT = combat during traversal, N = new area reveal.

### io1 Sacred Ground
1. Elevation today: flat. Rim ledges at 2.8 m on the Rupture and one west ledge (2.8 m) in the Scar; all optional.
2. Rhythm: Lost Oasis (A, open) -> straight walk (T, short, empty gap z -60 to -76) -> Giant's Scar (A and T blended, but nothing happens while walking the canyon except the combat zone at its center) -> Light gate (N) -> Rupture (A). Traversal with no combat: Oasis to Scar. Combat with no traversal: Oasis and Rupture are pure stand-and-fight.
3. Proposal:
   - Lost Oasis stays OPEN (flat sulfur basin is the Io identity); merge with the REBUILD brief (lake, shore path). Add one 2.4 m crusted shelf on the far shore with 5 m stairs as the one high ground.
   - Giant's Scar becomes the climb: two stepped rock terraces (K.platform 2.4 m then 4.8 m stacked, stairW 5) forming a switchback up the west wall mid-canyon, with the glowing crack on the low side. Traversal with combat: Taken or Cabal patrol on the terraces. The rib arches sit over the top terrace so the player walks "under the skeleton".
   - Rupture: enter via a 5 m wide stair DOWN feel by building the rim as a raised ring (3.6 m rim ledge you walk along) and the fissure floor at 0, so the player descends into the crater from the gate. Keep the existing light gate as the lip.
   - Do NOT add interiors; this mission is open and exposed.

### io2 Echo Mesa
1. Elevation today: flat; a Legion deck at 2.8 m, pads at 2 to 3 m (landing platforms are solid blocks with stairs), east gantry 2.8 m at the Drill.
2. Rhythm: Terrabase (A) -> straight to bulwarks (T/CT blur, no distinct traversal) -> Landing Pads (A) -> blast door (N) -> Drill (A). No true traversal beat; combat with no traversal in every zone.
3. Proposal:
   - Terrabase Charon: one interior. Make the big lab slab from the TWEAK brief a roofed K.room (about 24 x 18 m, two doors) that the route passes through, with a catwalk (2.8 m, stairW 5) along the inner wall. Combat inside, then spills into the courtyard.
   - Echo Mesa: merge with the REBUILD brief. The central mesa is the elevation: a 4.8 m two-tier mesa (2.4 + 2.4 stacked, 5 m stairs on the south), Legion gun on top. Optional route over its top; main route in the lane below. Traversal beat: a short ramp-stair climb along the west lane up to a 2.4 m shelf and down the far side into the pads (T with a Legion gunship pass).
   - Landing Pads: keep open, but the anchor pad is 4.8 m high with stairs; threshers hover over open floor.
   - Drill: keep the walled compound; add a lift-gantry ring at 2.8 m on two sides (not mirrored) and make the east gantry a 5 m wide stair-up to a firing deck above the boss floor. No more interior.
   - Where it would NOT fit: Landing Pads floor (needs open lines for the thresher fight).

### io3 The Pyramidion
1. Elevation today: flat; 1 m and 0.9 m dig walls, overlook decks 2.8 m, Vex gallery decks 2.8 m, 95 m pyramid is scenery.
2. Rhythm: Excavation (A) -> Conduit (A and interior T: it is a 58 m roofed hall, effectively the traversal but with its own combat zone in the middle) -> Gate plaza (A) -> chamber (A). Best rhythm of the batch, but no climb or descent anywhere.
3. Proposal:
   - Excavation Site XII is the descent: make the irregular pit (from TWEAK) a real terraced bowl: ring of 2.4 m ledges stepping down toward the pit center is impossible (ground fixed at 0), so invert it: the pit floor is the ground and the rim is 4.8 m (two 2.4 m stacked rings) built as solid terraces around it, with 5 m stairs down into the pit on two sides. The player enters at rim height from spawn side? Spawn is at ground. Instead raise the spawn approach: 5 m stairs UP to a rim walkway, walk the rim (CT with Legion crew), then 5 m stairs down into the pit (A). That reads as a descent.
   - Aphix Conduit stays an interior nave (already roofed); add one raised Vex bridge/walkway at 2.8 m across the middle (long thin platform, stairW 5) as the sniper route.
   - Pyramidion Gate: the portal sits on a 3.6 m Vex stepped plinth with a wide 5 m ceremonial stair, so the final approach climbs into the gate. Keep plaza floor open for the fight.
   - Chamber stays one level plus galleries (asymmetric).
   - Where not: Conduit floor (no extra levels beyond the one walkway), Chamber floor.

### t1 Hope
1. Elevation today: flat deck; crane catwalk 2.4 m, Siren's Watch walkway deck 1.6 m, plaza overlook 2.4 m, 10 m skybridge (visual only), hangar firing decks 3 m.
2. Rhythm: Rig (A) -> run to Siren's Watch (T, empty 40+ m of flat deck) -> Watch (A) -> Plaza (A) -> hangar door (N) -> Helipad (A). Traversal is empty deck walking; no combat during traversal.
3. Proposal:
   - The Rig: merge with REBUILD (derrick, container lanes). Elevation: the derrick sits on a 3.6 m drill floor with 5 m stairs (two flights, one landing), combat on both levels; pipes/cranes frame it.
   - Siren's Watch to Plaza traversal: a raised service gantry (3.6 m, 5 m wide, 40 m long, K.platform thin, solid so the lane below is blocked on its length; use only along an existing edge or between two container rows) with Hive-infested interiors off it. This is the CT beat.
   - Siren's Watch: tower base becomes enterable: a roofed K.room (14 x 14, two doors) at the tower base, with the walkway deck as its roof terrace reached by 5 m stairs. Keep the rest open.
   - Arcology Plaza: interior option: one ground-floor lobby (roofed, K.room 24 x 14) cutting into the west block, so the fight can move through the building. Keep the square open.
   - Helipad: keep (closed hangar already). Open one wall to the sea as in TWEAK.
   - Where not: the Rig floor around the derrick and the Plaza square stay open for long sight lines in the storm.

### t2 The Sunken Labs
1. Elevation today: flat; four roofed rooms in a line; mezzanines 3 to 3.2 m; control deck 2.4 m. Nothing sunken.
2. Rhythm: Interior (A) -> short corridor (T, ~6 m, nothing) -> Solarium (A) -> corridor (T, ~8 m) -> Labs (A) -> corridor -> Containment (A). Uniform A / short T / A. The only traversals are 6 to 8 m corridors, they never contain combat, climb or descent.
3. Proposal (this mission is where interiors belong, but the engine cannot descend):
   - Fake the descent with height instead: the entry hall is at ground; the Solarium is the high point (a raised ring balcony at 3.6 m around the dome rim, reached by 5 m stairs); the "sunken" part is represented by the Labs being the LOW floor and every earlier room being raised: put the first two rooms on a 2.4 m raised floor (K.platform base under each K.room; stairs 5 m at the corridor ends) so the route steps DOWN twice (via stairs placed on the exit side) and the Labs/Containment are at 0. That gives genuine down-stairs and justifies the name.
   - Replace one 6 to 8 m corridor with a real traversal beat: a 30 m service tunnel with a dogleg and a collapsed section, with 4 to 6 Hive thralls or a Knight, so there is combat during traversal.
   - Break the single axis: shift the Flooded Labs 14 m east of the axis and connect via an L-shaped corridor so the sequence is not four rooms in a line.
   - Where not: Solarium floor (open dome atrium), Containment Lab floor.

### t3 Savathûn's Song
1. Elevation today: flat platforms over a sea of colliders; hub overlook 2.4 m, service deck 2.8 m, balconies 3.2 m. Underbelly roof is 14 m.
2. Rhythm: Methane Sea platform (A) -> Spine bridge (T, 28 m bridge x2, no combat) -> hub (A) -> bridge (T) -> Underbelly (A) -> nest bridge (T, 12 m) -> Nest (A) -> throne (A). Best A/T alternation in the batch; the bridges are the traversal but they are empty and flat, and the strip walls (sea colliders) give no sense of height.
3. Proposal:
   - Make the Spine of Keres the vertical piece: the first Spine bridge climbs. Build it as three stacked segments: 1.2 m, 2.4 m, 3.6 m bridge decks with 5 m stairs between, ending at the hub on a 3.6 m raised hub deck. Combat during traversal: Hive Acolytes or Knights rushing the bridge, ledges with Wizards.
   - The second bridge (hub to Underbelly) descends: stairs down to 0 under the hull, to sell "going under the city". Merge with the Underbelly REBUILD: lift shaft and raised maintenance catwalk at 3.6 m.
   - Hive Nest: a sunken-feeling pit via a raised rim: the platform edge is a 2.4 m ring of chitin, the center floor at 0, 5 m stairs down at the bridge arrival. Existing rib arches become the procession.
   - Throne: stay as is; replace one balcony with a stepped choir loft (2 x 1.8 m tiers).
   - Where not: Methane Sea platform (keep flat and open with the derrick/flare as the vertical landmark), throne hall floor.

### ts1 The Trickster
1. Elevation today: flat; Spider's lookout 2.4 m, smugglers' ledge 2.4 m, scrap gantry 2.4 m, boss stage 1.6 m. The "town" has 3 to 7 m shanties (some with upper boxes) that cannot be entered.
2. Rhythm: Landing pad -> shanty alley (T/CT: it is the main alley, good) -> Thieves' Landing market square (A) -> east exit -> cove (A) -> hole wall (N) -> scrapyard (A). Traversal in the alley has combat potential but combat zones only fire inside the three zone radii.
3. Proposal:
   - Thieves' Landing is where interiors fit best: make 2 of the shanties enterable shops (small K.room 8 x 8 with two doors) the player can cut through; and add a 3.6 m two-level rooftop route on the east alley (solid decks with 5 m stairs, lantern strings across). Keep the market square flat.
   - Cove: merge with the crescent-cove brief; the cove floor sits at 0 beneath a 4.8 m rock shelf on the north side with the holed wall's two walkable holes as tunnels (roofed passages 8 m long). The tunnels are the traversal-with-combat beat.
   - Scrapyard: merge with wreck lanes; add a 3.6 m crane gantry along the north wall (5 m stairs) and make the dais the boss's high ground.
   - Where not: the market square floor, scrapyard center (minefield lane).

### ts2 The Mindbender
1. Elevation today: flat; gorge ledges 2.4 m (two), dais 2.4 m, rope bridge and chains are decor at 20 m.
2. Rhythm: Trapper's Cave (A) -> gorge entry (T) -> Rift (A, in a gorge) -> Warrens (A) -> cavern door (N) -> Cavern (A). "Rift" is the only traversal-like space and it is also a combat zone, so there is no non-combat breather or climb.
3. Proposal:
   - Trapper's Cave: the cave mouth becomes real: a roofed tunnel K.room (10 x 22) into the cliff, with a 2.4 m ledge inside overlooking the camp; one route goes through it (combat in the cave), another around.
   - The Rift: make the rope bridge a real traversable crossing at 3.6 m: a thin solid bridge deck with 5 m stairs on each gorge wall via two terraces (2 stacked 1.8 m ledges per side). Players can cross for sniper positions while the main lane below carries the fight (CT beat).
   - Warrens: merge with the REBUILD (maze). Use two roofed hut clusters as interiors (K.room 10 x 8 each) and a central 2.4 m Hive mound platform.
   - Cavern: keep roofed; the dais at the back becomes a 3.6 m two-step platform with 5 m stairs.
   - Where not: Trapper's open firing lane, the Rift floor (needs the chain-span sky).

### ts3 Scorned
1. Elevation today: flat; Scorn lookout 2.4 m, firing decks 2.8 m; wrecks (ketch tilt 0.32 rad, bow at 0.55 rad, up to 30 m) are scenery with collider boxes.
2. Rhythm: Jetsam (A) -> walk to Encampment (T, empty wreck field) -> Encampment (A) -> Approach (T/CT, procession corridor between hull plates, but combat zone sits in the middle) -> spire door (N) -> Spire (A). Reasonable, but the first traversal is empty and everything is flat.
3. Proposal:
   - Jetsam of Saturn: let the player enter a wreck: turn the listing ketch into a roofed hull passage (K.room 8 x 30 with a 2.4 m upper catwalk) that is the shortcut/flank route. The main route stays on the field. Traversal with combat: Scorn Chittering in the hull.
   - Encampment (merge with the REBUILD): palisade with a 3.6 m bone scaffold inside (5 m stairs), pylon at the center.
   - Approach: the corridor climbs: two 1.8 m terraces (5 m stairs) so the player rises toward the arena gate; Scorn lookouts on the plates' tops. This is the "new area" ramp-up.
   - Spire arena: single firing deck (not two) at 2.8 m; keep the floor open around the spire.
   - Where not: the wreck-field middle (open lanes), the arena floor.

### Summary of where interiors/verticality should NOT go
Flat and open on purpose: io1 Lost Oasis and Rupture floor, io2 Landing Pads floor, io3 Conduit floor, t1 Rig floor and Plaza square, t2 Solarium and Containment floors, t3 Methane Sea platform and throne floor, ts1 market square and scrapyard center, ts2 Rift floor, ts3 wreck-field middle and arena floor. Interiors suit: io2 Terrabase, t1 Siren's Watch base and Plaza lobby, t2 (everything), ts1 Thieves' Landing shops and cove tunnels, ts2 cave mouth and Warrens huts, ts3 ketch hull.
