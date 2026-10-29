// U17a: patrol-zone data with no rendering dependency, so tools/tests.js can check it (sites, bounds, terrain, tuning, event scripts).
// js/patrol-earth.js builds the Earth map from this; js/patrol.js runs the beacons and events.

/** Tuning for every patrol zone. */
export const PATROL_TUNE = {
  wake: 56, sleep: 190, campCooldown: 110, // an ambient pack wakes inside `wake` metres, is put away beyond `sleep`, and returns after the cooldown
  beaconUse: 3, beaconCard: 12, beaconCooldown: 95,
  eventFirst: 45, eventGap: 140, eventWarn: 20, eventLimit: 300,
  xp: { beacon: 140, event: 260, heroic: 520 }, // scaled by 1 + g * 0.1 at award time
};

/** The Ghost view and the Sparrow (js/sparrow.js). Holds are in seconds. */
export const SPARROW = {
  summonHold: 1, orbitHold: 5,
  top: 34, boost: 52, reverse: 8, accel: 16, brake: 34, turn: 3.2, hover: 0.55, jump: 7.5,
  radius: 0.9, height: 0.9, stepUp: 0.9,
};

/** U17b: units of a faction met in another destination's patrol zone (`f` on a camp or beacon). Fallen wear Earth's colours, the Hive the Moon's. */
export const FACTION_KITS = {
  fallen: { faction: 'scrappers', pal: 'earth', names: { grunt: 'Vandal', rusher: 'Dreg', captain: 'Fallen Captain', heavy: 'Fallen Brig', suicide: 'Explosive Shank' } },
  hive: { faction: 'hollow', pal: 'moon', names: { grunt: 'Acolyte', rusher: 'Thrall', captain: 'Knight', heavy: 'Ogre', suicide: 'Cursed Thrall' } },
};

export const BEACON_TEXT = {
  hunt: { label: 'Bounty', blurb: 'Hunt down the marked champion and the pack guarding it.', reward: 'Engram  ·  XP' },
  clear: { label: 'Clear', blurb: 'Wipe out the camp. Every hostile at the site must fall.', reward: 'Engram  ·  XP' },
};

// Public events. Each: a warning, an assault in pushes, a marked mechanic (kill the marked targets in time to turn it Heroic), and a finale.
// `faction` null means the destination's own units; 'hollow' is the Hive.
export const EVENT_SPECS = {
  hive_ritual: {
    name: 'Hive Ritual', blurb: 'A Hive ritual is under way.', faction: 'hollow', palette: 'moon', // the Hive wear the Moon's colours wherever they are met
    names: { grunt: 'Acolyte', rusher: 'Thrall', captain: 'Knight', heavy: 'Ogre', suicide: 'Cursed Thrall' },
    marked: { n: 3, unit: 'captain', name: 'Ritualist', time: 60, text: 'Kill the Ritualists' },
    pushes: [[['rusher', 4], ['grunt', 3]], [['captain', 2], ['rusher', 3]]],
    finale: { unit: 'heavy', name: 'Ogre of the Ritual', n: 1, heroicN: 2 },
  },
  salvage_defense: {
    name: 'Salvage Defense', blurb: 'The House of Devils are hauling salvage out of the yard.', faction: null,
    names: null,
    marked: { n: 1, unit: 'captain', name: 'Salvage Boss', time: 50, text: 'Kill the Salvage Boss' },
    pushes: [[['grunt', 4], ['rusher', 3]], [['captain', 1], ['grunt', 3], ['rusher', 2]]],
    finale: { unit: 'heavy', name: 'Brig Hauler', n: 1, heroicN: 2 },
  },
  // U17b
  station_defense: {
    name: 'Station Defense', blurb: 'The House of Devils are stripping the Golden Age station.', faction: 'scrappers', palette: 'earth',
    names: { grunt: 'Vandal', rusher: 'Dreg', captain: 'Fallen Captain', heavy: 'Fallen Brig', suicide: 'Explosive Shank' },
    marked: { n: 2, unit: 'captain', name: 'Salvage Captain', time: 60, text: 'Kill the Salvage Captains' },
    pushes: [[['rusher', 5], ['grunt', 3]], [['captain', 1], ['rusher', 4], ['grunt', 3]]],
    finale: { unit: 'heavy', name: 'Brig Hauler', n: 1, heroicN: 2 },
  },
  cabal_drop: {
    name: 'Cabal Drop', blurb: 'A Red Legion drop ship is landing troops on the mesa.', faction: null,
    names: null,
    marked: { n: 1, unit: 'captain', name: 'Drop Commander', time: 50, text: 'Kill the Drop Commander' },
    pushes: [[['grunt', 5], ['rusher', 3]], [['captain', 1], ['grunt', 4], ['rusher', 2]]],
    finale: { unit: 'heavy', name: 'Legion Colossus', n: 1, heroicN: 2 },
  },
  harvester_down: {
    name: 'Harvester Down', blurb: 'A Cabal Harvester has come down in the dunes. Its crew are still alive.', faction: null,
    names: null,
    marked: { n: 2, unit: 'captain', name: 'Harvester Pilot', time: 55, text: 'Kill the Harvester Pilots' },
    pushes: [[['rusher', 4], ['grunt', 4]], [['captain', 2], ['grunt', 3]]],
    finale: { unit: 'heavy', name: 'Harvester Warden', n: 1, heroicN: 2 },
  },
  // U17c
  rig_breach: {
    name: 'Rig Breach', blurb: 'Hive crawl up out of the methane sea onto the rig.', faction: null,
    names: null,
    marked: { n: 2, unit: 'captain', name: 'Hive Wizard', time: 60, text: 'Kill the Wizards' },
    pushes: [[['rusher', 5], ['grunt', 3]], [['captain', 1], ['rusher', 4], ['grunt', 3]]],
    finale: { unit: 'heavy', name: 'Breach Ogre', n: 1, heroicN: 2 },
  },
  brood_hatch: {
    name: 'Brood Hatch', blurb: 'The eggs in the Solarium are hatching.', faction: null,
    names: null,
    marked: { n: 2, unit: 'captain', name: 'Brood Knight', time: 55, text: 'Kill the Brood Knights' },
    pushes: [[['rusher', 5], ['grunt', 4]], [['captain', 2], ['rusher', 3], ['grunt', 2]]],
    finale: { unit: 'heavy', name: 'Brood Ogre', n: 1, heroicN: 2 },
  },
};

/**
 * U17c: the Titan patrol is built on decks high above the methane sea (js/patrol-titan.js). Every deck is a flat plateau at `deck`; the sea slabs are drawn at `sea`, so the
 * ground at 0 under the Sunken Gallery lies below the water line. Kinds: p = a rig or the arcology platform (railed), b = a pipe bridge (railed, wide enough for the Sparrow),
 * x = enclosed (the descent tube, the gallery and its chamber: no rails, walls instead). [id, minX, maxX, minZ, maxZ, kind]
 */
export const TITAN = { deck: 20, sea: 9.2 };
export const TITAN_DECKS = [
  ['rig', -34, 34, 126, 176, 'p'],        // The Rig, the landing
  ['pump', -24, 24, 56, 92, 'p'],         // the pump station, hub of the rigs
  ['east3', 72, 116, 100, 144, 'p'],      // Rig Three, the breach rig
  ['west4', -116, -72, 100, 144, 'p'],    // Rig Four
  ['east5', 68, 112, 46, 86, 'p'],        // Rig Five
  ['west6', -112, -68, 50, 86, 'p'],      // Rig Six
  ['siren', -130, -90, -10, 40, 'p'],     // Siren's Watch, the tower rig
  ['east8', 68, 112, -14, 26, 'p'],       // Rig Eight
  ['wayst', -22, 22, -14, 24, 'p'],       // Rig Seven, the waystation
  ['arco', -70, 70, -170, -30, 'p'],      // the arcology platform under the dome
  ['b1', -5, 5, 92, 126, 'b'], ['b2', 34, 72, 126, 136, 'b'], ['b3', -72, -34, 126, 136, 'b'], ['b4', 24, 68, 66, 76, 'b'], ['b5', 88, 98, 86, 100, 'b'],
  ['b6', -68, -24, 66, 76, 'b'], ['b7', -98, -88, 86, 100, 'b'], ['b8', -103, -95, 40, 50, 'b'], ['b9', 84, 94, 26, 46, 'b'], ['b10', -5, 5, 24, 56, 'b'],
  ['b11', -5, 5, -30, -14, 'b'], ['b12', -90, -22, 0, 10, 'b'], ['b13', 22, 68, 0, 10, 'b'],
  ['tube', 58, 112, -104, -96, 'x'],      // the descent tube: climbs down from the dome floor to the gallery floor
  ['gallery', 112, 152, -104, -96, 'x'], ['gallery2', 144, 152, -150, -96, 'x'], ['chamber', 108, 156, -192, -150, 'x'],
];
/** The tube's ramp (centre line, deck height down to the gallery floor) and the terrain every deck stands on. */
export const TITAN_RAMP = { x0: 58, z0: -100, x1: 112, z1: -100, width: 9, h0: 20, h1: 0, edge: 3 };
export const TITAN_TERRAIN = [
  ...TITAN_DECKS.filter((d) => d[5] !== 'x').map(([, x0, x1, z0, z1]) => ({ type: 'plateau', x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h: TITAN.deck, edge: 0.4 })),
  { type: 'ramp', ...TITAN_RAMP },
];

/** Patrol maps by map id: the data half of each (js/patrol-<dest>.js adds `build`). */
export const PATROL_DATA = {
  e_patrol: {
    spawn: [0, 156],
    bounds: [-160, 160, -200, 176],
    // the sites mirror `patrol` below; patrol.js reads them from here
    zones: [
      { name: 'Landing', x: 0, z: 156 },
      { name: 'Wreck Field Beacon', x: -22, z: 126 },
      { name: 'Dock Beacon', x: 60, z: 96 },
      { name: 'Gantry Beacon', x: -88, z: -58 },
      { name: 'Yard Beacon', x: -112, z: 50 },
      { name: 'Graveyard', x: -36, z: 12 },
      { name: 'The Spire', x: 103, z: -24 },
    ],
    noEdge: true,
    hideBulbs: true, // lights live in fixtures (lamp posts, wall lamps, strip lights); no glow dot floats in the air
    lightPool: 8, // the 8 nearest fixtures carry real light
    merge: true, // fold the scenery into few draw calls (world.js mergeDecor)
    // a cool, clear day: pale sky, light haze, blue-grey concrete (the Wall must read as a dark mass at 200 m)
    colors: { sky: 0x9cc4ee, fog: 0xbcd3e8, hemiTop: 0xeef5ff, hemiBot: 0x9a958a, sun: 0xfff6e6, ground: 0xb4a58a, ground2: 0xa39578, rock: 0x7f7a70, rock2: 0x68645c, wall: 0x6d7580, foliage: 0x486a3c },
    fog: [90, 380],
    terrain: [
      { type: 'mound', x: -100, z: 130, r: 26, h: 2.0 },
      { type: 'mound', x: 100, z: 140, r: 24, h: 2.0 },
      { type: 'mound', x: -128, z: -50, r: 30, h: 3 },
      { type: 'mound', x: 30, z: -34, r: 22, h: 1.6 },
      { type: 'mound', x: -52, z: -108, r: 26, h: 2.5 },
      { type: 'mound', x: 134, z: 30, r: 22, h: 2 },
      { type: 'plateau', x: 100, z: -34, w: 40, d: 46, h: 6, edge: 22 },        // the rocks under the spire (0.27)
      { type: 'basin', x: 100, z: 84, r: 36, flat: 0.55, depth: 4.5 },          // the shipyard's dry dock (0.45)
      { type: 'plateau', x: -138, z: 28, w: 26, d: 30, h: 7, edge: 4 },         // the highway abutment (cliff all round but the ramp)
      { type: 'ramp', x0: -138, z0: 96, x1: -138, z1: 46, width: 12, h0: 0, h1: 7, edge: 6 }, // the on-ramp (0.14)
      { type: 'plateau', x: 0, z: -132, w: 330, d: 22, h: 1.2, edge: 18 },      // the apron under the Wall
    ],
    sky: {
      bodies: [{ color: 0xfff0c0, size: 22, pos: [-420, 48, -520], glow: 0xffe3b0 }, { color: 0xeaf0f6, size: 70, pos: [330, 225, -400], glow: 0xfff4d8 }],
      haze: [{ color: 0xcfe0f2, opacity: 0.5, r: 480, h: 80, y: -10 }],
      clouds: { n: 18, color: 0xffffff, opacity: 0.8, y: [60, 130], size: 24 },
    },
    patrol: {
      // beacons: a waist-high pedestal. `site` is where its activity happens
      beacons: [
        { id: 'wreck_hunt', x: -22, z: 126, type: 'hunt', name: 'Wreck Field Bounty', site: { x: -96, z: 78 }, target: { name: 'Dregnar, Hound Captain', unit: 'captain' } },
        { id: 'dock_clear', x: 60, z: 96, type: 'clear', name: 'Dry Dock Camp', site: { x: 112, z: 100 } },
        { id: 'gantry_hunt', x: -88, z: -58, type: 'hunt', name: 'Gantry Bounty', site: { x: -34, z: -112 }, target: { name: 'Vorsk, Rust Baron', unit: 'heavy' } },
        { id: 'yard_clear', x: -112, z: 50, type: 'clear', name: 'Tank Farm Camp', site: { x: -98, z: -8 } },
      ],
      // public events: they start themselves, one at a time, and show a marker
      events: [
        { id: 'hive_ritual', x: 103, z: -24, r: 24 },
        { id: 'salvage_defense', x: -36, z: 12, r: 20 },
      ],
      // ambient packs: wake when the player is near, come back after a while
      camps: [
        { x: -70, z: 142, n: 4 }, { x: 74, z: 142, n: 4 }, { x: -100, z: 98, n: 6 }, { x: 96, z: 92, n: 5 }, { x: -60, z: 24, n: 5 },
        { x: 62, z: 8, n: 5 }, { x: -106, z: -28, n: 5 }, { x: -60, z: -72, n: 4 }, { x: 30, z: -68, n: 5 }, { x: -6, z: -100, n: 6 },
        { x: 118, z: 20, n: 4 }, { x: -130, z: -100, n: 4 },
      ],
      npcs: { cayde: { x: 8, z: 146, yaw: 0 } }, // meetings stand here (quests.js PATROL_MEETINGS place: 'patrol:earth')
    },
  },
  // U17b: the Moon. Fallen hold the ruined Golden Age colony (landing, Archer's Line ridge, the station, the east outpost); the Hive hold the caves, caverns and
  // fortresses (the Hellmouth, the ossuary and its catacombs, the silo cavern, the castle wall). Roads lead from the landing to every area (see patrol-moon.js).
  m_patrol: {
    spawn: [0, 156],
    bounds: [-150, 150, -190, 170],
    zones: [
      { name: 'Landing', x: 0, z: 156 },
      { name: "Archer's Line Beacon", x: -24, z: 128 },
      { name: 'Outpost Beacon', x: 58, z: 100 },
      { name: 'Ossuary Beacon', x: -104, z: -8 },
      { name: 'Rim Beacon', x: 46, z: -96 },
      { name: 'Anchor of Light', x: -30, z: -40 },
      { name: 'The Hellmouth', x: 100, z: -50 },
    ],
    noEdge: true,
    hideBulbs: true,
    lightPool: 8,
    merge: true,
    fog: [70, 330],
    terrain: [
      { type: 'mound', x: -120, z: 138, r: 24, h: 3 },
      { type: 'mound', x: 110, z: 138, r: 22, h: 2.4 },
      { type: 'mound', x: 30, z: 10, r: 20, h: 1.6 },
      { type: 'mound', x: -40, z: -150, r: 26, h: 3 },
      // the mountains: cliff-walled massifs that shape the canyons the roads run through
      { type: 'plateau', x: -130, z: 40, w: 26, d: 130, h: 15, edge: 3 },                                          // the west wall
      { type: 'plateau', x: 38, z: 62, w: 22, d: 44, h: 12, edge: 3 },                                             // beside the spine
      { type: 'plateau', x: 130, z: 60, w: 22, d: 80, h: 14, edge: 3 },                                            // the east wall
      { type: 'plateau', x: -92, z: -50, w: 22, d: 28, h: 11, edge: 3 },                                           // between the lane and the station
      { type: 'plateau', x: -90, z: 62, w: 30, d: 70, h: 5, edge: 6 },                                             // the Archer's Line ridge
      { type: 'ramp', x0: -50, z0: 104, x1: -76, z1: 90, width: 8, h0: 0, h1: 5, edge: 3 },                       // the road up it
      { type: 'plateau', x: -30, z: -40, w: 70, d: 56, h: 2.5, edge: 14 },                                         // the station shelf
      { type: 'plateau', x: 100, z: -50, w: 90, d: 84, h: 5, edge: 28 },                                           // the Hellmouth's raised ground (ground never dips below 0)
      { type: 'basin', x: 100, z: -50, r: 40, flat: 0.3, depth: 5 },                                              // the pit sunk into it
      { type: 'plateau', x: -60, z: -120, w: 50, d: 40, h: 1.5, edge: 14 },                                        // the ossuary yard
    ],
    patrol: {
      beacons: [
        { id: 'archer_hunt', x: -24, z: 128, type: 'hunt', f: 'fallen', name: "Archer's Line Bounty", site: { x: -90, z: 62 }, target: { name: 'Zorrik, Wreck Captain', unit: 'captain' } },
        { id: 'outpost_clear', x: 58, z: 100, type: 'clear', f: 'fallen', name: 'Outpost Camp', site: { x: 104, z: 92 } },
        { id: 'ossuary_hunt', x: -104, z: -8, type: 'hunt', f: 'hive', name: 'Ossuary Bounty', site: { x: -60, z: -120 }, target: { name: 'Ghulrak, Pit Ogre', unit: 'heavy' } },
        { id: 'rim_clear', x: 46, z: -96, type: 'clear', f: 'hive', name: 'Rim Camp', site: { x: 12, z: -140 } },
      ],
      events: [
        { id: 'hive_ritual', x: 100, z: -50, r: 24 },
        { id: 'station_defense', x: -30, z: -40, r: 22 },
      ],
      camps: [
        { x: -70, z: 126, n: 4, f: 'fallen' }, { x: 74, z: 128, n: 4, f: 'fallen' }, { x: -100, z: 116, n: 5, f: 'fallen' }, { x: 62, z: 66, n: 5, f: 'fallen' },
        { x: -46, z: 36, n: 5, f: 'fallen' }, { x: 22, z: 8, n: 5, f: 'fallen' },
        { x: 90, z: 20, n: 5, f: 'hive' }, { x: -110, z: -40, n: 5, f: 'hive' }, { x: -60, z: -84, n: 4, f: 'hive' }, { x: 0, z: -120, n: 6, f: 'hive' },
        { x: 118, z: -126, n: 6, f: 'hive' }, { x: -44, z: -124, n: 5, f: 'hive' },
      ],
      npcs: { eris: { x: -110, z: -62, yaw: 0 } },
    },
  },
  // U17b: Mars. A red desert of dunes and cracked rock in the south and west; a Cabal fortress on its mesa in the east; the Buried City in the north, a dense
  // grid of tall half-sunk towers with enterable halls, and a subway tunnel under its west side. Wide dust tracks join the far areas (for the Sparrow), roads the near ones.
  r_patrol: {
    spawn: [0, 156],
    bounds: [-150, 150, -190, 170],
    zones: [
      { name: 'Landing', x: 0, z: 156 },
      { name: 'Barrens Beacon', x: -24, z: 126 },
      { name: 'Landing Zone Beacon', x: 62, z: 100 },
      { name: 'Scablands Beacon', x: -100, z: -48 },
      { name: 'City Beacon', x: 50, z: -60 },
      { name: 'The Fortress', x: 100, z: 60 },
      { name: 'Harvester Crash', x: -30, z: -6 },
    ],
    noEdge: true,
    hideBulbs: true,
    lightPool: 8,
    merge: true,
    fog: [80, 360],
    terrain: [
      // the desert: high dunes
      { type: 'mound', x: -100, z: 130, r: 30, h: 4 },
      { type: 'mound', x: 120, z: 140, r: 28, h: 3.4 },
      { type: 'mound', x: -30, z: 70, r: 20, h: 2.4 },
      { type: 'mound', x: 60, z: 10, r: 24, h: 3 },
      { type: 'mound', x: -120, z: -80, r: 26, h: 4.5 },
      { type: 'mound', x: 120, z: -20, r: 26, h: 4 },
      // the Cabal fortress mesa and its ramp
      { type: 'plateau', x: 100, z: 60, w: 50, d: 60, h: 4.5, edge: 5 },
      { type: 'ramp', x0: 60, z0: 100, x1: 84, z1: 84, width: 8, h0: 0, h1: 4.5, edge: 3 },
      // the Scablands mesa and its ramp
      { type: 'plateau', x: -96, z: -10, w: 44, d: 50, h: 3.4, edge: 4 },
      { type: 'ramp', x0: -96, z0: 46, x1: -96, z1: 12, width: 7, h0: 0, h1: 3.4, edge: 3 },
      // the city's podium (a fallen tower's foundation), and the sunken plaza
      // the Buried City stands on a raised bed of old foundations (ground never dips below 0, so the city is raised and the subway is the floor)
      { type: 'plateau', x: 0, z: -125, w: 230, d: 130, h: 5, edge: 24 },
      { type: 'basin', x: 0, z: -184, r: 24, flat: 0.5, depth: 3 },                                                // the sunken plaza
      // the subway: a ramp down at each end, a long tunnel and a station chamber at ground level
      { type: 'ramp', x0: -62, z0: -62, x1: -62, z1: -86, width: 9, h0: 5, h1: 0, edge: 2 },
      { type: 'plateau', x: -62, z: -117, w: 9, d: 62, h: 0, edge: 2 },
      { type: 'plateau', x: -62, z: -115, w: 17, d: 22, h: 0, edge: 2 },
      { type: 'ramp', x0: -62, z0: -148, x1: -62, z1: -168, width: 9, h0: 0, h1: 5, edge: 2 },
    ],
    patrol: {
      beacons: [
        { id: 'barrens_hunt', x: -24, z: 126, type: 'hunt', name: 'Barrens Bounty', site: { x: -96, z: 84 }, target: { name: 'Gorvath, Centurion Lord', unit: 'captain' } },
        { id: 'landing_clear', x: 62, z: 100, type: 'clear', name: 'Beachhead Camp', site: { x: 112, z: 108 } },
        { id: 'scablands_hunt', x: -100, z: -48, type: 'hunt', name: 'Scablands Bounty', site: { x: -40, z: -98 }, target: { name: 'Argo, Red Colossus', unit: 'heavy' } },
        { id: 'city_clear', x: 50, z: -60, type: 'clear', name: 'Buried City Camp', site: { x: 30, z: -122 } },
      ],
      events: [
        { id: 'cabal_drop', x: 100, z: 60, r: 24 },
        { id: 'harvester_down', x: -30, z: -6, r: 20 },
      ],
      camps: [
        { x: -70, z: 126, n: 4 }, { x: 126, z: 146, n: 4 }, { x: -110, z: 92, n: 5 }, { x: 30, z: 70, n: 5 }, { x: -50, z: 46, n: 5 },
        { x: 60, z: 20, n: 5 }, { x: -30, z: -50, n: 5 }, { x: 60, z: -96, n: 5 }, { x: -84, z: -94, n: 4 }, { x: 0, z: -96, n: 6 },
        { x: 112, z: -92, n: 4 }, { x: -62, z: -120, n: 5 },
      ],
      npcs: { ana: { x: -54, z: -58, yaw: 0 } },
    },
  },
  // U17c: Titan. Every deck stands high over the methane sea in two halves joined by pipe bridges: the Rigs in the south (the landing, six stations, Siren's Watch)
  // and the Arcology in the north, a ruined biosphere under a glass lattice. Hive hold the Solarium and the north tower wing only; a ramp in the dome's east gate
  // leads down a tube into the Sunken Gallery under the water, ending in a Hive chamber.
  t_patrol: {
    spawn: [0, 160],
    bounds: [-160, 160, -200, 180],
    zones: [
      { name: 'Landing', x: 0, z: 160 },
      { name: 'Rig Beacon', x: 28, z: 158 },
      { name: 'Pump Beacon', x: -18, z: 71 },
      { name: "Siren's Watch Beacon", x: -95, z: 36 },
      { name: 'Dome Beacon', x: 16, z: -50 },
      { name: 'Gallery Beacon', x: 52, z: -100 },
      { name: 'Rig Three', x: 94, z: 122 },
      { name: 'The Solarium', x: 34, z: -124 },
      { name: "Siren's Watch", x: -110, z: 10 },
      { name: 'The Arcology', x: 0, z: -100 },
    ],
    noEdge: true,
    hideBulbs: true,
    lightPool: 8,
    merge: true,
    hideCliffs: 0.35, // world.js buildGround: the plateaus' sheer skirts are not drawn, so the rigs stand on open legs and the bridges hang in the air
    // overcast and teal: the colours of the rigs stand out against it
    colors: { sky: 0x86a9a3, fog: 0x8ba9a0, hemiTop: 0xd0e4dc, hemiBot: 0x3a4a44, sea: 0x2b5550 },
    fog: [70, 320],
    terrain: TITAN_TERRAIN,
    sky: {
      zenith: 0x35666b, mid: 0x78a6a2, horizon: 0xc4d0b2,
      bodies: [{ color: 0xe6d0a2, size: 120, pos: [260, 170, -480], ring: true, bands: [0xe6d0a2, 0xd6b886, 0xeeddb4, 0xcfa872] }],
      clouds: { n: 22, color: 0xdfeae4, opacity: 0.7, y: [80, 170], size: 28 },
      haze: [{ color: 0x8fb0a4, opacity: 0.6, r: 470, h: 120, y: -10 }],
      skyline: [{ kind: 'rig', n: 9, r: [430, 610], h: [40, 90], w: [12, 22], color: 0x5f7e78, haze: 0.5 }, { kind: 'tower', n: 5, r: [450, 620], h: [60, 120], w: [10, 16], color: 0x6b8a84, haze: 0.5 }],
    },
    patrol: {
      beacons: [
        { id: 'rig_hunt', x: 28, z: 158, type: 'hunt', name: 'Rig Four Bounty', site: { x: -84, z: 126 }, target: { name: "Zul'gar, Rig Reaver", unit: 'captain' } },
        { id: 'pump_clear', x: -18, z: 71, type: 'clear', name: 'Rig Five Camp', site: { x: 90, z: 66 } },
        { id: 'siren_clear', x: -95, z: 36, type: 'clear', name: 'Rig Six Camp', site: { x: -90, z: 66 } },
        { id: 'dome_hunt', x: 16, z: -50, type: 'hunt', name: 'Tower Wing Bounty', site: { x: -12, z: -112 }, target: { name: 'Orgath, Wing Ogre', unit: 'heavy' } },
        { id: 'gallery_clear', x: 52, z: -100, type: 'clear', name: 'Sunken Gallery Camp', site: { x: 134, z: -170 } },
      ],
      events: [
        { id: 'rig_breach', x: 94, z: 122, r: 22 },
        { id: 'brood_hatch', x: 34, z: -124, r: 18 },
      ],
      camps: [
        { x: 0, z: 72, n: 5 }, { x: 84, z: 116, n: 4 }, { x: -100, z: 118, n: 5 }, { x: 96, z: 56, n: 5 }, { x: -108, z: 33, n: 5 },
        { x: 88, z: 4, n: 5 }, { x: 0, z: 6, n: 4 }, { x: -8, z: -48, n: 5 }, { x: 24, z: -86, n: 5 }, { x: -22, z: -92, n: 5 },
        { x: 6, z: -120, n: 6 }, { x: 52, z: -128, n: 5 }, { x: 118, z: -100, n: 4 }, { x: 148, z: -126, n: 5 }, { x: 124, z: -170, n: 5 },
      ],
      npcs: { sloane: { x: 20, z: 150, yaw: 0 } },
    },
  },
};
