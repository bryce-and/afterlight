// U17b: the Mars patrol zone (docs/reference/README.md, "Mars patrol zone"). Butterscotch desert under the Red Legion. A Cabal fortress walls the drop mesa in the
// east (gate, towers, a command bunker with an interior, ships on landing struts); the Scablands mesa and a cave lie in the west; the Buried City fills the north: a dense
// grid of tall half-sunk Golden Age towers, a transit station and a lobby you can walk into, and a subway tunnel running under its west side between two ramps.
// Roads: pale lamps in the city; wide dust tracks with unlit reflector posts across the desert (for the Sparrow); Cabal roads with fixtures. Light is otherwise
// fixed to Cabal architecture (hazard lights on bulwarks, pylons, turrets and bunkers).
import * as THREE from 'three';
import { PATROL_DATA } from './patrol-data.js';
import { MARS_KIT as MK } from './level-mars.js';
import { stairTo } from './level-earth.js';
import { road as kitRoad, hall as kitHall, desk, console_, shelf } from './patrol-kit.js';

const { CAB, CAB2, CAB3, HAZ, HAZR, STONE, STONE2, GA } = MK.C;
const AMBER = 0xffa040, RAIL = 0x6a625a, TUN = 0x8d8272;

// ------------------------------------------------------------------ lights and roads

/** A Cabal fixture on their architecture: a hazard-orange lamp that lights what is round it. */
function fixture(K, x, y, z, power = 8) {
  K.box(x, z, 0.6, 0.3, 0.6, HAZ, { y, abs: true, collide: false, glow: 2.2 });
  K.light(x, y - 0.4, z, AMBER, power, 24);
}

/** A Clovis Bray street lamp: a pale post with a warm lamp, along the city's roads only. */
function cityLamp(K, x, z, h = 5.5) {
  K.box(x, z, 0.3, h, 0.3, STONE2);
  K.box(x, z, 0.8, 0.2, 0.8, STONE, { y: h, collide: false });
  K.box(x, z, 0.6, 0.1, 0.6, 0xffe2b0, { y: h - 0.1, collide: false, glow: 2.2 });
  K.light(x, h - 0.6, z, 0xffe2b0, 7, 24);
}

/** A reflector post on a dust track: a short post with a pale marker, no light. */
function marker(K, x, z) {
  K.box(x, z, 0.2, 1.8, 0.2, CAB3);
  K.box(x, z, 0.3, 0.22, 0.3, 0xe8d8b0, { y: 1.6, collide: false, glow: 0.7 });
}

/** A Cabal road bollard: low, armoured, hazard lit; a light on every other one. */
let bollards = 0;
function bollard(K, x, z) {
  K.box(x, z, 0.8, 1.0, 0.8, CAB2);
  K.box(x, z, 0.9, 0.2, 0.9, HAZ, { y: 0.9, collide: false, glow: 2 });
  if (bollards++ % 2 === 0) K.light(x, 1.6, z, AMBER, 6, 18);
}

const road = (K, pts, kind = 'track', w) => kitRoad(K, pts, kind === 'city'
  ? { w: w ?? 8, gap: 24, color: 0xa39478, edge: 0xd8ccb4, lamp: cityLamp }
  : kind === 'cabal' ? { w: w ?? 9, gap: 18, color: 0x3a332e, edge: HAZ, lamp: bollard }
    : { w: w ?? 12, gap: 40, color: 0xc08a58, edge: 0xe8c08a, lamp: marker });

const hall = (K, cx, cz, w, d, h, o = {}) => kitHall(K, cx, cz, w, d, h, { color: GA[0], roofColor: 0xa89c8c, lamp: 0xffe2b0, ceil: 0xd8ccb4, ...o });
const CP = { body: CAB2, top: CAB, screen: HAZ, shelf: CAB2, shelfTop: CAB };   // Cabal furniture

// ------------------------------------------------------------------ Cabal fortress pieces

/** A watchtower: a solid armoured block with a lit crown and stairs, for height. */
function watchtower(K, x, z, h = 8, stairs = ['s']) {
  K.platform(x, z, 6, 6, h, { stairs, stairW: 2.6, color: CAB2, stairColor: CAB });
  MK.vbox(K, x, h + 0.2, z, 6.4, 0.4, 6.4, CAB3, {});
  fixture(K, x, h + 1.1, z, 9);
  for (const [dx, dz] of [[-2.7, -2.7], [2.7, -2.7], [2.7, 2.7], [-2.7, 2.7]]) K.box(x + dx, z + dz, 0.3, 1.0, 0.3, CAB, { y: h + 0.4, collide: false });
}

/** A Cabal ship on landing struts: a harvester hull lifted on four legs. */
function ship(K, x, z, ry, y = 6) {
  MK.harvester(K, x, z, { L: 24, ry, y, collide: true });
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const [lx, lz] of [[-3, -8], [3, -8], [-3, 8], [3, 8]]) K.box(x + lx * c + lz * s, z - lx * s + lz * c, 0.9, y, 0.9, CAB3);
}

// ------------------------------------------------------------------ the city

function towerAt(K, x, z, k) {
  const h = 46 + ((k * 37) % 46), lean = ((k * 17) % 9 - 4) * 0.025;
  MK.tower(K, x, z, 12, 12, h, { lean, axis: k % 2 ? 'x' : 'z', sink: 4 + (k % 3), crown: ['slope', 'crane', undefined][k % 3] });
}

export default {
  r_patrol: {
    ...PATROL_DATA.r_patrol,
    build(K) {
      bollards = 0;
      // ================================================================ the roads: wide dust tracks for the Sparrow, Cabal roads, the city's streets
      road(K, [[0, 156], [0, 110], [0, 40], [-10, 0], [-20, -30], [0, -62]], 'track');
      road(K, [[-10, 0], [-30, -6]], 'track');
      road(K, [[0, 110], [-50, 60], [-96, 46]], 'track'); road(K, [[-96, 46], [-96, 12]], 'track', 8);
      road(K, [[0, 120], [-24, 126]], 'track', 8);
      road(K, [[-96, -30], [-100, -48], [-70, -80], [-40, -98]], 'track', 9);
      road(K, [[0, 110], [62, 100], [84, 84]], 'cabal'); road(K, [[62, 100], [112, 108]], 'cabal');
      road(K, [[0, -62], [50, -60]], 'track', 9); road(K, [[50, -60], [30, -94], [30, -122]], 'city');
      road(K, [[0, -62], [0, -170]], 'city', 10);
      for (const z of [-94, -122, -150]) { road(K, [[12, z], [100, z]], 'city'); road(K, [[-12, z], [-54, z]], 'city'); }
      road(K, [[-72, -62], [-72, -166]], 'city', 8);
      for (const z of [-94, -122, -150]) road(K, [[-72, z], [-112, z]], 'city');

      // ================================================================ the desert: dunes, cracked rock, wrecks, drop pods
      for (const [x, z, w, d, h] of [[-60, 100, 16, 11, 2.6], [20, 90, 14, 10, 2.2], [-8, 40, 15, 10, 2.4], [90, 20, 16, 11, 2.6], [-70, -30, 14, 10, 2.4], [70, 150, 15, 10, 2.4], [-110, 60, 16, 12, 3]]) MK.dune(K, x, z, w, d, h);
      for (const [x, z] of [[-44, 134], [36, 126], [-90, 60], [-20, 86], [54, 140], [44, 30]]) MK.dropPod(K, x, z);
      for (const [x, z, r, h] of [[-84, 38, 3.5, 8], [-130, -30, 4, 11], [-72, -52, 3.2, 8], [-136, 20, 4.6, 12], [-88, -80, 3.4, 8], [120, 110, 3.6, 8], [140, 20, 4.4, 11], [128, -60, 4, 10]]) MK.cliff(K, x, z, r, h);
      for (const [x, z, s] of [[-30, 106, 1.8], [70, 86, 2.2], [-70, 36, 2.4], [30, 50, 1.6], [-120, 130, 2.6], [120, 100, 2.4], [-40, 20, 2], [20, -20, 1.8]]) K.rock(x, z, s);
      MK.thresher(K, -50, 14, 112, 0.5);                                   // a gunship wreck hanging over the dune
      MK.landingPad(K, 0, 156, 18);
      K.crate(-10, 148); K.crate(-11.3, 148.6); MK.supply(K, 14, 146, true);
      MK.harvester(K, -30, -30, { L: 22, ry: 0.4, rz: 0.12, collide: true });            // the Harvester lies just north of the event ground
      for (let i = 0; i < 7; i++) K.rock(-30 + K.R(-22, 22), -34 + K.R(-8, 8), K.R(1.2, 2.4));
      MK.supply(K, -20, 4, false); MK.pylon(K, -4, 14, 8); fixture(K, -4, 9.6, 14, 8);

      // ================================================================ the Cabal fortress on its mesa (x 75 to 125, z 30 to 90)
      MK.bulwark(K, 76, 32, 124, 32, 3.6, { face: -1 });
      MK.bulwark(K, 124, 32, 124, 88, 3.6, { face: 1 });
      MK.bulwark(K, 76, 32, 76, 88, 3.6, { face: -1 });
      MK.bulwark(K, 76, 88, 124, 88, 3.6, { face: 1, gaps: [[4, 14]] });                  // the gate faces the ramp
      watchtower(K, 80, 36, 8, ['e']); watchtower(K, 120, 36, 8, ['w']); watchtower(K, 80, 84, 8, ['e']); watchtower(K, 120, 84, 8, ['w']);
      MK.pylon(K, 78, 94, 9); fixture(K, 78, 11, 94, 9); MK.pylon(K, 92, 94, 9); fixture(K, 92, 11, 94, 9);   // the gate pylons
      // the command bunker: a roofed Cabal room with consoles and a raised gallery
      hall(K, 108, 48, 18, 12, 5.6, { color: CAB, roofColor: CAB2, ceil: 0x3a332e, lamp: HAZ, windows: false, doors: { s: 5 }, doorOffset: { s: 0 }, lamps: 3, props: (k, cx, cz) => {
        console_(k, cx - 5, cz - 3, CP); console_(k, cx, cz - 3, CP); console_(k, cx + 5, cz - 3, CP); shelf(k, cx - 8, cz + 2, false, CP); k.crate(cx + 6, cz + 2);
        k.platform(cx + 5.5, cz + 3, 5, 3.5, 2.4, { stairs: ['w'], stairW: 2.2, color: CAB2, stairColor: CAB });
      } });
      fixture(K, 108, 6.6, 54.4, 9);
      ship(K, 118, 66, 0.5, 6);                                                         // a ship on its struts, east of the event ground
      ship(K, 86, 50, -0.3, 5.5);
      MK.landingPad(K, 100, 44, 12);
      MK.supply(K, 88, 76, false); MK.supply(K, 114, 76, true); MK.supply(K, 90, 40, true);
      MK.turret(K, 96, 80, -Math.PI / 2); MK.turret(K, 108, 80, -Math.PI / 2);
      fixture(K, 96, 3.4, 80, 8);
      // the beachhead below it
      MK.landingPad(K, 112, 108, 14);
      MK.bunker(K, 92, 120, 9, 6, 4.4, {}); fixture(K, 92, 5, 123.4, 8);
      MK.turret(K, 130, 126, Math.PI * 0.9); MK.turret(K, 124, 140, Math.PI * 0.8);
      MK.mast(K, 134, 114, 22);
      MK.bulwark(K, 60, 70, 60, 56, 3.4, { face: -1 });
      MK.pylon(K, 66, 40, 9); fixture(K, 66, 10.6, 40, 8);

      // ================================================================ the Scablands: a mesa, cliff columns, a cave with a Cabal cache
      MK.supply(K, -106, 4, false); MK.supply(K, -92, -22, true); MK.pylon(K, -118, -4, 8); fixture(K, -118, 9.6, -4, 8);
      MK.turret(K, -86, -26, 0.4);
      MK.bulwark(K, -130, 56, -90, 56, 3, { face: 1, gaps: [[20, 28]] });
      hall(K, -118, -58, 16, 12, 6, { color: 0x7a4a36, roofColor: 0x6a3e2c, ceil: 0x4a2a1e, lamp: 0xe08a50, windows: false, doors: { e: 4 }, lamps: 2, props: (k, cx, cz) => {
        MK.supply(k, cx - 4, cz - 2, false); MK.supply(k, cx - 4, cz + 2, true); MK.supply(k, cx + 1, cz - 3, true); k.crate(cx + 4, cz + 2);
      } });
      for (const [x, z, s] of [[-110, -66, 4.4], [-110, -50, 4], [-126, -58, 5]]) K.rock(x, z, s, { collide: false });   // rock round the cave mouth

      // ================================================================ the Buried City: a grid of towers, canyon streets between them
      const cols = { e: [24, 48, 72, 96], w: [-26, -48, -84, -104] }, rows = [-80, -108, -136, -164];
      let k = 0;
      for (const side of ['e', 'w']) for (const x of cols[side]) for (const z of rows) {
        k++;
        if (side === 'e' && x === 48 && z === -108) continue;                       // the transit station
        if (side === 'w' && x === -26 && z === -108) continue;                      // the lobby
        towerAt(K, x, z, k);
      }
      for (const [x, z, s] of [[-14, -108, 2.2], [16, -116, 2.4], [-12, -148, 2.2], [8, -160, 2], [30, -94, 2], [-40, -122, 2]]) K.rock(x, z, s);
      MK.fallenStatue(K, 62, -150, 'w', 0.8);
      MK.colossus(K, 0, -186, 1.1, { collide: true });
      // the OWR M-Line transit station: wide steps up to a canopy, a hall with ticket gates and a mezzanine
      hall(K, 48, -108, 24, 18, 9.6, { doors: { s: 9, n: 7 }, doorOffset: { s: 0, n: 2 }, lamps: 4, props: (kk, cx, cz) => {
        for (const x of [-6, -2, 2, 6]) { kk.box(cx + x, cz + 2, 0.5, 1.1, 2, 0x8a7a66); kk.box(cx + x, cz + 2, 0.3, 0.1, 1.6, 0xffe2b0, { y: 1.1, collide: false, glow: 1.2 }); }
        for (const x of [-8, 8]) { kk.box(cx + x, cz + 6, 3, 0.5, 0.8, 0x6a5a4a); }
        kk.platform(cx, cz - 6, 14, 4, 4.4, { stairs: ['s'], stairW: 3, color: 0xa89c8c, stairColor: STONE2 });
        for (const x of [-9, 9]) kk.box(cx + x, cz - 2, 1.4, 9.6, 1.4, STONE2);
      } });
      K.stairs(48, -95.5, 'n', 14, 0.9, { color: STONE2 });
      K.box(48, -97.4, 20, 0.5, 3.4, 0x9a8a72, { y: 7.4, collide: false });                // the canopy over the steps
      K.box(48, -98.6, 11, 1.2, 0.3, 0xffd890, { y: 7.7, collide: false, glow: 1.5 });     // the lit sign
      for (const x of [38.5, 57.5]) K.box(x, -97.6, 0.9, 7.4, 0.9, STONE2);
      // the Clovis Bray lobby: an atrium with columns, a reception desk and a gallery
      hall(K, -26, -108, 20, 20, 12.4, { doors: { e: 7, s: 6 }, doorOffset: { s: -2 }, lamps: 4, props: (kk, cx, cz) => {
        for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) kk.box(cx + dx, cz + dz, 1.6, 12.4, 1.6, STONE2);
        desk(kk, cx, cz - 4, true, { body: STONE2, top: STONE }); desk(kk, cx - 3, cz + 5, true, { body: STONE2, top: STONE });
        kk.platform(cx - 5, cz - 8.4, 9, 3, 4.6, { stairs: ['e'], stairW: 3, color: 0xa89c8c, stairColor: STONE2 });
        kk.box(cx + 7.5, cz + 2, 0.5, 2, 4, 0x3d4f5c);
      } });
      for (const [x, z] of [[-18, -92], [-36, -92]]) K.crate(x, z);

      // ================================================================ the subway: a sunken tunnel under the west side, roofed by a collapsed slab
      const SX = -62;                                                              // the city bed is 5 m up; the tunnel floor is 0
      K.box(SX, -115, 9.2, 4.2, 64, 0x7d725f, { y: 3.8, abs: true });             // the slab: its top is 3 m above the city, so nothing walks on it
      K.box(SX, -115, 17.2, 4.2, 22, 0x7d725f, { y: 3.8, abs: true });
      for (const [x, z, s] of [[SX - 3, -90, 3], [SX + 2, -100, 3.4], [SX - 2, -132, 3], [SX + 3, -142, 3.2], [SX, -124, 2.8], [SX + 1, -108, 3]]) K.mesh(new THREE.DodecahedronGeometry(s, 0), 0x8a7a66, x, 8.6, z, { collide: false });
      // the portals: a lintel and two jambs at each end
      for (const [pz, sg] of [[-82.4, 1], [-148.4, -1]]) {
        K.box(SX, pz, 11, 1.4, 1.2, STONE2, { y: 4.0, abs: true });
        for (const dx of [-5, 5]) K.box(SX + dx, pz, 1.2, 5.4, 1.2, STONE2, { y: 0, abs: true });
        K.box(SX, pz + sg * 0.2, 4, 0.3, 0.2, 0xff8a3a, { y: 3.4, abs: true, collide: false, glow: 1.6 });
      }
      // the tunnel: liner walls, rails, ties and strip lights
      for (const dx of [-4.2, 4.2]) K.wall(SX + dx, -146, SX + dx, -84, 3.8, { t: 0.5, color: TUN });
      for (const dx of [-1.6, 1.6]) K.box(SX + dx, -115, 0.2, 0.14, 64, RAIL, { y: 0, abs: true, collide: false });
      for (let z = -146; z < -84; z += 2.2) K.box(SX, z, 4.4, 0.08, 0.4, 0x4a4036, { y: 0, abs: true, collide: false });
      for (let z = -88; z > -146; z -= 12) { K.box(SX, z, 3.2, 0.12, 0.4, 0xffe2b0, { y: 3.6, abs: true, collide: false, glow: 2 }); K.light(SX, 3.2, z, 0xffe2b0, 7, 16); }
      // the station chamber: platforms, pillars and a wrecked car
      for (const sg of [-1, 1]) {
        K.wall(SX + sg * 7.2, -125, SX + sg * 7.2, -105, 3.8, { t: 0.5, color: TUN });
        K.box(SX + sg * 6, -115, 2.4, 0.9, 20, STONE2, { y: 0, abs: true });
        for (const z of [-122, -115, -108]) K.box(SX + sg * 4.6, z, 0.9, 3.8, 0.9, STONE2, { y: 0, abs: true });
      }
      K.box(SX - 0.4, -110, 3.0, 3.0, 13, 0x6b5a4a, { y: 0, abs: true }); K.box(SX - 0.4, -110, 3.1, 0.5, 13.1, 0x3d6a7a, { y: 1.4, abs: true, collide: false });  // the wrecked car
      K.box(SX, -126, 6, 2.4, 1.2, 0x7a6a56, { y: 0, abs: true }); K.box(SX + 2, -122, 1.6, 1.2, 1.6, 0x7a6a56, { y: 0, abs: true });                         // rubble across the rails
      K.light(SX, 3, -115, 0xffe2b0, 9, 24);

      // ================================================================ the skyline
      for (const [x, z, w, h, lean] of [[-140, -150, 12, 70, 0.1], [140, -170, 14, 80, -0.12], [-146, 90, 10, 46, 0.14], [146, 80, 12, 52, -0.1]]) MK.tower(K, x, z, w, w, h, { lean, axis: 'z', sink: 8, collide: false });
      MK.thresher(K, 100, 28, -60, -0.8); MK.thresher(K, -100, 22, -140, 0.6);
      K.scatter((x, z) => MK.supply(K, x, z, K.chance(0.5)), 0, 30, 20, 120, 8, 2);
      K.scatter((x, z) => K.rock(x, z, K.R(1, 2.4)), 0, 20, 10, 120, 12, 2);
    },
  },
};
