// U16: where things stand in the Tower (pure data, so tools/tests.js can check it; the map itself is js/level-tower.js).
// world metres. yaw 0 faces -z; forward = (-sin yaw, -cos yaw). NPC post ring tops are at y + 0.3; dummy ring tops at y = 0.25.
// U16d: laid out on the Destiny 1 Tower map. The Vanguard room is sunken: the war table is on the floor, the kiosks on the 1.4 m balcony.
export const TOWER_SPOTS = {
  zavala: { x: -1, z: -53, yaw: Math.PI },
  cayde: { x: 5, z: -52.5, yaw: Math.PI },
  ikora: { x: 11, z: -53, yaw: Math.PI },
  kadi: { x: -2, z: 2.6, yaw: Math.PI, r: 4.6 },
  questKiosk: { x: -6, z: -40, y: 1.4, yaw: Math.PI },
  exoticKiosk: { x: 16, z: -40, y: 1.4, yaw: Math.PI },
  launchPad: { x: 112, z: -14, yaw: 0, r: 2.5 },
  rangeGate: { x: 0, z: 21.4, w: 11, d: 3 },
  rangeBox: { minX: -8.4, maxX: 8.4, minZ: 20.8, maxZ: 69.4 },
  rangeFirePoint: { x: 0, z: 26, yaw: Math.PI },
  rangeDummies: [{ x: -4.5, z: 34 }, { x: 3.5, z: 40 }, { x: -2.5, z: 46 }, { x: 4.5, z: 52 }, { x: -4, z: 58 }, { x: 2.5, z: 62 }],
  rangeBoss: { x: 0, z: 66 },
  talkRadius: 3.2,
};

// Empty posts at stalls and bays for NPCs that do not exist yet. Adding a person later means a model, an entry in `POSTS` (tower.js) and a
// symbol over them (the symbol kinds are in `symbol`, level-tower.js); the space, counter and spot are already built.
// Same units as TOWER_SPOTS; `symbol` is the map icon they will get.
export const TOWER_FUTURE_POSTS = {
  gunsmith: { x: 17, z: -20, yaw: Math.PI, symbol: 'bullet' },
  cryptarch: { x: 23.6, z: -8.5, yaw: Math.PI / 2, symbol: 'cube' },
  bounties: { x: -15, z: -20, yaw: Math.PI, symbol: 'burst' },
  specialOrders: { x: -24.6, z: 8, yaw: -Math.PI / 2, symbol: 'cube' },
  outfitter: { x: -64, z: -28.8, yaw: Math.PI, symbol: 'cube' },
  newMonarchy: { x: -40.6, z: -13, yaw: -Math.PI / 2, symbol: 'x' },
  futureWarCult: { x: 65, z: -65.6, yaw: Math.PI, symbol: 'x' },
  deadOrbit: { x: 97.5, z: -64.8, yaw: Math.PI, symbol: 'x' },
  shipwright: { x: 82, z: -10.4, yaw: 0, symbol: 'cube' },
  quartermaster: { x: 57, z: -70.8, yaw: Math.PI, symbol: 'bullet' },
};
