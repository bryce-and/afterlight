# Audit: Earth, Moon, Mars (js/level-earth.js, level-moon.js, level-mars.js)

Method: read all three level files in full plus the LOCATIONS entries in js/data.js and the destinations skill. Nothing was run in a browser, so all verdicts are from the source (coordinates, kit calls, spacing), not from screenshots. Where I am not sure of the real Destiny layout I say "verify".

Zone-to-zone distances below are measured against the 24 m activation radius (28 m boss) from the zone center in each mission's `zones` array.

## Cross-cutting findings (these matter more than any single zone)

1. **One boss-room template used five times.** A roofed or walled rectangle, two mirrored side balconies/galleries 4 to 6 m up with stairs at the entrance end, a row of pillars each side, a raised dais with a throne at the far end, braziers or floods, one sealed door on the south side. Instances: e3 The Lair, m2 Chamber of Night, m3 Throne of Crota, r2 Throne Hangar, and (walled-yard variant with mirrored side decks) e1 The Wall, e2 The Array. m2 Chamber of Night and m3 Throne of Crota are near copies: 50x64 vs 64x60 room, pillar rows at x=-26/6 (z step 10) vs x=4/56 (z step 12), vault ribs every 10 vs 8, side galleries 4.0 m up with 3 m stairs from the entrance end, dais at the north end, spires and braziers flanking it.
2. **The "optional high ground" deck is stamped into nearly every zone**: `K.platform(... 8 wide, 10 to 26 long, 2.0 to 2.8 high, one stair)` plus a thin rail strip plus one K.light, usually in a mirrored pair. Count: e1 x3, e2 x3, e3 x4, m1 x3, m2 x6, m3 x4, r1 x4, r2 x3, r3 x5. It reads as box-ticking rather than as part of the place. Keep them where the real place has tiers; drop or merge elsewhere.
3. **Hive facade copy**: m1 Gate of Oryx facade and m2 Temple of Crota wall are the same build: a long `hiveWall` with ribs, a `pointedArch` gateway, and mirrored spire pairs (11.5/28/48/70 vs 12/34/58/80 m). m2 then builds a third wall of the same type at z=-168.
4. **Cabal drop pods and supply stacks are the universal filler.** `dropPod` appears in r1 (about 10), r2 (4), r3 (7) and `supply` about 40 times. Placement is hand-listed coordinates with no pattern, so it reads as random. Pods should mark a landing event (a ring, a line along an approach vector), not fill space.
5. **Jittered-grid scatter**: r2 Scablands cliffs (13 m grid with +-3 m jitter at 85 percent), r3 Valley of Kings cliffs (9 m column each side), e1 car lots (2.7 m spacing rows at 65 to 70 percent), e3 Devils' Halls pillars (2 columns x 5 rows), r3 flagship checker floor (4x4 tiles). These are the strongest "AI random" tells.
6. **Duplicate zone name**: r1 and r2 both have a zone called "The Scablands" with overlapping content (cliffs, rock scatter, bulwark picket, pods, supply, deck, turret). Rename or differentiate.
7. **Mission text vs map**: m1 `desc` says "into the Hive tunnels" but the map has no tunnels (open plains, a base, a plaza; the cave mouth is a prop 80 m from any zone center).
8. **Landmarks outside the fight**: m2 Hellmouth pit center (26,-146) is 45 m from the zone center (-14,-125), so combat never happens at the landmark. m1 cave mouth (55,-46) vs Archer's Line center (-25,-55): 80 m.

---

## EARTH (Cosmodrome, Fallen vs Golden Age ruins)

### e1 "A Guardian Rises" (dawn)

| Zone | Imitates | Currently builds | Verdict |
|---|---|---|---|
| The Steppes (0,85) | D1 Cosmodrome patrol, the Steppes: broken highway, rusted cars, overpass | Open 18 m highway strip with centre paint, a collapsed overpass (two spans plus tilted slab, walk-through), 7 piers, power-line row, 8 pine stands, two car lots. Cars are lane-based with a "never block more than 2 of 4 lanes" rule, so the jam is designed. Large scale, strong silhouette (overpass + pylons) | TWEAK |
| Skywatch (35,15) | D1 Skywatch radar field (dish park) | Fenced 68x62 compound, 4 big dishes plus 3 small dishes on a pad, 3 bunkers, a mast, stair-to-bunker-roof. Cover is 5 barriers, 1 container, 3 crates hand-dropped at about (26 to 45, 4 to 28) | TWEAK |
| The Wall (8,-58) boss | D1 The Wall (Cosmodrome colony-ship hangar doors, Riksis) | 260 m concrete face with giant hangar doors (strong landmark), walled 68x54 yard, one gate, crashed skiff, 2 mirrored decks, ~10 fcrates/containers/barriers scattered | TWEAK |

- Steppes TWEAK: the two car lots are literal rows at fixed z (128/142 and 72) with 2.7 m spacing and random dropout, which reads as a parking lot, not a graveyard. Replace with 2 or 3 clumped piles pushed against the highway edge and the overpass shadow; leave the lane jam as is. Keep the overpass.
- Skywatch TWEAK: the dishes are the landmark and they work. The cover list is the weak part: replace the 5 barriers + crates with cover that hugs the dishes and bunkers (a sandbag arc behind each big dish, a container wall to make a channel from gate to bunker). Big dish `dish()` is reused in the e2 Array, so give Skywatch one unique silhouette (a tall lattice tower or the "Skywatch" tower) and keep dishes small/medium here.
- The Wall TWEAK: door face and skiff are good. The yard is the same template as e2 Array (walls, one gate with two posts, mirrored decks at z=-62 on both walls, corner floods). Break the mirror: one deck only, turn the other side into the skiff wreck zone; move the container stack from the east wall to flank the gate.

### e2 "The Last Array" (day)

| Zone | Imitates | Currently builds | Verdict |
|---|---|---|---|
| The Divide (0,78) | D1 Cosmodrome Divide: long canyon between huge concrete walls | 200 m corridor, walls 17 to 26 m high, width pinching 20 to 34 to 16 m, horizontal pipes, overhead cross pipes and a hanging catwalk. Cover: container, valves, barriers, shield pairs at the choke, 2 cars. Wall slabs have random height/colour and pipes on every slab | TWEAK |
| Rocketyard (-8,8) | D1 Cosmodrome Rocketyard: launch gantries, a standing rocket, tanks, rail spur | 110x76 yard, standing rocket with 4 boosters (40 m, great silhouette), 2 gantries, 2 sphere tanks, 2 horizontal tanks, 2 cranes, rail spur with 2 wagons, ~14 containers/barriers/crates, one deck | TWEAK |
| The Array (5,-68) boss | The Last Array strike: Rasputin's dish field, Sepiks Prime | Walled 78x69 compound with one gate, giant 16 m dish at the north end, 4 dishes, 2 bunkers, 4 masts, 2 decks (mirrored), ring of 6 barriers/boxes at r=14 around the centre | TWEAK |

- Divide TWEAK: composition is right (this is the one e2 zone that reads as a corridor). Fix: the pipe/lamp per slab is repetitive; keep pipes but bundle them (3 pipes at different heights, one slab in four gets a breach or a collapsed pipe). The junction cover is a loose list (container, valve x2, shield x2, barrier x2, crates, fcrate); reduce to 2 clusters that create a left lane and a right lane with a gap, so the hold position is readable.
- Rocketyard TWEAK: the rocket+gantry silhouette is the best landmark in Earth. Problem: it sits at (30,-14), 44 m from the zone center (-8,8), so enemies spawn near the scatter, not the rocket. Move zone center to about (14,-6) or move the rocket pad nearer (x 10 to 16). Cover around the old center is five random pieces (barrier x2, container, crate, fcrate). Rebuild the cover as a launch-pad apron: containers in an L around the pad, rail wagons as a wall on the south.
- The Array TWEAK: the 6-piece cover ring at r=14 is a generated ring (alternating barrier / glow box by `k%2`), which reads as AI-symmetric. Replace with 3 hand-placed slabs of different sizes between the big dish and the gate. Gate/deck/flood template matches e1 The Wall; mirror-break as above. Also: Sepiks Prime is Fallen but the compound has no Fallen touches except nothing (no banners, no shields). Add a few Fallen scrap elements (shield barricades, banner) at the gate so the faction reads.

### e3 "The Devils' Lair" (dusk)

| Zone | Imitates | Currently builds | Verdict |
|---|---|---|---|
| The Mothyards (-40,112) | D1 Cosmodrome Mothyard: wrecked airliners and hangars | 3 hangar shells, 6 fuselage hulks (all lie along z), pines, a loader, a few crates. Dense, 130 x 100 m field | TWEAK |
| Lunar Complex (0,52) | Cosmodrome ruins leading to the Devils' Lair (verify exact name; the Lair strike passes through Cosmodrome industrial ruins) | 180 m facade with a sealed breach, west and east ruined factory boxes with the same pattern (22x40 ruinWall rectangle, gaps, rust trusses), a smokestack each side, conveyor bridge, sphere tank | TWEAK |
| Devils' Halls (10,-12) | Fallen halls in the Lair approach | Roofed 44x62 hall, 2 columns x 5 pillars at x=0 and x=20 (z -32..14, 12 m spacing) each with an alternating red/blue glow band, 2 mirrored platforms, shields/crates sprinkled, cloth banners on both walls every 16 m | REBUILD |
| The Lair (10,-83) boss | D1 Devils' Lair strike: Draksis, Winter Kell | Roofed 64x62 chamber, ring of 8 pillars at r=17, central octagonal dais, 2 side balconies 6 m up, throne platform at the back | TWEAK |

- Mothyards TWEAK: every hulk lies along z at similar angles and offsets (-66, -66, -16, -14, 18, -34), so it reads as a rack. Rotate 2 or 3 (needs a rotated collider; `K.ocollider` exists now), break one in half, bury one nose-first. Hangars are the only large forms: place the full hangar as the visual gateway to Lunar Complex.
- Lunar Complex TWEAK: west and east factories are copy-paste (same footprint, same gaps rhythm, same lamp). Make the east one a collapsed hangar/launch silo with a fallen crane across it so the two halves differ; keep the breach door. Cover between them is a short list of shields/fcrates/rocks (about 10 items): cluster them into one hold position.
- Devils' Halls REBUILD: a pillar grid with alternating colours, mirrored decks and mirrored banners is the plainest "random-symmetric" room in Earth. It is also the clean-concrete look for a Fallen-held place (Fallen = scrap, banners, blue/orange light).
  Brief: (1) Make it an irregular series of three linked bays (gate bay 24 wide, central hall 36 wide, choke 14 wide) so the fight has a progress shape. (2) Replace pillar grid with two big structural elements: a collapsed ceiling section letting daylight through (a lit shaft landmark) and a Fallen cargo-lift platform raised 2.4 m on the east side. (3) Fallen scrap walls and shield barricades build two lanes; cloth banners only at the entry and exit. (4) Sight lines: long at the entry, broken by the lift mid-hall, closed at the choke. (5) Neighbours: wide opening to the Lunar Complex breach, 12 m door to the Lair corridor.
- The Lair TWEAK: pillar ring + dais + balconies + throne is the best-composed room here and fits the strike. Differentiate from m2/m3/r2: drop the second balcony (keep west only), tilt the throne off the axis, make one section of roof open to the sky.

---

## MOON (Hive castle wall + Golden Age ruins)

### m1 "The Dark Beyond" (night)

| Zone | Imitates | Currently builds | Verdict |
|---|---|---|---|
| Archer's Line (-25,-55) | Moon patrol zone Archer's Line (ridge/ravine approach with Golden Age ruins) | Flat plains with 17 flat crater discs, 3 rover wrecks, a fallen antenna, 3 antennas, shed, 5 cover + 3 props in a 40 m patch, a deck. Cave mouth carved into the eastern cliff at x=55 | REBUILD |
| Anchor of Light (20,-118) | Moon patrol zone Anchor of Light (Golden Age station with Hive growths) | Pad ring (r=10) with 10 lights, 4 domes, 3 modules, 3 tubes, 2 antennas, jersey barriers, K.scatter crates around the pad, bone spikes and crystals | TWEAK |
| Gate of Oryx (0,-186) boss | Gate of Oryx (Hive temple gateway on the Moon) | U-shaped plaza, 70 m wide, 3 m thick castle wall with a recessed arch, ziggurat steps, 4 pairs of tall spires (46, 34, 28, 22 m), braziers, 2 flank decks, 5 broken pillars + 2 low walls | TWEAK |

- Archer's Line REBUILD: no readable silhouette. Scattered craters and rovers on a flat plain, with the cave mouth (the only Hive landmark and the thing the mission premise needs) outside the activation circle.
  Brief: (1) Make it a shallow ravine: two low ridge walls (rock slabs 4 to 6 m high) 28 m apart running roughly north-south, with the Golden Age array at the near end and the cave mouth carved into the far end. (2) Landmarks: the antenna trio on the west ridge as an overlook, a downed lander in the middle as the central cover block. (3) Sight lines: long along the ravine, broken by the lander; ridges give cover on both flanks. (4) Cover: wrecks lined along the ravine floor, not scattered; crater discs only 4 or 5 and as the fight floor. (5) Neighbours: open south into the spawn plain, and shift the zone center east or move the cave mouth west so the mouth is inside the zone; the exit is a Hive cairn path leading to Anchor of Light.
- Anchor of Light TWEAK: the pad + domes + modules layout is fine and reads as a station. Fix: the crate K.scatter around the pad and the 5 bone-spike/crystal lists are random; hand-place two cover rings and run the Hive growth as one infected side (east dome) instead of everywhere. Also add one tall unique landmark (the "Anchor" itself: a tall Golden Age beacon tower).
- Gate of Oryx TWEAK: the strongest boss composition on the Moon. Problem: it is the same facade build as m2 Temple of Crota (see cross-cutting). Differentiate by making Gate of Oryx a descending pit/stair into a dark gateway (stairs go down visually via lower floor plate) and giving m2 the standing wall; and cut the mirrored flank decks to one side. Mission-name mismatch: "The Dark Beyond" is a tunnel/cave story, yet the boss plaza is open to the sky; consider roofing the plaza partially.

### m2 "Chamber of Night" (night)

| Zone | Imitates | Currently builds | Verdict |
|---|---|---|---|
| Temple of Crota (0,-48) | Temple of Crota approach on the Moon | Processional braziers, a courtyard with 2 diagonal mirrored platforms, 5 broken pillars, 2 crystal clusters, one huge ribbed wall with arch and 4 pairs of spires | TWEAK |
| The Hellmouth (-14,-125) | Moon patrol zone Hellmouth (huge Hive pit) | Pit at (26,-146) r=15 with rings, ringed by 34 wall segments and 7 giant teeth, solid collider fill; the zone itself is the gap west of it with 6 broken pillars and props | REBUILD |
| Hive Tunnels (-30,-200) | Hive tunnels leading to the chamber | 11 m entry tunnel, a 44x42 roofed junction hall with a bone-ribbed bridge 3.6 m up and two long galleries, 4 pillars, crystals, floor glyphs, 15 m exit tunnel | TWEAK |
| Chamber of Night (-10,-268) boss | Chamber of Night (Omnigul, Will of Crota) | 50x64 cathedral, 2 x 5 pillar rows, vault ribs, slit windows, 4 braziers, raised altar, side galleries 4 m up | TWEAK |

- Temple of Crota TWEAK: wall is a copy of m1 Gate of Oryx; the courtyard cover is a hand list of 5 pillars + 3 spike clusters + 2 crystals scattered across 60 m. Make the temple a stepped forecourt: two staircase terraces climbing toward the gate (a visible ascent), pillar rows lining the processional, cover as fallen pieces of the wall.
- The Hellmouth REBUILD: the pit is the entire reason this zone exists, but combat happens 45 m west of it. Also the pit is a flat disc under a solid collider: walkable ring is the only interaction.
  Brief: (1) Put the zone center on the pit rim (about (0,-140)) so the 7 to 19 m spawn ring sits on the path around the pit. (2) Make the pit the arena: a 4 m wide crescent walkway on the near half, a broken span bridging to a 14x14 island on the far side (use void colliders as in m3 Bridge). (3) Landmarks: giant bone teeth over the pit, a ring of braziers on the island. (4) Sight lines: open across the pit (long), cover on the near rim and on the island. (5) Neighbours: wide from the temple door, a 9 m gap east side to the cliff wall and tunnel mouth at (-30,-166).
- Hive Tunnels TWEAK: this is the best multi-level space on the Moon (bridge + galleries). "Tunnels" is only two short stubs; make the entry tunnel 25 m with a kink (use two wall segments offset in x) and add rubble choke. 4 pillars arranged in a rectangle is grid-like: shift two off-grid.
- Chamber of Night TWEAK: reads as a Hive cathedral and fits the name. Fine, but it is the same room as m3 Throne of Crota (see below). Keep Chamber as the long nave cathedral; rebuild the Throne room differently.

### m3 "Crota's End" (storm)

| Zone | Imitates | Currently builds | Verdict |
|---|---|---|---|
| The Abyss (-6,-42) | Crota's End raid, The Abyss (dark pit, crossing in the dark) | Roofed box 80x102x12, 6-point lit path, 7 stalagmites, 22 random stalactites, wall ledges, 5 rocks, 2 wall decks | REBUILD |
| The Bridge (0,-118) | Crota's End raid, The Bridge | 20 m wide span, widening to 44 at midspan, 6 void blocks as chasm, parapets with bone spikes, 8 spires rising from the chasm, 7 broken pillars + 2 low blocks as cover | KEEP |
| Deathsinger's Ward (0,-190) | Crota's End, Ir Yut the Deathsinger's chamber | 46x44 roofed room, 7 crystal clusters around the walls, ring of 6 crystals at r=11, 2 floor rings, tunnel to the next room | REBUILD |
| Throne of Crota (30,-262) boss | Crota's End, Crota's throne | 64x60 roofed hall, 2 x 5 pillars, vault ribs, glowing orb on chains, stepped dais, 2 galleries, 5 broken pillars | REBUILD |

- The Abyss REBUILD: the raid's signature (a gaping dark pit crossed on stepping platforms) is currently a lamp-lit walking path across a flat floor with 22 `K.R()` random stalactites (the clearest "random" in the Moon). Brief: (1) Reuse the `voids` technique from the Bridge: collider-block 60 percent of the floor as black pit, leaving 3 to 4 irregular platform islands (8 to 14 m) joined by 5 m-wide Hive bone walkways. (2) Landmarks: one giant stalactite cluster hanging in the centre and a lit lamp column on each island. (3) Sight lines: open across the pit so the player sees the whole fight; cover on islands only (broken pillars, one per island). (4) Fight logic: enemies spawn on islands and cross the walkways; the path of lamps becomes the walkway edge lights. (5) Neighbours: spawn at south island, exit door at the north island (existing door at z=-72).
- The Bridge KEEP: genuinely distinct (long span, chasm spires, widening). Minor: the 7 broken pillars could be 2 hand-placed clusters, but this is optional.
- Deathsinger's Ward REBUILD: a plain box with decorative crystals around the walls plus a 6-crystal ring is symmetric decoration. Brief: (1) Circular ritual hall: replace the 46x44 rectangle with an octagonal chamber (4 wall segments cut at 45 degrees using colliders) about 40 m across. (2) Landmark: a central raised crystal altar (ring platform 1.2 m up, 10 m wide) with a ceiling oculus. (3) Two crystal-lit flanking alcoves (not walls) for cover; clusters sized unevenly. (4) Sight lines: ring walk around the altar; the altar blocks the line between door and exit. (5) Neighbours: south door from the Bridge, north exit tunnel kinked to the throne door.
- Throne of Crota REBUILD: same template as m2 Chamber of Night (see cross-cutting). Brief: (1) Not a nave: make it a round amphitheater, 60 m diameter, with a 14 m radius central pit-ring (collider, as in the Hellmouth), Crota's dais across the pit on the north side, reached by two curved approaches. (2) Landmarks: the green orb above the pit and a ring of 6 sword-shaped bone spires. (3) Sight lines: pit gives open centre; cover as broken pillars on the outer ring. (4) Galleries: replace the pair of long straight galleries with one broken ring ledge on the west arc. (5) Neighbours: door at (12,-232) enters on the south arc.

---

## MARS (Cabal Red Legion over buried Golden Age Clovis Bray)

### r1 "The Buried City" (day)

| Zone | Imitates | Currently builds | Verdict |
|---|---|---|---|
| The Barrens (-12,-45) | Mars patrol zone The Barrens (open red dunes) | 7 dunes, 4 short staggered bulwark walls (two rows), a western ridge wall with 3 pylons, 8 drop pods, 3 supply stacks, a deck, 2 half-sunk towers on the east | TWEAK |
| The Scablands (24,-108) | Mars patrol zone Scablands (broken rock) | 6 cliff columns, 2 rock scatters, K.scatter props, a bunker, a landing pad, 2 turrets, mast, a bulwark, 3 supply, a deck | TWEAK |
| The Buried City (0,-172) | D1 Mars The Buried City (Clovis Bray towers sunk in sand) | 4-way crossroads between 4 corner towers, outer blocks, a toppled tower arching over the west street, bulwark, pods, 2 street decks, 6 rubble boxes, avenue narrowing to the plaza | KEEP |
| The Sunken Plaza (0,-245) boss | Valus Ta'aurc arena (verify: Golden Age plaza in the Buried City) | Stepped 62x62 retaining-wall square with one gate, paved ring and cross inlays, colonnade at (+-13,+-13), 5 lamp posts at (+-24,+-24/-26), camp, 6 leaning towers around | TWEAK |

- Barrens TWEAK: dunes are good; the 8 pods are individually placed at random coordinates and the 4 bulwarks form a regular offset pair-of-pairs. Pods should form a beachhead: a line of 4 landing along an approach vector toward the western ridge, and the bulwarks become one long broken fortification with two gaps instead of four short segments.
- Scablands TWEAK: shares content with r2 Scablands. Make this one rock mesas + a Cabal outpost on a plateau (platform up at 4 m with a ramp), with the pad as landmark and no scattered props.
- Buried City KEEP: the only Mars zone with real street logic (crossroads, avenue, cross street, leaning blocks, a toppled tower to walk under). Minor: the 12 towers all use the same box-with-glass-bands primitive; vary 2 of them with a distinct crown (sloped roof, crane stub).
- Sunken Plaza TWEAK: fits the mission. Symmetry is too tidy: 4 columns at the corners of a perfect square and lamp posts at fixed offsets. Vary heights further (already does), remove 2 of the 4 colonnade posts and one lamp post, shift the camp banner line off axis.

### r2 "Dust Palace" (dusk)

| Zone | Imitates | Currently builds | Verdict |
|---|---|---|---|
| The Scablands (-32,-42) | Mars Scablands gorge approach | West cliff row every 8 m, mid cliff row every 8 m, east cliff grid (13 m spacing with jitter, 85 percent), rock scatter, forward picket (bulwark + turret + 2 pods + 2 supply + deck) | REBUILD |
| The Outer Bulwark (6,-100) | Dust Palace outer wall | One 130 m sloped wall, 14 m high, a 16 m breach, 4 pylons, rubble, tank traps outside (6 in a row), turrets and supply inside, a deck | TWEAK |
| Dust Palace Courtyard (0,-162) | Dust Palace Cabal command post | 96x80 courtyard bounded by two long bulwarks and an inner wall with a sealed gate, 2 landing pads, 1 harvester hulk, 3 turrets, 2 masts, 6 supply stacks, an Operations Hall and a sealed Comms Centre | TWEAK |
| The Throne Hangar (0,-232) boss | Dust Palace Bracus Zahn arena (verify: Cabal throne hangar) | Roofed 56x48 hangar, ribs, gantries, 2 interior pillars, throne platform north with stairs, 2 side balconies, cargo stacks | TWEAK |

- Scablands REBUILD: the cliff placement is a loop with jitter (`x += 13`, `z -= 13`, `chance(0.85)`), which is a perfect grid. It also reads as unrelated cylinders rather than a gorge.
  Brief: (1) Real gorge: two continuous cliff walls built from overlapping slabs (5 to 8 m wide, varied height) that bend: west wall angled in at z=-20, east wall angled out at z=-60 so the gorge mouth opens to a basin. (2) Landmarks: a natural rock arch over the gorge exit (two columns + lintel slab) and a downed Cabal Harvester hull as the fight centre. (3) Sight lines: narrow and long on entry, release into the basin at about z=-45 where the forward picket sits. (4) Cover: tipped rock slabs and wrecks in 2 clusters; picket bulwark facing the entry. (5) Neighbours: opens to the Outer Bulwark's breach with a rubble ramp; change the zone name to something unique ("Dust Gorge" or "The Cleft").
- Outer Bulwark TWEAK: strong single-idea zone (huge wall, one breach, hold). Issue: the zone center (6,-100) is inside a 7 m-thick wall and the breach is only 16 m, so the 7 to 19 m spawn ring is mostly on the wall; move the zone center to about (6,-118) inside the wall or widen the breach to 22. The 6 tank traps are an evenly spaced row (x -46..54, z -82..-90); stagger by depth and tilt two to be knocked over. Turrets inside are a mirrored pair; make one destroyed.
- Courtyard TWEAK: it is a large empty rectangle with two diagonal pads. Add one palace landmark (a command tower or a tiered stairway to the throne hangar with a stepped facade) so the zone says "palace", not "yard". The 6 supply stacks are a hand list; group them to form a central barricade with two gaps. Side halls are good additions.
- Throne Hangar TWEAK: it's the same hall template as e3/m2/m3 (pillars, balcony pair, dais). Differentiate with a unique centre element: a parked dropship on the floor (collision hull, climbable wing), cranes overhead, and an asymmetric balcony (west only). The "hangar" name needs hangar features: open bay door on the east side showing sky, floor markings, fuel gantry.

### r3 "The Red War" (storm)

| Zone | Imitates | Currently builds | Verdict |
|---|---|---|---|
| Valley of Kings (0,-42) | Mars Valley of Kings (verify: canyon of colossal statues) | Canyon edge columns each side every 9 m, 2 colossi facing each other, 2 fallen statues, a half-buried head, broken legs on plinth, rock scatter, 2 pods | TWEAK |
| Siege Trenches (-18,-108) | Red War siege lines (Cabal trench works) | 4 parallel 140 m trench walls (1.6 m high) with slanted plates and staggered gaps, 8 tank traps, a deck, 2 turrets, burned tank | TWEAK |
| Cabal Drop Zone (18,-172) | Red War landing site, crashed Harvesters | 2 half-buried Harvesters, a downed Thresher, 5 pods, 4 fires, 3 supply, wreck-top deck | TWEAK |
| The Boarding Ramp (0,-232) | Flagship boarding ramp | Hull wall 140 m, ramp corridor (16x26) with side rails and lights, forward prows with high turrets, 4 supply, 2 decks | KEEP |
| Ghaul's Flagship (0,-306) boss | Ghaul's flagship deck under the Traveler (Red War finale) | 112x82 checkered deck, side bulkheads and superstructure, stern bridge tower, 7 hatches, 5 armour walls, 2 gantries, Traveler in the sky | TWEAK |

- Valley of Kings TWEAK: colossi placement is deliberate and the best landmark pair on Mars. Canyon columns are a jittered line each side (every 9 m, radius 5 to 7), reading as a picket fence; fuse them into 3 or 4 continuous cliff masses per side with a couple of side alcoves. The fallen head + legs + two statues are a good silhouette set.
- Siege Trenches TWEAK: four long identical lines reads as a diagram, and at 1.6 m high the wall is just waist cover. Make lines 2 and 4 shorter and angled via two staggered segments, add a command bunker in the middle, mortar pits between lines 2 and 3, one collapsed section where a drop pod has landed on the line.
- Drop Zone TWEAK: wreck silhouettes work. The pods are a hand list around it; reposition into a debris trail leading from the Harvester impact (the pods are the crater rim). Deck stands at (-50,-200): fine.
- Boarding Ramp KEEP: the ramp lane between two hulls, the lit rails and high turrets give a unique linear shape unlike any other zone.
- Flagship TWEAK: scale and sky are right. Weak points: a checkerboard floor of 16 colour-alternating tiles, 7 evenly scattered hatches, and an empty centre. Replace the checker with a single large circular dais under the Traveler, put the 5 armour walls into two clusters, and break the symmetry of the 4 stern towers. Ghaul needs a throne/command console landmark; the stern tower is present but too far (60 m) from the arena center.

---

## Layout-duplication list

- Boss rooms using the same template: e3 Lair, m2 Chamber of Night, m3 Throne of Crota, r2 Throne Hangar (plus the yard variants e1 Wall, e2 Array).
- Facade copy: m1 Gate of Oryx = m2 Temple of Crota wall.
- Zone names: r1 and r2 "The Scablands".
- Companion pairs inside a mission: e3 west/east factories; r1 Barrens four short bulwarks; r3 four trench lines.
- Dish-field overlap: e1 Skywatch and e2 Array both use the same `dish()` shapes and masts.

## Faction-architecture mismatches

- e2 Array: the boss is Sepiks Prime (Fallen), yet the compound is purely Golden Age with no Fallen elements.
- e3 Devils' Halls: clean concrete pillar grid with RGB glow; Fallen should read as scrap and banners (the Lair is closer to right).
- m1 first two zones have no Hive until the last 30 m, despite the mission desc being about Hive tunnels.
- r1 Sunken Plaza: pale Golden Age stone, with Cabal camp props: correct. r2: no Golden Age content at all, fine for a Cabal palace.
- Moon uses a Hive "castle wall + ribs" (hiveWall) in three places; skill says castle walls are for the Moon only: compliant.

## Top 6 REBUILD priorities

1. m3 The Abyss: the raid signature is a flat box with random stalactites; rebuild as a pit with islands and bone walkways.
2. m2 The Hellmouth: the pit is 45 m from the zone center; rebuild so the fight is around the pit.
3. m3 Throne of Crota (with m3 Ward): same template as m2 Chamber; make it a round amphitheater with a pit ring; make Ward an octagonal ritual chamber.
4. r2 The Scablands: jittered grid of cylinders; rebuild as a bending gorge with an arch and a unique name.
5. m1 Archer's Line: random craters and rovers, no silhouette, and the mission's Hive cave is outside the zone; rebuild as a ravine.
6. e3 Devils' Halls: pillar grid with alternating RGB lights; rebuild as three irregular linked bays with a lift platform and a light shaft.

---

## Elevation and rhythm

Kit facts used (js/world.js makeKit): there is no K.deck. Raised ground is `K.platform(x,z,w,d,h,{stairs:[sides],stairW,y})` (a solid box plus 0.4 m risers on 0.6 m runs, default stair width 2.4 m) and `K.stairs(x,z,dir,w,rise,{y})`. The `y` option lets you stack a second platform on a first (m3 dais does this), so terraces and towers are possible. A bridge is a platform raised on both ends with open floor (or void colliders) beneath. `K.room(...,{roof:true})` gives roofed interiors with door gaps. Ground stays 0, so every "descent" is really a climb the other way (a high start deck stepping down to the floor, or a sunken look made with surrounding terraces). Rule for large units: main routes get stairW 5 or more; the existing decks are 2.4 to 3.5 m and are optional flanks only, which is fine as long as nothing required uses them. Stair run is 0.6 m per 0.4 m of rise, so a 4 m deck needs a 6 m run and a 5 m wide stair needs about 6 x 5 m of floor.

Rhythm vocabulary: A = area + combat arena, T = pure traversal (no spawns), TC = combat during traversal, N = new area reveal.

### Today, per mission

| Mission | Elevation profile today | Rhythm today |
|---|---|---|
| e1 | Flat ground. Overpass piers and a tilted slab (walk under, not on). One 4 m stair to a bunker roof, two 2 m flank decks in the Wall yard. Roofless. | Steppes A, Skywatch A, Wall A. Walking between zones is bare plain (45 to 80 m) with no traversal feature. Zero traversal, zero interior. |
| e2 | Flat. One 2 m service deck at Rocketyard, two 2 m decks in the Array. Canyon walls are tall but unreachable. Roofless except overhead pipes. | Divide is a long walk that is half T, half A (junction). Rocketyard A, Array A. Divide is the only traversal and it has combat only at the junction; the long narrow section (z 150 to 105) has just a shield barricade pair. |
| e3 | Flat. One 2 m mezzanine at the west factory. Roofed: Devils' Halls (44x62, 10 m roof), corridor, the Lair (15 m roof) with 6 m balconies and a 1.6 m throne. | Mothyards A, Lunar Complex A, Halls A inside, short corridor T (14 m, too short), Lair A. This is the only Earth mission with a real new-area beat (breach to interior), but nothing is climbed. |
| m1 | Flat plains. One 2 m deck at Archer's, one dock at Anchor of Light, a 14-step ziggurat stair to the gate (2 m), 2 m flank decks. Open air throughout. | Archer's A, Anchor A, Gate A. No traversal at all; approach between zones is blank crater plain. No interior. |
| m2 | Best verticality on the Moon: 2.4 m platforms in the Temple, 2 m overlook, tunnel hall with a 3.6 m bridge and two 3.6 m galleries, 4 m galleries and a 2 m altar in the Chamber. Roofed: Tunnels, Chamber, short tunnels. Pit area flat. | Temple A, Hellmouth A (weak, see above), Tunnels TC (bridge + galleries, good), tunnel stub T (15 m), Chamber A. Hellmouth is the weakest beat; two stubs are too short to read as traversal. |
| m3 | Roofed: Abyss, Ward, Throne, tunnel. The Bridge is a floor-level span with void blocks (visually a bridge, but no height change). 2 m wall decks in the Abyss, 1.2 m stepped dais, 4 m galleries in the Throne. | Abyss A (flat), Bridge TC (the best traversal beat in the game, 96 m), Ward A, 20 m tunnel T, Throne A. Rhythm is strong; elevation is weak: nothing is above or below anything except the end hall. |
| r1 | Flat dunes. 2.8 m decks at Barrens, Scablands, Buried City (two, floor slabs), Plaza (two balconies). Towers are visual, 14 to 18 m of collider only. Roofless. | Barrens A, Scablands A, City A (street shape), Plaza A. No traversal, no interior. Every zone is an open combat field. |
| r2 | Flat. 2.8 m decks at the picket, gantry, boss balconies and the throne platform. Roofed: Operations Hall, Comms Centre, Throne Hangar. | Scablands A, Outer Bulwark A (a breach hold), Courtyard A, Hangar A. No traversal. Interiors exist but are side rooms. |
| r3 | Flat. One 2.8 m deck per zone (Trenches, Drop Zone, Ramp x2, flagship gantries). The Ramp is a flat corridor, not a climb. Roofless. | Valley A (statue walk), Trenches TC, Drop Zone A, Ramp TC (corridor, flat), Flagship A. Rhythm is decent; nothing climbs even though the Ramp and the flagship say "up". |

### Mission-level ideas (with what should stay open)

Principle used: add up/down where the real place is tiered or built, leave open where the place is a field, a plain or a gorge floor. One vertical idea per zone at most; the player should be able to feel the ground height change in at least one route per mission.

**e1 A Guardian Rises** (open dawn steppe; keep it open)
- Steppes: leave open. Elevation here would fight the "wide Steppes" feel. Only change: raise the overpass piece so that a real route climbs onto the intact east span: a 5 m wide stair (rise 7.5) from the road shoulder at x=40, a 103 m elevated walk with the collapsed gap, and enemies firing from it. That is traversal-with-combat for zone 0 and gives sight lines down the highway. Stairs 5 m wide, needs 11 m of run.
- Skywatch: dishes plus a 2-tier radar tower: 4 m control deck with a 5 m stair, 8 m roof lookout reached by a second stair. Leave the fenced yard open. Add a shed interior (roofed 10x12 room) as the gate to the Wall road.
- Wall road: the 45 m between Skywatch and the Wall is bare. Make it traversal: a trench or a hangar-door descent is impossible (ground is 0), so instead put a ramp-stepped terrace running up to the Wall yard gate (two 2.8 m terraces, 5 m stairs), and a short roofed gatehouse (the Wall's hangar door tunnel). Boss yard: the colony-ship hangar interior is a good roofed option, but the e1 mission is the tutorial: keep the yard open and add the decks as one high flank only.
- Where NOT to add interior: Steppes, the boss-yard floor.

**e2 The Last Array**
- Divide: keep as the traversal spine. Add a steel catwalk at 5 m along the east wall (5 m stairs at each end, gaps), so the Divide becomes traversal-during-combat with a high route. The tall walls already read as cliffs; do not roof it (the sky strip is the identity).
- Rocketyard: climbable service gantry on the standing rocket's pad: 4 m catwalk ring with a 5 m stair, plus rail-wagon tops as stepping stones (4 containers at 2.6 m). Keep the apron open. A launch bunker interior (roofed 14x18, dark, lit) as an optional side room next to the pad.
- Array: the compound is a good place for a tiered dish plateau: boss floor open, terraces on the north side (2.8 m then 5.6 m, 5 m stairs) holding the big dish; mirrored decks replaced with one raised control building. Do not roof the arena (dish sky).
- Left open: Divide floor, Rocketyard apron, Array floor.

**e3 The Devils' Lair**
- Mothyards: open yard; give one airliner a walkable hull top (low-poly bridge between two hulks at 3 m, 5 m stair) so the field has one high lane. Hangar shells could be real roofed interiors (one 14x28 hangar with a roof).
- Lunar Complex: factory floors with a catwalk bridge between the two factories at 5 m (the conveyor already runs here; make it walkable with stairs at both ends): this is the traversal-with-combat beat the zone lacks.
- Devils' Halls: this zone is already a roofed interior; the REBUILD gives it three bays; add the lift platform at 2.4 m and a mezzanine above the choke at 4.8 m (5 m stairs). Corridor to the Lair: extend from 14 m to 30 m and add a switchback ramp up to the Lair entry (two stacked platforms) so the Lair is entered from above and the player descends by stairs onto the floor (this is the only way to fake a descent: put the entry at 4.8 m and make the floor 0).
- Lair: already multi-level. Left as is.
- Where NOT: Mothyards ground; Lunar Complex facade front.

**m1 The Dark Beyond** (needs the most structural help)
- The brief calls for tunnels. Make the second half underground-feeling: a roofed Hive tunnel passage (use K.room with a roof) between Anchor of Light and Gate of Oryx, 40 m, with one side cavern and a kinked path. This turns the 70 m of blank plain into traversal-with-combat (a few Thralls) and a real "new area" reveal at the Gate.
- Archer's Line: the ravine brief already gives ridges. Make the west ridge a 4.8 m terrace (two stacked 2.4 m steps, 5 m stairs) with the antenna array on top as a high-ground overlook. Open floor below.
- Anchor of Light: raise the pad itself as a 1.2 m round-ish dais (box platform) in the middle, keep the base walkable at 0, and make the tallest dome a 6 m roof deck reached by outside stairs (2.4 to 3 m wide, optional).
- Gate of Oryx: the ziggurat already climbs; the gateway sits at 2 m. Raise the gateway deck to 4.8 m (three stacked terraces, central 5 m stair) so the gate towers over the plaza. Leave the plaza floor open.
- NOT: the crater plain between zones (the point is vacuum emptiness); leave open.

**m2 Chamber of Night**
- Temple of Crota: a tiered approach with three stair terraces (2.4, 4.8, 7.2) climbing to the wall gate, with the central stair 5 m wide. This is the climb the "Temple" should have. Keep the courtyard floor open.
- Hellmouth: crescent walkway on the rim (flat), plus a stepped island across a broken span: two 3.6 m platforms bridged by a 3 m wide arc bridge raised on stone piers (K.platform at 3.6 with void colliders beneath).
- Hive Tunnels: already good; extend with a descent illusion: arrive via a 4.8 m deck at the entry (stairs down to the 0 hall), so the player enters from above. Make the entry tunnel 25 m and bend it.
- Chamber: keep the nave; add the vertical gallery above the door (a 4 m loft over the entry that overlooks the floor). The Chamber is already roofed.
- NOT: Hellmouth floor beyond the rim.

**m3 Crota's End** (strongest rhythm, weakest height)
- Abyss: the REBUILD island plan. Elevation: the walkways are at 0 (the floor), but give each island a different deck height (0, 1.6, 3.2) with 5 m steps between, so the player rises across the room. Roof stays.
- Bridge: make the bridge a real span: raise it to 3.6 m on both ends via 5 m stairs, and leave the chasm sides void. Add one cross-gate arch at midspan (roofless). This is the highest-value elevation change in the game.
- Ward: octagonal chamber with a 1.2 m central altar and a second tier ledge (3.6 m) along the north arcs; enter from above by a short 4.8 m landing.
- Throne: amphitheater with a pit ring plus two stacked dais tiers on the north (existing 1.2 + 1.2); keep the galleries as one ring ledge.
- NOT: tunnel to the throne (leave flat, it's a breather).

**r1 The Buried City**
- Barrens: leave open (dunes); only add a Cabal forward-base deck cluster at 4.8 m with a 5 m stair to give the first sight line, and drop-pod trail.
- Scablands: mesa plateau with a Cabal outpost on 4 m (stair 5 m wide on the south), with one cut-through gully at ground level. Open floor around.
- Buried City: the climb: the toppled tower can be a walkable ramp (a long platform raised from 0 at the base to 6 m via stacked platforms with a 5 m stair at the foot), giving a crossing above the street; add a roofed interior: one lobby of a buried tower as an optional 12x16 roofed room with two doors. This turns the street into a two-level fight.
- Plaza: the retaining walls already stage it; raise the surrounding terrace to 3.2 m with the gate stair at 5 m width descending into the plaza (enter from above).
- NOT: Barrens dunes, plaza floor.

**r2 Dust Palace**
- Scablands (new gorge): the gorge ends in a rubble stair rising to a 4 m ledge in front of the bulwark.
- Outer Bulwark: the wall as a 2-tier fortress: a 5 m wall-walk deck behind the wall with a 5 m stair, so Cabal fire comes from above and the player can climb through the breach; open floor in front.
- Courtyard: a palace terrace: a stepped 2.8 + 2.8 platform pair in front of the hangar door with a wide central stair (5 m), and one interior (the existing Operations Hall) made the main route's shortcut instead of a side room.
- Throne Hangar: add the overhead gantry as a bridge (a 5 m high span across the hall, 3 m wide, stairs at both ends), and the east bay door. Hangar is already roofed.
- NOT: Courtyard floor and the gorge floor.

**r3 The Red War**
- Valley of Kings: statue plinths as real tiers: a stepped plinth at the colossus (2.4 then 4.8 m, 5 m stair) usable as a sniper perch. Floor stays open.
- Trenches: invert the idea: make the lines raised berms (1.6 m walls become 2.8 m embankments with stair crossings every other gap), so the player alternates up and over. This is combat-during-traversal as written.
- Drop Zone: wreck-top: a walkable Harvester hull (a 3 m high deck on the hull body, stairs on the stern) and a Thresher wing as a 2 m ledge.
- Boarding Ramp: the key one: make the ramp a true climb: two stacked platforms rising to 5.6 m with a 5 m stair (central), side prows at 5.6 m, flagship deck entered from above. This is the "new area" beat.
- Flagship: raised command circle under the Traveler (2.8 m, 5 m stair), gantries at 5.6 m. Deck floor open.
- NOT: the canyon floor in the valley and the open dune at the start.

### Traversal vs combat gaps (summary)

- Traversal with no combat: m3 tunnels (T), e3 corridor (T). They are fine as breathers if they are 30 m or more; the m2 stubs and e3 corridor are 11 to 15 m, too short to register.
- Combat with no traversal: e1 whole mission, m1 whole mission, r1 whole mission, r2 whole mission, e2 Rocketyard/Array. These five need at least one traversal beat each (climb, bridge, tunnel, or stepped terrace) between the second-to-last and boss zone, with a few enemies walking it.
- Best existing rhythm: m3 Crota's End (Abyss A, Bridge TC, Ward A, tunnel T, Throne A). Best existing verticality: m2 Hive Tunnels hall (bridge + galleries). Weakest overall: e1, m1, r1 (flat open field in every zone).
