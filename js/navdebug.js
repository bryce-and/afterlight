// Dev overlay for enemy navigation (U13a): /gamerule NavDebug true.
// Red points = blocked cells, yellow = ledge cells, blue = open ground near the Guardian;
// cyan lines = each enemy's current path, green rectangle = the active zone's closed room.
import * as THREE from 'three';
import { G } from './state.js';
import { DEV } from './devcommands.js';
import { NAV, cellIndex } from './nav.js';

let group = null, t = 0;

function clear() {
  if (!group) return;
  G.scene?.remove(group);
  group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  group = null;
}

export function updateNavDebug(dt) {
  if (!DEV.navdebug || !G.nav || !G.scene || !G.player) { clear(); return; }
  t -= dt;
  if (t > 0 && group) return;
  t = 0.3;
  clear();
  group = new THREE.Group();
  const nav = G.nav, P = G.player.pos, R = 36;
  const pts = { open: [], block: [], ledge: [] };
  const i0 = Math.floor((P.x - R - nav.minX) / nav.cell), i1 = Math.floor((P.x + R - nav.minX) / nav.cell);
  const j0 = Math.floor((P.z - R - nav.minZ) / nav.cell), j1 = Math.floor((P.z + R - nav.minZ) / nav.cell);
  for (let j = Math.max(0, j0); j <= Math.min(nav.D - 1, j1); j++) {
    for (let i = Math.max(0, i0); i <= Math.min(nav.W - 1, i1); i++) {
      const h = nav.hgt[j * nav.W + i], x = nav.minX + (i + 0.5) * nav.cell, z = nav.minZ + (j + 0.5) * nav.cell;
      const y = Math.max(0, h) + 0.12;
      (h < 0 ? pts.block : h >= NAV.ledgeMin ? pts.ledge : pts.open).push(x, y, z);
    }
  }
  for (const [k, color] of [['open', 0x3a8fff], ['block', 0xff3a3a], ['ledge', 0xffd23a]]) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts[k], 3));
    group.add(new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.18, sizeAttenuation: true, depthTest: false })));
  }
  const lines = [];
  for (const e of G.enemies) {
    if (!e.alive || !e.path) continue;
    let px = e.pos.x, pz = e.pos.z;
    for (let k = e.pathIdx; k < e.path.length; k++) { lines.push(px, e.pos.y + 0.3, pz, e.path[k].x, e.pos.y + 0.3, e.path[k].z); px = e.path[k].x; pz = e.path[k].z; }
  }
  if (lines.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x40ffff, depthTest: false })));
  }
  const z = G.mission?.zones?.[G.mission.current];
  if (z?.room) {
    const q = z.room, y = 0.2;
    const ring = [q.minX, y, q.minZ, q.maxX, y, q.minZ, q.maxX, y, q.minZ, q.maxX, y, q.maxZ, q.maxX, y, q.maxZ, q.minX, y, q.maxZ, q.minX, y, q.maxZ, q.minX, y, q.minZ];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(ring, 3));
    group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x40ff60, depthTest: false })));
  }
  group.traverse((o) => { o.renderOrder = 999; o.frustumCulled = false; });
  G.scene.add(group);
}
