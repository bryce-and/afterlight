// U17a: the Earth patrol zone, the Cosmodrome (docs/reference/cosmodrome-patrol/).
// A packed yard under the Wall. The old launch road runs north from the landing; an elevated highway crosses it, broken in the middle; a
// shipyard dry dock with a rusted hull lies to the east beside a pump house; a tank farm, pipe racks, a substation and a rocket on its
// gantry fill the west; ruined buildings with interiors (customs house, warehouse, admin block, barracks) stand along the roads; Fallen
// camps are built into the gaps; a Hive spire leans out of the rocks to the north east; the Wall's bay opens onto a catwalk hall.
// Light comes from fixtures: lamp posts along the roads, wall lamps at doors, strip lights under every ceiling, Fallen lamps in the camps.
// `patrol` holds the beacon, event and camp sites (js/patrol.js reads them); `zones` mirror them so the level keeps random props off the sites.
import * as THREE from 'three';
import { PATROL_DATA } from './patrol-data.js';
import {
  ROAD, PAINT, CONC, CONC2, RUST, WHITE, F_BLUE, car, pine, container, barrier, banner, fuselageX, gantry, crane, sphereTank, hTank, fence, ruinWall,
  carPile, latticeTower, sandbags, pylon, wires, fcrate, shield, skiff, rocket, stairTo, rail, pier,
} from './level-earth.js';

const WALLC = 0x4e5762, WALLC2 = 0x5d6670, DARK = 0x25272b, TEAL = 0x5f8a86, SPIRE = 0x12161c, GLOW = 0x4dff9a, FANC = 0x2c3038, ROOFC = 0x3a3c42;
const WARM = 0xffe2b0, COOL = 0xbfe3ff, FCYAN = 0x6fd0ff, SODIUM = 0xffb468;
const GEO = {};
const geo = (k, make) => GEO[k] || (GEO[k] = make());
const cyl12 = () => geo('cyl12', () => new THREE.CylinderGeometry(1, 1, 1, 12));
const hemi12 = () => geo('hemi12', () => new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2));

// ------------------------------------------------------------------ lighting: every light is a fixture the player can see

/** Street light: a pole, a swept arm and a lamp head; the lamp lights the road under it. `dead` poles are dark. */
function lamppost(K, x, z, h = 7.5, dir = 0, color = WARM, power = 8, dead = false) {
  K.box(x, z, 0.3, h, 0.3, K.C.metal);
  const dx = Math.sin(dir) * 1.2, dz = Math.cos(dir) * 1.2;
  K.box(x + dx / 2, z + dz / 2, Math.abs(dx) + 0.2, 0.18, Math.abs(dz) + 0.2, K.C.metal, { y: h - 0.2, collide: false });
  K.box(x + dx, z + dz, 1.1, 0.22, 0.5, DARK, { y: h - 0.3, collide: false });
  if (dead) return;
  K.box(x + dx, z + dz, 0.9, 0.08, 0.38, color, { y: h - 0.34, collide: false, glow: 2 });
  K.light(x + dx, h - 1, z + dz, color, power, 28);
}

/** A fixture bolted to a wall face: `face` is the way it points ('n' = -z, 's' = +z, 'e' = +x, 'w' = -x). Lights the ground in front of it. */
function wallLamp(K, x, z, y, face, color = WARM, power = 6) {
  const [nx, nz] = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[face];
  const along = nx !== 0;
  K.box(x + nx * 0.3, z + nz * 0.3, along ? 0.5 : 0.7, 0.5, along ? 0.7 : 0.5, DARK, { y, collide: false });
  K.box(x + nx * 0.58, z + nz * 0.58, along ? 0.08 : 0.5, 0.34, along ? 0.5 : 0.08, color, { y: y + 0.08, collide: false, glow: 2.2 });
  K.light(x + nx * 1.5, y + 0.2, z + nz * 1.5, color, power, 16);
}

/** A strip light under a ceiling (`y` is the height of the underside above the ground). */
function ceilLamp(K, x, z, y, len = 2.4, alongX = true, color = WARM, power = 8) {
  K.box(x, z, alongX ? len + 0.3 : 0.5, 0.14, alongX ? 0.5 : len + 0.3, DARK, { y: y - 0.14, collide: false });
  K.box(x, z, alongX ? len : 0.34, 0.06, alongX ? 0.34 : len, color, { y: y - 0.18, collide: false, glow: 2.2 });
  K.light(x, y - 0.9, z, color, power, 20);
}

// ------------------------------------------------------------------ buildings

/**
 * A building you can walk into: four walls with door gaps and ruined openings, a roof that may be broken, a window band, strip lights inside
 * and a lamp at every door. o: doors {n,s,e,w widths}, doorOffset {side: metres from the middle}, breaks [[side, from, to]] (extra gaps along
 * a side, measured from its west or north end), roof 'full' | 'half' | 'none', color, lamps (strip lights), lampColor.
 */
function building(K, cx, cz, w, d, h, o = {}) {
  const t = 0.9, color = o.color ?? CONC2, doors = o.doors || {}, off = o.doorOffset || {};
  const gaps = (side, len) => {
    const g = [];
    if (doors[side]) g.push([len / 2 - doors[side] / 2 + (off[side] ?? 0), len / 2 + doors[side] / 2 + (off[side] ?? 0)]);
    for (const [s, a, b] of o.breaks || []) if (s === side) g.push([a, b]);
    return g;
  };
  K.wall(cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2, h, { t, color, gaps: gaps('n', w) });
  K.wall(cx - w / 2, cz + d / 2, cx + w / 2, cz + d / 2, h, { t, color, gaps: gaps('s', w) });
  K.wall(cx - w / 2, cz - d / 2, cx - w / 2, cz + d / 2, h, { t, color, gaps: gaps('w', d) });
  K.wall(cx + w / 2, cz - d / 2, cx + w / 2, cz + d / 2, h, { t, color, gaps: gaps('e', d) });
  const roof = o.roof ?? 'full';
  if (roof === 'full') K.box(cx, cz, w + t, 0.6, d + t, o.roofColor ?? ROOFC, { y: h });
  else if (roof === 'half') K.box(cx - w * 0.2, cz, w * 0.6 + t, 0.6, d + t, o.roofColor ?? ROOFC, { y: h });
  // a pale ceiling panel under the roof, faintly lit (an unlit underside reads as a black void)
  if (roof !== 'none') K.box(roof === 'half' ? cx - w * 0.2 : cx, cz, (roof === 'half' ? w * 0.6 : w) - 0.2, 0.08, d - 0.2, 0x7d838a, { y: h - 0.08, collide: false, glow: 0.4 });
  // window band: dark glass strips just proud of the long walls
  for (const s of [-1, 1]) K.box(cx, cz + s * (d / 2 + 0.47), w * 0.8, 0.9, 0.06, 0x2b3a46, { y: h * 0.52, collide: false });
  // strip lights under the roof (or on the covered part)
  const nl = o.lamps ?? Math.max(1, Math.round(w / 8));
  const x0 = cx - w / 2, span = roof === 'half' ? w * 0.6 : w;
  if (roof !== 'none') for (let i = 0; i < nl; i++) ceilLamp(K, x0 + (i + 0.5) * span / nl, cz, h, Math.min(2.8, span / nl * 0.6), true, o.lampColor ?? WARM, 9);
  // a lamp on each side of every door
  for (const side of ['n', 's', 'e', 'w']) {
    if (!doors[side]) continue;
    const horiz = side === 'n' || side === 's', len = horiz ? w : d, c = len / 2 + (off[side] ?? 0), edge = doors[side] / 2 + 1.1;
    for (const e of [-1, 1]) {
      const p = c + e * edge;
      if (horiz) wallLamp(K, cx - w / 2 + p, cz + (side === 'n' ? -d / 2 - t / 2 : d / 2 + t / 2), 3.1, side, o.lampColor ?? WARM, 4);
      else wallLamp(K, cx + (side === 'w' ? -w / 2 - t / 2 : w / 2 + t / 2), cz - d / 2 + p, 3.1, side, o.lampColor ?? WARM, 4);
    }
  }
}

/** Rubble and wreckage spilling from a broken wall. */
function rubble(K, x, z, n = 6, spread = 3) {
  for (let i = 0; i < n; i++) K.rock(x + K.R(-spread, spread), z + K.R(-spread, spread), K.R(0.7, 1.7));
}

function desk(K, x, z, alongX = true) { K.box(x, z, alongX ? 2.2 : 0.9, 0.85, alongX ? 0.9 : 2.2, 0x6a5a48); K.box(x, z, alongX ? 2.0 : 0.7, 0.06, alongX ? 0.7 : 2.0, 0x9a8a6a, { y: 0.85, collide: false }); }
function shelf(K, x, z, alongX = true) { K.box(x, z, alongX ? 3 : 0.6, 2.2, alongX ? 0.6 : 3, 0x55606a); for (const y of [0.7, 1.4]) K.box(x, z, alongX ? 3.1 : 0.7, 0.08, alongX ? 0.7 : 3.1, 0x6f7a84, { y, collide: false }); }
function barrel(K, x, z, color = RUST) { K.cyl(x, z, 0.5, 1.1, color, { sides: 8 }); }

/** A Fallen camp: a ring of sandbags and scrap, banners, a shelter of salvaged sheet, and two cyan Fallen lamps. */
function fallenCamp(K, x, z, r = 7) {
  sandbags(K, x, z, r, 0.4, 2.4); sandbags(K, x, z, r, 3.6, 5.3);
  fcrate(K, x + 3, z - 3); fcrate(K, x - 4, z + 2); fcrate(K, x + 1, z + 4.5, 1.2);
  shield(K, x - 2, z - 5, true); shield(K, x + 5, z + 1, false);
  banner(K, x, z + r + 1, 0x2c4a73); banner(K, x - r - 1, z, 0x7e2626);
  // the shelter: four posts and a patched roof
  for (const [sx, sz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) K.box(x + sx + 1, z + sz - 1, 0.25, 3.0, 0.25, 0x4a4036, { collide: false });
  K.box(x + 1, z - 1, 5.6, 0.25, 5.6, 0x7a6a50, { y: 3.0, collide: false });
  K.box(x + 1, z - 1, 5.0, 0.12, 5.0, 0x2c4a73, { y: 3.2, collide: false });
  for (const s of [-1, 1]) {
    const lx = x + s * (r - 0.6), lz = z + (s > 0 ? -2 : 2);
    K.box(lx, lz, 0.25, 4.2, 0.25, 0x3a4048);
    K.box(lx, lz, 0.9, 0.5, 0.9, DARK, { y: 4.2, collide: false });
    K.box(lx, lz, 0.7, 0.34, 0.7, FCYAN, { y: 4.26, collide: false, glow: 2.4 });
    K.light(lx, 5.2, lz, FCYAN, 9, 24);
  }
}

/** A run of pipes on legs: the pipes block at head height, the gaps between legs stay open underneath. */
function pipeRack(K, x0, z0, x1, z1, h = 3.4, n = 2) {
  const horiz = Math.abs(x1 - x0) >= Math.abs(z1 - z0), len = horiz ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 1.05, c = i % 2 ? K.C.metal : RUST;
    K.mesh(new THREE.CylinderGeometry(0.42, 0.42, len, 8), c, mx + (horiz ? 0 : off), h + (i % 2) * 0.1, mz + (horiz ? off : 0), { rx: horiz ? 0 : 0, rz: horiz ? Math.PI / 2 : 0, ry: 0, collide: false })
      .rotation.set(horiz ? 0 : Math.PI / 2, 0, horiz ? Math.PI / 2 : 0);
  }
  K.collider(horiz ? Math.min(x0, x1) : mx - n * 0.6, h - 0.5, horiz ? mz - n * 0.6 : Math.min(z0, z1), horiz ? Math.max(x0, x1) : mx + n * 0.6, h + 0.9, horiz ? mz + n * 0.6 : Math.max(z0, z1), null);
  const legs = Math.max(2, Math.round(len / 9));
  for (let i = 0; i <= legs; i++) {
    const p = (i / legs) * len - len / 2;
    K.box(horiz ? mx + p : mx, horiz ? mz : mz + p, horiz ? 0.4 : n * 1.1 + 0.4, h + 0.2, horiz ? n * 1.1 + 0.4 : 0.4, 0x4a5560);
  }
}

// the Hive spire after the reference: a long black blade leaning out of the rocks, bands of green light up its length
function spire(K, x, z, h, lean, yaw = 0, width = 4.2) {
  const m = K.mesh(new THREE.BoxGeometry(width, h, width * 0.8), SPIRE, x, h / 2 - 0.5, z, { rz: lean, ry: yaw });
  const up = new THREE.Vector3(Math.sin(-lean), Math.cos(lean), 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  for (let t = 0.2; t < 0.97; t += 0.095) {
    const along = t * h - h / 2, px = x + up.x * along, pz = z + up.z * along, py = h / 2 - 0.5 + up.y * along; // measured from the blade's centre
    K.mesh(geo('band', () => new THREE.BoxGeometry(1, 1, 1)), GLOW, px, py + 0.2, pz, { rz: lean, ry: yaw, scale: [width * 1.06, 0.55, width * 0.85], glow: 1.6 });
  }
  K.collider(x - width * 0.7, 0, z - width * 0.7, x + width * 0.7, 7, z + width * 0.7, m);
  return m;
}

// three white spheres on a mast: the radar towers on the skyline
function sphereMast(K, x, z, h) {
  K.box(x, z, 1.6, h, 1.6, 0x8d939a, { collide: false });
  for (let i = 0; i < 3; i++) K.mesh(geo('rs', () => new THREE.SphereGeometry(1, 10, 7)), WHITE, x, h * (0.45 + i * 0.22), z, { scale: 5.2 - i * 0.7, collide: false });
  K.box(x, z, 0.6, 0.6, 0.6, 0xff5a3c, { y: h + 0.5, collide: false, glow: 2.2 });
  K.collider(x - 1.2, 0, z - 1.2, x + 1.2, h * 0.4, z + 1.2, null);
}

/** A tall refinery stack: banded, a red beacon on top. */
function stack(K, x, z, h, r = 2.4) {
  K.cyl(x, z, r, h, 0x8a8f94, { sides: 12 });
  for (let y = 4; y < h; y += 7) K.cyl(x, z, r + 0.15, 0.7, 0xb0562c, { y, sides: 12, collide: false });
  K.box(x, z, 0.7, 0.7, 0.7, 0xff5a3c, { y: h + 0.2, collide: false, glow: 2.4 });
}

function valveCluster(K, x, z) {
  for (let i = 0; i < 3; i++) { K.cyl(x + i * 3, z, 1.0, 2.4, K.C.metal, { sides: 8 }); K.cyl(x + i * 3, z, 0.3, 1.0, RUST, { y: 2.4, collide: false }); K.box(x + i * 3, z, 1.6, 0.2, 0.2, 0xb03a2a, { y: 3.2, collide: false }); }
}

/** A shipyard hull in the dry dock: a big cylinder on cradle legs, a nose cap, ribs, fins. `axisY` is the world height of its axis. */
function hull(K, x, z, L, r, axisY) {
  const gy = K.ground(x, z), y = axisY - gy;
  K.mesh(cyl12(), 0xbdb6a8, x, y, z, { rz: Math.PI / 2, scale: [r, L, r], collide: true });
  K.mesh(hemi12(), 0xbdb6a8, x - L / 2, y, z, { rz: Math.PI / 2, scale: [r, r * 1.5, r] });
  K.mesh(cyl12(), 0x8f8a80, x + L / 2 + 1.5, y, z, { rz: Math.PI / 2, scale: [r * 0.55, 3, r * 0.55], collide: false });
  for (let dx = -L / 2 + 6; dx < L / 2; dx += 9) K.mesh(geo('hullrib', () => new THREE.TorusGeometry(1, 0.04, 6, 24)), RUST, x + dx, y, z, { ry: Math.PI / 2, scale: [r * 1.02, r * 1.02, r * 1.02], collide: false });
  for (const s of [-1, 1]) K.box(x + L / 2 - 4, z + s * (r + 2.4), 7, 0.5, 5, 0xbdb6a8, { y: y - 0.6, collide: false });
  K.box(x + L / 2 - 3, z, 6, r * 1.6, 0.5, 0xbdb6a8, { y: y + r * 0.6, collide: false });
  K.box(x - 2, z, L * 0.5, 0.5, 2.2, 0x3d5a80, { y: y + r - 0.2, collide: false }); // a long dark panel along the spine
  // cradle legs from the dock floor up to the hull
  for (let dx = -L / 2 + 5; dx <= L / 2 - 4; dx += 11) for (const s of [-1, 1]) {
    const bx = x + dx, bz = z + s * (r * 0.75), bot = K.ground(bx, bz), top = axisY - r * 0.55;
    K.box(bx, bz, 1.2, Math.max(1, top - bot), 1.2, 0x4a5560);
  }
}

export default {
  e_patrol: {
    ...PATROL_DATA.e_patrol,
    build(K) {
      const C = K.C;
      const WZ = -150;

      // ================================================================ roads
      // the launch road: from the landing north to the Wall, under the elevated highway
      K.box(0, 20, 18, 0.05, 340, ROAD, { collide: false });
      for (let z = 172; z > -128; z -= 7) K.box(0, z, 0.3, 0.06, 3, PAINT, { collide: false });
      for (const [x, z, ry] of [[3, -92, 0.15], [-4, -104, -0.25]]) K.mesh(new THREE.BoxGeometry(12, 0.3, 9), ROAD, x, 0.05, z, { ry, rx: 0.02 });   // the road ends in tilted slabs
      // a cross road east to the dock, and one west to the warehouse and the on-ramp
      K.box(60, 112, 124, 0.05, 12, ROAD, { collide: false }); K.box(-70, 112, 140, 0.05, 12, ROAD, { collide: false });
      K.box(-138, 70, 12, 0.05, 80, ROAD, { collide: false });
      for (let x = -140; x < 120; x += 8) if (x < -9 || x > 9) K.box(x, 112, 3, 0.06, 0.3, PAINT, { collide: false });
      // lamp posts along the roads: both sides, a few dead
      for (let z = 164, i = 0; z > -118; z -= 22, i++) {
        lamppost(K, -10.8, z, 7.5, Math.PI / 2, WARM, 8, i % 5 === 3);
        lamppost(K, 10.8, z - 11, 7.5, -Math.PI / 2, WARM, 8, i % 4 === 2);
      }
      for (let x = -130, i = 0; x <= 110; x += 24, i++) if (x < -14 || x > 14) lamppost(K, x, 105.5, 7, 0, WARM, 7, i % 4 === 1);
      // jammed traffic on the launch road: never more than two of four lanes blocked in a row
      const lanes = [-6.3, -2.1, 2.1, 6.3];
      for (let z = 150; z > -90; z -= K.R(7, 11)) {
        if (z > 105 && z < 120) continue;
        const skip = Math.floor(K.rng() * 3);
        lanes.forEach((lx, i) => {
          if (i === skip || i === skip + 1 || !K.chance(0.5)) return;
          const x = lx + K.R(-0.4, 0.4), zz = z + K.R(-1.2, 1.2);
          if (K.clear(x, zz, 2.4)) car(K, x, zz, true);
        });
      }
      for (const s of [-1, 1]) for (let z = 168; z > -90; z -= 12) if (K.chance(0.5)) K.box(s * 9.7, z - 5, 0.3, 0.8, 9, C.metal);

      // ================================================================ the elevated highway (z = 30): the abutment on the west, a collapsed middle, a stranded span east
      const HZ = 30, DT = 7, DB = DT - 1.4;
      K.box(-87, HZ, 78, 1.4, 14, CONC, { y: DB, abs: true });                                // x -126 to -48
      K.box(2, HZ, 48, 1.4, 14, CONC, { y: DB, abs: true });                                  // x -22 to 26: the stranded span
      K.box(-87, HZ, 78, 0.06, 11.4, ROAD, { y: DT + 0.01, abs: true, collide: false });
      K.box(2, HZ, 48, 0.06, 11.4, ROAD, { y: DT + 0.01, abs: true, collide: false });
      for (let x = -122; x < -52; x += 7) K.box(x, HZ, 3, 0.06, 0.3, PAINT, { y: DT + 0.05, abs: true, collide: false });
      for (let x = -18; x < 24; x += 7) K.box(x, HZ, 3, 0.06, 0.3, PAINT, { y: DT + 0.05, abs: true, collide: false });
      rail(K, -126, -48, HZ - 6.8, DT, [[-100, -92]]); rail(K, -126, -48, HZ + 6.8, DT, [[-70, -60]]);
      rail(K, -22, 26, HZ - 6.8, DT); rail(K, -22, 26, HZ + 6.8, DT, [[0, 10]]);
      for (const px of [-112, -96, -80, -64]) for (const s of [-1, 1]) pier(K, px, HZ + s * 4.5, 2.2, 2.2, DB);
      for (const px of [-12, 4, 20]) for (const s of [-1, 1]) pier(K, px, HZ + s * 4.5, 2.2, 2.2, DB);
      // the fallen slab: the west span's end dropped onto the road, a ramp of broken concrete
      const slab = K.mesh(new THREE.BoxGeometry(18, 1.3, 13.4), CONC, -39, 3.5, HZ, { rz: 0.4 });
      K.collider(-47.5, 0, HZ - 6.7, -30.5, 4.6, HZ + 6.7, slab);
      for (const dz of [-3, 0, 3]) { K.box(-50, HZ + dz, 1.4, 0.1, 0.1, RUST, { y: DT + 0.6, abs: true, collide: false }); K.box(-21, HZ + dz, 1.4, 0.1, 0.1, RUST, { y: DT + 0.4, abs: true, collide: false }); }
      stairTo(K, 6, HZ - 7.9, 's', 3, DT);                                                    // the way up onto the stranded span, off the north side
      stairTo(K, -82, HZ + 7.9, 'n', 3, DT);
      // cover and lamps up on the spans
      barrier(K, 8, HZ - 3); barrier(K, 8, HZ + 3); car(K, 18, HZ - 1, false); K.crate(-8, HZ + 2); K.crate(-9.3, HZ + 3.2);
      // lamps hung from the girders under the deck
      for (const x of [-104, -88, -72, 4]) ceilLamp(K, x, HZ, DB, 3.2, false, SODIUM, 9);

      // ================================================================ the car graveyard under and around the highway
      carPile(K, -36, 12, 24, 20); carPile(K, 22, -34, 16, 17); carPile(K, -72, -34, 14, 15); carPile(K, 58, 56, 12, 14);
      carPile(K, -6, -76, 12, 14); carPile(K, 50, 130, 10, 12); carPile(K, -110, 140, 8, 10); carPile(K, -60, 60, 10, 12);
      for (const [x, z, a] of [[-48, 40, 0.5], [-24, 8, -0.4], [40, 62, 0.8], [-80, 70, 1.2]]) {
        K.mesh(new THREE.BoxGeometry(2.1, 1.2, 4.4), K.RP([RUST, 0x6b5a4a, 0x56656a]), x, 0.9, z, { rz: Math.PI, ry: a, collide: true });
      }
      container(K, -22, 44, true); container(K, -50, 6, false, 0, 0x4f6a5a); container(K, 8, -22, true, 0, 0x6a5a4a); barrier(K, -14, 18); barrier(K, -40, 40, false);

      // ================================================================ ruined buildings with interiors
      // the customs house by the landing: a long hall with counters, a broken east wall
      building(K, -40, 126, 24, 14, 5.4, { doors: { s: 5, n: 4 }, doorOffset: { s: -4, n: 3 }, breaks: [['e', 9, 13]], roof: 'full' });
      for (const x of [-48, -42, -36]) desk(K, x, 128, true);
      shelf(K, -50, 122, false); shelf(K, -30, 130, false); K.crate(-34, 122); K.crate(-35.3, 122.4); barrel(K, -47, 132);
      rubble(K, -26, 126, 7, 2.6);
      // the warehouse on the west road: a big hall with container racks and a raised catwalk
      building(K, -100, 98, 38, 22, 8.4, { doors: { s: 9, n: 7, e: 6 }, doorOffset: { s: -6, n: 8 }, breaks: [['w', 5, 9]], roof: 'full', lamps: 4 });
      for (const [x, z, alongZ, c] of [[-112, 94, true, 0x6a5a4a], [-112, 101, true, 0x4f6a5a], [-96, 92, false, 0x7a4a32], [-108, 104, false, 0x4f6a5a], [-90, 104, true, 0x6a5a4a]]) container(K, x, z, alongZ, 0, c);
      K.platform(-82, 90, 10, 6, 3.4, { stairs: ['w'], stairW: 2.6, color: 0x4f555c, stairColor: CONC2 });
      K.crate(-104, 90); K.crate(-105.3, 90.6); barrel(K, -92, 108); barrel(K, -90.6, 108.4, 0x4f6a5a); shelf(K, -118, 98, false);
      // the admin block east of the road: three rooms in a row, doors between, a rooftop reached by stairs
      building(K, 62, 8, 26, 14, 4.8, { doors: { w: 4, s: 4 }, doorOffset: { s: -6 }, roof: 'full', lamps: 3 });
      K.wall(55.5, 1, 55.5, 15, 4.8, { t: 0.8, color: CONC2, gaps: [[5, 9]] }); K.wall(68.5, 1, 68.5, 15, 4.8, { t: 0.8, color: CONC2, gaps: [[5, 9]] });
      desk(K, 58, 4, false); desk(K, 65, 11, false); shelf(K, 72, 4, false); shelf(K, 50, 12, false); K.crate(66, 3); barrel(K, 72, 13);
      K.stairs(77, 4, 'n', 3, 4.8, { color: CONC2 });
      // the barracks on the north road: three cells off a corridor, half the roof gone
      building(K, 30, -70, 30, 12, 4.4, { doors: { s: 4, n: 4 }, doorOffset: { s: 8, n: -9 }, breaks: [['n', 20, 25]], roof: 'half', lamps: 3 });
      for (const x of [20, 30]) K.wall(x, -76, x, -69, 4.4, { t: 0.7, color: CONC2, gaps: [[2.6, 5]] });
      for (const [x, z] of [[17, -73], [26, -73], [36, -73]]) K.box(x, z, 2.2, 0.6, 1, 0x6a5a48);
      rubble(K, 45, -66, 8, 3);
      // the substation: a transformer hall inside a fenced yard
      building(K, -60, -72, 16, 11, 5.2, { doors: { e: 4 }, roof: 'full', lamps: 2, lampColor: COOL });
      for (const x of [-64, -56]) { K.box(x, -72, 2.4, 3.4, 2.4, 0x55606a); K.box(x, -72, 2.6, 0.3, 2.6, DARK, { y: 3.4, collide: false }); }
      fence(K, -78, -86, -40, -86, 2.6); fence(K, -78, -58, -40, -58, 2.6, [[10, 20]]); fence(K, -78, -86, -78, -58, 2.6); fence(K, -40, -86, -40, -58, 2.6);
      pylon(K, -84, -90); pylon(K, -84, -50); wires(K, -84, -90, -50);
      // the pump house beside the dry dock: pumps, a ventilation fan built into the north wall, doors to the dock
      building(K, 54, 86, 18, 12, 5.6, { doors: { e: 4, w: 4 }, roof: 'full', lamps: 2, lampColor: COOL });
      for (const z of [82, 90]) { K.cyl(50, z, 1.1, 2.4, 0x55606a, { sides: 10 }); K.cyl(50, z, 0.5, 1.4, RUST, { y: 2.4, sides: 8, collide: false }); }
      {
        const fz = 80.45, fx = 58, fy = 3.1, gy0 = K.ground(fx, fz);
        K.box(fx, fz - 0.05, 5.6, 5.6, 0.2, 0xdfeaf2, { y: fy - 2.8, collide: false, glow: 1.4 });
        const fan = new THREE.Group();
        fan.add(new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.14, 6, 18), new THREE.MeshStandardMaterial({ color: FANC, flatShading: true, roughness: 0.7 })));
        for (let i = 0; i < 6; i++) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.4, 0.12), new THREE.MeshStandardMaterial({ color: 0x20242a, flatShading: true }));
          blade.position.set(Math.sin(i * Math.PI / 3) * 1.4, Math.cos(i * Math.PI / 3) * 1.4, 0);
          blade.rotation.z = -i * Math.PI / 3; blade.rotation.y = 0.35;
          fan.add(blade);
        }
        fan.position.set(fx, gy0 + fy, fz + 0.2);
        K.scene.add(fan);
        K.light(fx, 3.2, fz + 1.4, COOL, 9, 16);
      }
      barrel(K, 60, 90); barrel(K, 61.3, 90.6, 0x4f6a5a); K.crate(48, 90); desk(K, 56, 91, true);

      // ================================================================ the shipyard: a dry dock with a hull on cradles, cranes and a gantry
      hull(K, 98, 84, 58, 4.8, 3.2);
      crane(K, 66, 54, 30, 34, 1);
      crane(K, 134, 112, 28, 30, -1);
      gantry(K, 128, 62, 7, 30, [-1, 0], 10);
      // the dock walls: concrete lips along the basin edge, lit by posts
      for (const [x0, z0, x1, z1] of [[64, 52, 136, 52], [64, 118, 136, 118]]) K.wall(x0, z0, x1, z1, 1.4, { t: 1.4, color: CONC, gaps: [[28, 44]] });
      for (let x = 70; x <= 130; x += 20) { lamppost(K, x, 49, 8, Math.PI, SODIUM, 8); lamppost(K, x + 6, 121, 8, 0, SODIUM, 8, x === 90); }
      // half-built hull ribs on the far slip
      for (let dz = -18; dz <= 18; dz += 6) K.mesh(geo('rib8', () => new THREE.TorusGeometry(8, 0.35, 4, 12, Math.PI)), RUST, 124, 0, 150 + dz * 0.7, { collide: false });
      container(K, 76, 130, true, 0, 0x7a4a32); container(K, 76, 138.2, true, 0, 0x4f6a5a); container(K, 84, 134, true, 0, 0x6a5a4a); container(K, 76, 130, true, 2.6, 0x4f6a5a);
      container(K, 140, 128, false, 0, 0x6a5a4a); container(K, 148, 136, false, 0, 0x7a4a32);
      fallenCamp(K, 112, 100, 8);

      // ================================================================ the tank farm and the refinery in the west
      sphereTank(K, -104, -12, 6); sphereTank(K, -90, -26, 5); sphereTank(K, -110, -36, 5);
      hTank(K, -78, -8, 3.2, 14); hTank(K, -72, -34, 3.2, 14);
      pipeRack(K, -116, -48, -64, -48, 3.6, 3); pipeRack(K, -96, -44, -96, -2, 3.4, 2);
      stack(K, -138, -20, 42); stack(K, -144, -36, 34, 2.0); stack(K, -132, -40, 28, 1.8);
      for (const [x, z] of [[-122, -18], [-122, -4], [-86, -42]]) { K.cyl(x, z, 1.4, 6, 0x8a8f94, { sides: 10 }); K.cyl(x, z, 1.1, 1.0, 0xc9a23a, { y: 6, r2: 0.2, sides: 10, collide: false }); }
      for (const [x, z] of [[-98, -50], [-84, -16], [-116, -26]]) lamppost(K, x, z, 8, 0.8, SODIUM, 8);
      fallenCamp(K, -98, -8, 8);
      valveCluster(K, -66, -10);

      // ================================================================ the Wall: a colossal sloped hangar wall along the north, buttressed, teal panels, the bay opening onto the hall
      const BAY = { x0: 22, x1: 58 };
      K.box(-69, WZ - 7, 182, 54, 14, WALLC);                                // x -160 to 22
      K.box(109, WZ - 7, 102, 54, 14, WALLC);                                // x 58 to 160
      K.box(40, WZ - 7, BAY.x1 - BAY.x0, 26, 14, WALLC, { y: 28 });          // the lintel over the bay
      for (let x = -150; x <= 150; x += 20) {
        if (x > BAY.x0 - 6 && x < BAY.x1 + 6) continue;
        K.box(x, WZ + 1.5, 4.4, 46, 3.4, WALLC2);                            // buttresses
        K.box(x, WZ + 0.6, 4.8, 3, 1.6, CONC, { y: 0, collide: false });
        K.box(x + 10, WZ + 0.9, 14, 24, 0.5, K.chance(0.5) ? TEAL : 0x4f555c, { y: 6, collide: false }); // panels between the buttresses
        wallLamp(K, x + 10, WZ + 1.2, 4.6, 's', SODIUM, 7);                  // a lamp on every bay of the wall
      }
      for (const s of [-1, 1]) K.box(s < 0 ? BAY.x0 - 2.5 : BAY.x1 + 2.5, WZ + 1.8, 5, 40, 3.6, CONC);
      K.box(40, WZ + 1.8, 44, 3.4, 3.4, CONC, { y: 26, collide: false });
      for (const yy of [8, 16, 22]) K.box(40, WZ + 1.8, 38, 0.7, 0.3, DARK, { y: yy, collide: false });
      K.box(0, WZ - 0.4, 330, 2, 1.4, CONC, { y: 44, collide: false });      // cornice
      K.box(0, WZ + 1.0, 330, 6, 1, CONC, { y: 52, collide: false });
      for (let x = -140; x <= 140; x += 22) K.mesh(geo('cone6', () => new THREE.ConeGeometry(1, 1, 6)), C.foliage, x + K.R(-4, 4), 60, WZ - 2, { scale: [3, 7, 3], collide: false });
      pipeRack(K, -138, WZ + 4, -50, WZ + 4, 3.0, 2); pipeRack(K, 76, WZ + 4, 150, WZ + 4, 3.0, 2);
      // flood-lit bay: fixtures on both jambs
      for (const s of [-1, 1]) for (const y of [4, 9]) wallLamp(K, s < 0 ? BAY.x0 - 0.3 : BAY.x1 + 0.3, WZ + 3.4, y, s < 0 ? 'e' : 'w', SODIUM, 8);

      // ---- the catwalk hall behind the bay: roofed, a lit billboard wall, a raised catwalk and the way back out
      const HX = 40, HZ2 = -174, HW = 36, HD = 46, HH = 20;
      K.wall(HX - HW / 2, HZ2 - HD / 2, HX - HW / 2, WZ - 12, HH, { t: 1.2, color: CONC2 });
      K.wall(HX + HW / 2, HZ2 - HD / 2, HX + HW / 2, WZ - 12, HH, { t: 1.2, color: CONC2 });
      K.wall(HX - HW / 2, HZ2 - HD / 2, HX + HW / 2, HZ2 - HD / 2, HH, { t: 1.2, color: CONC2 });
      K.box(HX, HZ2, HW + 1.2, 1, HD, 0x30343a, { y: HH, collide: false });
      K.box(HX, HZ2, HW - 0.4, 0.1, HD - 0.4, 0x7d838a, { y: HH - 0.1, collide: false, glow: 0.35 });
      const BX = HX + HW / 2 - 2.4, BL = HD * 0.8;
      K.mesh(new THREE.BoxGeometry(0.4, 15, BL), 0xd98d4a, BX, 8.5, HZ2 + 2, { rz: 0.5, glow: 1.1, collide: false });
      for (let dz = -BL / 2 + 2; dz < BL / 2; dz += 5) K.mesh(new THREE.BoxGeometry(0.3, 15.4, 0.35), DARK, BX - 0.3, 8.5, HZ2 + 2 + dz, { rz: 0.5, collide: false });
      K.box(HX + HW / 2 - 0.5, HZ2 + 2, 1.2, 2.5, BL, 0x5a4a3a, { collide: false });
      // trusses with strip lights hung from them
      for (let z = HZ2 - HD / 2 + 4; z < HZ2 + HD / 2; z += 8) {
        K.box(HX, z, HW, 0.9, 0.9, DARK, { y: HH - 3, collide: false });
        for (const x of [HX - 9, HX + 9]) ceilLamp(K, x, z, HH - 3, 4, true, WARM, 10);
      }
      K.platform(HX - 8, HZ2 - 12, 18, 8, 5, { stairs: ['e'], stairW: 3, color: 0x4f555c, stairColor: CONC2 });
      K.platform(HX + 6, HZ2 - 12, 8, 6, 2.2, { stairs: ['s'], stairW: 3, color: CONC, stairColor: CONC2 });
      container(K, HX - 10, HZ2 + 8, false, 0, 0x4f6a5a); container(K, HX + 8, HZ2 + 12, true, 0, 0x7a4a32);
      barrier(K, HX, HZ2 + 2); barrier(K, HX - 4, HZ2 + 18, false); K.crate(HX + 10, HZ2 - 4); K.crate(HX + 11.3, HZ2 - 5);

      // ================================================================ skyline: a rocket on its gantry, more gantries, radar masts, cranes, a hulk
      rocket(K, -132, -84);
      gantry(K, -120, -84, 9, 46, [-1, 0], 12);
      gantry(K, -140, -24, 8, 38, [1, 0], 12);
      sphereMast(K, 124, -118, 56); sphereMast(K, -148, -120, 44);
      latticeTower(K, 112, -96, 44, 8);
      crane(K, 84, -112, 30, 28, -1);
      fuselageX(K, -20, -124, 34, { wing: 2 });
      container(K, 4, -118, true, 0, 0x6a5a4a);
      for (const [x, z] of [[-110, -100], [-70, -110], [60, -112]]) fallenCamp(K, x, z, 6.5);
      lamppost(K, -128, -66, 9, 1.2, SODIUM, 9); lamppost(K, -112, -96, 9, -1.2, SODIUM, 9);

      // ================================================================ the Hive spire: black blades leaning out of the rocks, a ritual ground of broken wall
      spire(K, 100, -34, 36, 0.2, 0.3, 4.6);
      spire(K, 88, -26, 22, -0.26, -0.5, 3.0);
      spire(K, 112, -22, 18, 0.3, 2.0, 2.6);
      for (const [x, z, s] of [[82, -40, 3.2], [92, -50, 2.6], [112, -44, 3], [118, -30, 2.4], [96, -14, 2.8], [106, -50, 2.2], [84, -22, 2.6], [120, -12, 3.2], [74, -30, 2.4], [100, -58, 3.4]]) K.rock(x, z, s);
      K.scatter((x, z) => K.rock(x, z, K.R(1.2, 3)), 100, -34, 6, 34, 16, 2);
      K.light(100, 2.6, -34, GLOW, 7, 30); // the spire's own glow lights the rocks
      ruinWall(K, 70, -60, 94, -60, 1.6, 3.4, [[8, 12]]); ruinWall(K, 70, -60, 70, -44, 1.4, 3, []);

      // ================================================================ trees, scrub, and wreckage in the gaps
      for (const [cx, cz, n] of [[-60, 156, 4], [70, 156, 4], [-130, 100, 4], [130, -60, 4], [-20, -40, 3], [60, 30, 4], [-80, 120, 3], [124, 90, 3], [-124, -70, 3], [16, 86, 4]]) {
        K.scatter((x, z) => pine(K, x, z), cx, cz, 0, 14, n, 2);
      }
      K.edge((x, z, y) => { const h = K.R(6, 10); K.mesh(geo('cone6', () => new THREE.ConeGeometry(1, 1, 6)), C.foliage, x, y + h * 0.45, z, { scale: [h * 0.28, h * 0.9, h * 0.28], collide: false }); }, 50, 6, 60);
      K.edge((x, z, y) => K.mesh(new THREE.DodecahedronGeometry(K.R(2, 6), 0), C.rock, x, y + 1, z, { collide: false }), 30, 24, 80);
      pylon(K, -150, 150); pylon(K, -150, 100); wires(K, -150, 150, 100);
      skiff(K, -52, 70);

      // ================================================================ the landing
      K.box(0, 156, 12, 0.1, 12, 0x3a3f46, { collide: false });
      K.box(0, 156, 7, 0.12, 7, F_BLUE, { collide: false, glow: 0.6 });
      for (const [x, z] of [[-5, 151], [5, 151], [-5, 161], [5, 161]]) lamppost(K, x, z, 4.5, x < 0 ? Math.PI / 2 : -Math.PI / 2, COOL, 6);
      // scattered scrap and cover on the rest of the yard
      for (const [x, z] of [[-60, 88], [20, 100], [-16, 60], [40, -20], [-30, -50], [70, 40], [-80, 20], [-18, 90]]) { K.crate(x, z); barrier(K, x - 3, z + 2, K.chance(0.5)); if (K.chance(0.5)) fcrate(K, x + 3, z - 3); }
    },
  },
};
