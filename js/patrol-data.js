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

export const BEACON_TEXT = {
  hunt: { label: 'Bounty', blurb: 'Hunt down the marked champion and the pack guarding it.', reward: 'Engram  ·  XP' },
  clear: { label: 'Clear', blurb: 'Wipe out the camp. Every hostile at the site must fall.', reward: 'Engram  ·  XP' },
};

// Public events. Each: a warning, an assault in pushes, a marked mechanic (kill the marked targets in time to turn it Heroic), and a finale.
// `faction` null means the destination's own units; 'hollow' is the Hive.
export const EVENT_SPECS = {
  hive_ritual: {
    name: 'Hive Ritual', blurb: 'A Hive ritual is under way at the spire.', faction: 'hollow', palette: 'moon', // the Hive wear the Moon's colours wherever they are met
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
};

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
};
