// U23 chunk B: the interactive objects of The Underbelly and The Pleasure Gardens, built from SHADOW_LAYOUT. The runtime (js/dungeon.js)
// decides; this file only draws, moves and reports.
//   Underbelly: gold grates (solid only for the local player while Favored, per machine like the Whisper's phase blocks), pistons and
//               furnace vents on one shared clock (exotic-rules.js moverState / moverBox, imported only), the lever puzzle (four sigil
//               levers, a plaque readable only with Favor, a hatch to the secret alcove), and the Watchers' vision cones.
//   Gardens   : flower beds (bud, then bloom), the prism a Favored player carries, the beasts' awareness eyes, and the north gate.
// Separate from js/mechanics.js (The Whisper's objects), which this file never touches.
import * as THREE from 'three';
import { G } from './state.js';
import { sfx } from './audio.js';
import { sparks } from './effects.js';
import { pointInColliders } from './physics.js';
import { moverState, moverBox } from './exotic-rules.js';
import { drawSigil } from './dungeon-mech.js';
import { GRATE_T } from './level-shadow.js';

const GOLD = 0xd9a520, GOLDL = 0xffc247, PURP = 0x8a3cff, OK = '#ffd24d', BAD = '#ff3a2a';
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.5, ...o });
const add = (mat, o = 1) => new THREE.MeshBasicMaterial({ color: mat, transparent: true, opacity: o, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
function canvasPanel(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx: canvas.getContext('2d'), tex };
}
function addCol(col) { G.colliders.push(col); G.hitDirty = true; return col; }
function dropCol(col) { const k = G.colliders.indexOf(col); if (k >= 0) G.colliders.splice(k, 1); }

/** A gold door filling a wall opening (axis 'x': spans x; 'z': spans z). Raised when open, like the Baths' gate. */
function buildDoor(spec, root, color = GOLD) {
  const { p, w, h } = spec, alongX = spec.axis !== 'z';
  const door = new THREE.Mesh(alongX ? new THREE.BoxGeometry(w, h, 0.6) : new THREE.BoxGeometry(0.6, h, w), std(color, { emissive: 0x2a1a04, emissiveIntensity: 0.3 }));
  door.position.set(p[0], p[1] + h / 2, p[2]);
  root.add(door);
  const box = new THREE.Box3().setFromObject(door);
  const col = addCol({ min: { x: box.min.x, y: box.min.y, z: box.min.z }, max: { x: box.max.x, y: box.max.y, z: box.max.z } });
  G.staticMeshes.push(door);
  return { door, col, open: false, y0: door.position.y, h };
}
/** Opens or closes a door built by buildDoor (the way is clear at once; the door slides up over a few seconds). */
export function setDoor(d, open) {
  if (!d || d.open === open) return;
  d.open = open;
  const j = G.staticMeshes.indexOf(d.door);
  if (open) { dropCol(d.col); if (j >= 0) G.staticMeshes.splice(j, 1); }
  else { if (!G.colliders.includes(d.col)) G.colliders.push(d.col); if (j < 0) G.staticMeshes.push(d.door); d.door.position.y = d.y0; }
  G.hitDirty = true;
}
function stepDoor(d, dt) {
  if (!d) return;
  const goal = d.y0 + (d.open ? d.h : 0), y = d.door.position.y;
  if (Math.abs(y - goal) > 0.01) d.door.position.y += Math.sign(goal - y) * Math.min(Math.abs(goal - y), dt * 3);
}

// ---------------------------------------------------------------------------
// The Underbelly
// ---------------------------------------------------------------------------
export function buildUnderbellyMech(seg) {
  const root = new THREE.Group();
  G.scene.add(root);
  const U = { root, seg, grates: [], pistons: [], vents: [], levers: [], plaque: null, hatch: null, chalices: [], favored: false, out: 0 };
  // grates: a gold lattice deck that slides out of its housings while you hold Favor
  const gMat = std(GOLD, { emissive: 0x6a4410, emissiveIntensity: 0.6, transparent: true, opacity: 1 });
  const ghost = new THREE.LineBasicMaterial({ color: GOLDL, transparent: true, opacity: 0.3, fog: false });
  for (const g of seg.grates) {
    const w = g.x1 - g.x0, d = Math.abs(g.z0 - g.z1), cx = (g.x0 + g.x1) / 2, cz = (g.z0 + g.z1) / 2;
    const grp = new THREE.Group(); grp.position.set(cx, g.top - GRATE_T / 2, cz);
    const slab = new THREE.Group();
    const bars = Math.max(3, Math.round(w / 0.5));
    for (let i = 0; i <= bars; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, GRATE_T, d), gMat); b.position.x = -w / 2 + (i / bars) * w; slab.add(b); }
    for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, GRATE_T, 0.12), gMat); b.position.z = (s * d) / 2; slab.add(b); }
    for (let k = 1; k < Math.round(d / 1); k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.06), gMat); b.position.set(0, GRATE_T / 2 - 0.03, -d / 2 + k); slab.add(b); }
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, GRATE_T, d)), ghost); // where the grate will be
    grp.add(slab, outline);
    root.add(grp);
    const col = addCol({ min: { x: g.x0, y: g.top - GRATE_T, z: Math.min(g.z0, g.z1) }, max: { x: g.x1, y: g.top, z: Math.max(g.z0, g.z1) }, pass: true, grate: true });
    U.grates.push({ spec: g, grp, slab, outline, col });
  }
  // pistons: steel slabs with a glowing face; charge up red to white, slam, hold, retract (the Whisper's timing, our look)
  for (const m of seg.movers) {
    const [sx, sy, sz] = m.s, sgn = Math.sign(m.travel);
    const g = new THREE.Group(); g.position.set(m.p[0], m.p[1], m.p[2]);
    const glow = new THREE.MeshBasicMaterial({ color: 0x401008, fog: false });
    const body = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), std(0x2c3038, { metalness: 0.8, roughness: 0.35 }));
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.08, sy * 0.86, sz * 0.86), glow); face.position.x = sgn * (sx / 2 + 0.02);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.06, 0.2, sz + 0.06), std(GOLD)); trim.position.y = sy / 2 - 0.3;
    const bands = [-0.3, 0, 0.3].map((f) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.05, 0.12, sz + 0.05), glow); b.position.y = f * sy; return b; });
    g.add(body, face, trim, ...bands);
    const len = Math.abs(m.travel) + sx;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, sz), new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.4, depthWrite: false, fog: false })); // the lane it sweeps, on the floor
    rail.position.set(m.p[0] + m.travel / 2, m.p[1] - sy / 2 + 0.03, m.p[2]);
    root.add(g, rail);
    const b = moverBox(m, 0);
    const col = addCol({ min: { x: b.min[0], y: b.min[1], z: b.min[2] }, max: { x: b.max[0], y: b.max[1], z: b.max[2] }, mover: true });
    U.pistons.push({ spec: m, group: g, glow, rail, col, phase: 'rest', u: 0 });
  }
  // furnace vents: a grille that glows and smokes as it charges, then a column of fire
  for (const v of seg.vents) {
    const [sx, sy, sz] = v.s, base = v.p[1] - sy / 2;
    const grille = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.9, 0.05, sz * 0.9), new THREE.MeshBasicMaterial({ color: 0x401008, fog: false }));
    grille.position.set(v.p[0], base + 0.03, v.p[2]);
    const flame = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.85, sy, sz * 0.85), add(0xff7a2a, 0.0));
    flame.position.set(v.p[0], v.p[1], v.p[2]);
    const core = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.5, sy * 0.95, sz * 0.5), add(0xffe08a, 0.0));
    core.position.copy(flame.position);
    root.add(grille, flame, core);
    U.vents.push({ spec: v, grille, flame, core, phase: 'rest', hitT: 0, smokeT: 0 });
  }
  // the plaque: three sigils in order, drawn only while you hold Favor
  if (seg.plaque) {
    const P = canvasPanel(512, 192), m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.6), new THREE.MeshBasicMaterial({ map: P.tex, transparent: true, fog: false }));
    m.position.set(...seg.plaque.p); m.rotation.y = Math.atan2(seg.plaque.n[0], seg.plaque.n[1]);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.9, 0.1), std(GOLD)); frame.position.copy(m.position); frame.rotation.y = m.rotation.y; frame.translateZ(-0.07);
    root.add(frame, m);
    U.plaque = { ...P, mesh: m, order: null, shown: undefined };
  }
  // levers: a brass post with a handle, a sigil disc and a lamp (gold right, red wrong)
  seg.levers.forEach((L, i) => {
    const g = new THREE.Group(); g.position.set(...L.p);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), std(0x3a3e48)); post.position.y = 0.6;
    const pivot = new THREE.Group(); pivot.position.y = 1.15;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), std(GOLD)); handle.position.y = 0.45;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), std(GOLDL, { emissive: 0x6a4410 })); knob.position.y = 0.9;
    pivot.add(handle, knob); pivot.rotation.x = 0.7;
    const P = canvasPanel(256, 256);
    P.ctx.fillStyle = '#2a1440'; P.ctx.beginPath(); P.ctx.arc(128, 128, 120, 0, Math.PI * 2); P.ctx.fill();
    P.ctx.lineWidth = 12; P.ctx.strokeStyle = '#d9a520'; P.ctx.stroke();
    drawSigil(P.ctx, L.sigil, 128, 128, 82, '#ffd24d');
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ map: P.tex, transparent: true, fog: false }));
    disc.position.set(0, 2.6, 0); // faces south (+z), toward the gantry
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x302010, fog: false });
    const lampM = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), lampMat); lampM.position.set(0, 1.95, 0);
    g.add(post, pivot, disc, lampM);
    root.add(g);
    U.levers.push({ i, spec: L, p: v3(L.p), group: g, pivot, lampMat, flashT: 0, lit: false, pullT: 0 });
  });
  if (seg.hatch) U.hatch = buildDoor(seg.hatch, root, 0x8a6a22);
  return U;
}

export function disposeMechB(X) {
  if (!X) return;
  G.scene?.remove(X.root);
  X.root.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
  for (const g of X.grates || []) dropCol(g.col);
  for (const p of X.pistons || []) dropCol(p.col);
  for (const d of [X.hatch, X.gate]) if (d) { dropCol(d.col); const j = G.staticMeshes?.indexOf(d.door) ?? -1; if (j >= 0) G.staticMeshes.splice(j, 1); }
  for (const c of X.chalices || []) G.scene?.remove(c.group);
  if (X.prism) X.prism.parent?.remove(X.prism);
  for (const s of X.eyes || []) G.scene?.remove(s.sprite);
  G.hitDirty = true;
}

/** The lever order on the plaque (or null: blank). */
export function setPlaque(U, order) { U.plaque.order = order; U.plaque.shown = undefined; }
function drawPlaque(U) {
  const Q = U.plaque, want = U.favored && Q.order ? Q.order.join() : '';
  if (Q.shown === want) return;
  Q.shown = want;
  const { ctx, canvas, tex } = Q, W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#1a0c26'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#d9a520'; ctx.lineWidth = 10; ctx.strokeRect(6, 6, W - 12, H - 12);
  if (want) Q.order.forEach((sg, k) => drawSigil(ctx, sg, ((k + 0.5) / Q.order.length) * W, H / 2, H * 0.34, '#ffd24d'));
  else { ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(((k + 0.5) / 3) * W, H / 2, H * 0.3, 0, Math.PI * 2); ctx.fill(); } }
  tex.needsUpdate = true;
}
/** A lever result: 'ok' lights its lamp gold, 'bad' flashes every lamp red and drops them, 'reset' darkens them all. */
export function leverFx(U, i, kind) {
  const L = U.levers[i];
  if (L) { L.pullT = 0.5; sparks(L.p.clone().setY(L.p.y + 2), kind === 'bad' ? 0xff3a2a : 0xffd24d, 14, 5, 0.08, 0.4); }
  if (kind === 'ok' && L) { L.lit = true; L.lampMat.color.setHex(0xffd24d); sfx.glyphRight(); }
  if (kind === 'bad') { for (const Q of U.levers) { Q.lit = false; Q.flashT = 0.9; Q.lampMat.color.setHex(0xff3a2a); } sfx.glyphWrong(); }
  if (kind === 'reset') for (const Q of U.levers) { Q.lit = false; Q.lampMat.color.setHex(0x302010); }
}
/** The lever within reach of a position, or -1. */
export function leverAt(U, pos) {
  for (const L of U.levers) if (Math.hypot(pos.x - L.p.x, pos.z - L.p.z) < 1.9 && Math.abs(pos.y - L.p.y) < 1.5) return L.i;
  return -1;
}

const _pv = new THREE.Vector3();
/** The player's body inside a piston's box: carried ahead of its face with an outward kick (or behind it), never left inside a solid. */
function pushOut(m, b, P, onTrapped) {
  const r = P.radius ?? 0.4, h = P.height ?? 1.8, ai = m.spec.axis === 'x' ? 0 : 2;
  if (P.pos.x + r <= b.min[0] || P.pos.x - r >= b.max[0] || P.pos.z + r <= b.min[2] || P.pos.z - r >= b.max[2] || P.pos.y + h <= b.min[1] || P.pos.y >= b.max[1]) return false;
  const key = ai === 0 ? 'x' : 'z', sgn = Math.sign(m.spec.travel), mid = (b.min[ai] + b.max[ai]) / 2;
  const lead = sgn > 0 ? b.max[ai] + r + 0.05 : b.min[ai] - r - 0.05, trail = sgn > 0 ? b.min[ai] - r - 0.05 : b.max[ai] + r + 0.05;
  const ahead = (P.pos[key] - mid) * sgn >= 0, from = P.pos[key];
  const tryAt = (v, dir) => {
    P.pos[key] = v;
    if (pointInColliders({ x: P.pos.x, y: P.pos.y + 0.9, z: P.pos.z }, 0, true)) return false;
    P.vel[key] = dir * m.spec.push; P.vel.y = Math.max(P.vel.y, 3.2); P.onGround = false;
    return true;
  };
  if (!(ahead ? tryAt(lead, sgn) : tryAt(trail, -sgn)) && !(ahead ? tryAt(trail, -sgn) : tryAt(lead, sgn))) { P.pos[key] = from; onTrapped?.(P); }
  P.shake = Math.max(P.shake || 0, 0.4);
  return true;
}

/**
 * Per frame, everyone. `favorLeft`: the local player's Favor seconds (0 without). `T`: the shared clock (pistons and vents).
 * Returns the vent that just blasted the local player, or null (the runtime applies the capped damage).
 */
export function updateUnderbellyMech(U, dt, favorLeft, T, P) {
  const fav = favorLeft > 0;
  U.favored = fav;
  // grates slide out over 0.35 s when Favor starts and flicker in the last 3 seconds; solid only while Favored
  U.out = Math.max(0, Math.min(1, U.out + (fav ? dt : -dt) / 0.35));
  const blink = fav && favorLeft < 3 ? 0.55 + 0.45 * Math.sin(T * 16) : 1;
  for (const g of U.grates) {
    g.col.pass = !fav;
    g.slab.scale.x = Math.max(0.02, U.out);
    g.slab.visible = U.out > 0.02;
    g.slab.children.forEach((c) => { c.material.opacity = blink; });
    g.outline.visible = !fav;
  }
  // pistons
  for (const m of U.pistons) {
    const st = moverState(m.spec, T), b = moverBox(m.spec, st.u);
    m.u = st.u;
    m.group.position.set(m.spec.p[0], m.spec.p[1], m.spec.p[2]);
    m.group.position[m.spec.axis] += m.spec.travel * st.u;
    Object.assign(m.col.min, { x: b.min[0], y: b.min[1], z: b.min[2] }); Object.assign(m.col.max, { x: b.max[0], y: b.max[1], z: b.max[2] });
    const k = st.phase === 'tele' ? st.tele : st.phase === 'fire' || st.phase === 'hold' ? 1 : st.phase === 'ret' ? 0.35 : 0;
    const flick = st.phase === 'tele' ? 0.7 + 0.3 * Math.sin(T * (10 + 24 * st.tele)) : 1;
    m.glow.color.setRGB(0.25 + 0.75 * k * flick, 0.06 + 0.5 * k * k * flick, 0.04 + 0.35 * k * k * k);
    m.rail.material.opacity = 0.25 + 0.55 * k;
    if (st.phase !== m.phase) {
      _pv.set(m.spec.p[0], m.spec.p[1], m.spec.p[2]);
      const near = P && _pv.distanceTo(P.pos) < 40;
      if (near && st.phase === 'tele') sfx.pistonHum(_pv.clone());
      if (near && st.phase === 'fire') sfx.pistonSlam(_pv.clone());
      m.phase = st.phase;
    }
    if (P && !P.dead && st.u > 0.002) pushOut(m, b, P);
  }
  // vents: the grille glows through the charge, then the fire stands for the fire + hold phases
  let blast = null;
  for (const v of U.vents) {
    const st = moverState(v.spec, T);
    const hot = st.phase === 'fire' || st.phase === 'hold';
    const k = st.phase === 'tele' ? st.tele : hot ? 1 : st.phase === 'ret' ? 0.4 * (1 - (st.u ?? 0)) : 0;
    v.grille.material.color.setRGB(0.25 + 0.75 * k, 0.06 + 0.45 * k * k, 0.03);
    v.flame.material.opacity = hot ? 0.55 + 0.15 * Math.sin(T * 30) : st.phase === 'ret' ? 0.25 * st.u : 0;
    v.core.material.opacity = hot ? 0.6 : 0;
    v.flame.scale.y = hot ? 1 : Math.max(0.05, st.u);
    v.flame.position.y = v.spec.p[1] - (v.spec.s[1] * (1 - v.flame.scale.y)) / 2;
    v.smokeT -= dt;
    if (st.phase === 'tele' && v.smokeT <= 0) { v.smokeT = 0.12; sparks(v.grille.position.clone().setY(v.grille.position.y + 0.2), 0xff8a3a, 3, 2.5, 0.06, 0.5); }
    if (st.phase !== v.phase) {
      const near = P && v.grille.position.distanceTo(P.pos) < 36;
      if (near && st.phase === 'tele') sfx.pistonHum(v.grille.position.clone());
      if (near && st.phase === 'fire') sfx.explosion?.(3, v.grille.position);
      v.phase = st.phase;
    }
    v.hitT -= dt;
    if (hot && P && !P.dead && v.hitT <= 0) {
      const [sx, sy, sz] = v.spec.s, [cx, cy, cz] = v.spec.p;
      if (Math.abs(P.pos.x - cx) < sx / 2 + 0.3 && Math.abs(P.pos.z - cz) < sz / 2 + 0.3 && P.pos.y < cy + sy / 2 && P.pos.y + 1.8 > cy - sy / 2) { v.hitT = 0.6; blast = v; }
    }
  }
  // levers and plaque
  for (const L of U.levers) {
    if (L.pullT > 0) { L.pullT -= dt; L.pivot.rotation.x = 0.7 - 1.4 * Math.sin(Math.min(1, (0.5 - L.pullT) / 0.5) * Math.PI); }
    if (L.flashT > 0) { L.flashT -= dt; if (L.flashT <= 0) L.lampMat.color.setHex(L.lit ? 0xffd24d : 0x302010); }
  }
  if (U.plaque) drawPlaque(U);
  stepDoor(U.hatch, dt);
  for (const c of U.chalices) { c.t += dt; c.group.rotation.y += dt * 1.5; c.group.children[0].position.y = 0.75 + Math.sin(c.t * 3) * 0.05; }
  return blast;
}

// ---------------------------------------------------------------------------
// Watchers: a translucent vision cone (purple, red once its deck is alarmed) and the lens colour, on whatever machine draws the unit
// ---------------------------------------------------------------------------
const CONE_TILT = 0.14;
/** Adds the cone to a Watcher's model once. range, half: its vision (dungeon-rules.js underbelly.watch). */
export function dressWatcher(e, range, half) {
  if (e._cone || !e.model?.group) return;
  const r = range * Math.tan(half);
  const geo = new THREE.ConeGeometry(r, range, 20, 1, true).rotateX(-Math.PI / 2).translate(0, 0, range / 2);
  const cone = new THREE.Mesh(geo, add(PURP, 0.07));
  cone.position.y = 0.6; cone.rotation.x = CONE_TILT;
  cone.userData.noHit = true; cone.raycast = () => {};
  e.model.group.add(cone);
  e._cone = cone;
}
/** Recolours a Watcher: aware 0..1 (yellows as it notices), alarmed (red). */
export function tintWatcher(e, aware, alarmed) {
  if (!e._cone) return;
  const c = alarmed ? [1, 0.15, 0.1] : [0.54 + 0.46 * aware, 0.24 + 0.5 * aware, 1 - 0.8 * aware];
  e._cone.material.color.setRGB(...c);
  e._cone.material.opacity = alarmed ? 0.13 : 0.06 + 0.08 * aware;
  e.model.lens?.emissive?.setRGB(...c);
}

// ---------------------------------------------------------------------------
// The Pleasure Gardens
// ---------------------------------------------------------------------------
export function buildGardensMech(seg) {
  const root = new THREE.Group();
  G.scene.add(root);
  const X = { root, seg, flowers: [], chalices: [], eyes: [], gate: null, prism: null, ring: null, favored: false };
  seg.flowers.forEach((f, i) => {
    const g = new THREE.Group(); g.position.set(...f);
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.25, 12), std(0xe9e2d2)); bed.position.y = 0.12;
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.05, 12), std(0x2a1c14)); soil.position.y = 0.26;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.3, 6), std(0x3a6a3a)); stem.position.y = 0.9;
    const budMat = std(0x6a3a8a, { emissive: 0x2a0a40, emissiveIntensity: 0.4 });
    const bud = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), budMat); bud.position.y = 1.65; bud.scale.y = 1.6;
    const petals = new THREE.Group(); petals.position.y = 1.6;
    const pMat = std(GOLDL, { emissive: 0xffa82a, emissiveIntensity: 1.2 });
    for (let k = 0; k < 6; k++) { const pt = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.75), pMat); pt.position.set(Math.sin((k * Math.PI) / 3) * 0.42, 0, Math.cos((k * Math.PI) / 3) * 0.42); pt.rotation.set(-0.5, (k * Math.PI) / 3, 0); petals.add(pt); }
    petals.visible = false;
    const halo = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.1, 28).rotateX(-Math.PI / 2), add(0xb47cff, 0)); halo.position.y = 0.3;
    g.add(bed, soil, stem, bud, petals, halo);
    root.add(g);
    X.flowers.push({ i, p: v3(f), group: g, bud, budMat, petals, halo, state: 'off', t: Math.random() * 6 });
  });
  // the channel ring: fills round your feet while you light a flower (local)
  const ring = canvasPanel(256, 256);
  X.ring = { ...ring, mesh: new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ring.tex, transparent: true, depthWrite: false, fog: false })), k: -1 };
  X.ring.mesh.visible = false; root.add(X.ring.mesh);
  // the prism a Favored player carries: a small gold crystal floating at the lower right of the view
  const prism = new THREE.Group();
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffa82a, emissiveIntensity: 1.4, transparent: true, opacity: 0.9, metalness: 0.3, roughness: 0.2 }));
  crystal.scale.y = 1.7; prism.add(crystal);
  prism.position.set(0.34, -0.24, -0.62); prism.visible = false;
  G.camera?.add(prism);
  X.prism = prism; X.crystal = crystal;
  if (seg.gate) X.gate = buildDoor(seg.gate, root);
  return X;
}
/** A flower's state: 'off' (not in this round), 'bud' (light it), 'bloom' (lit). */
export function setFlower(X, i, state) {
  const F = X.flowers[i];
  if (!F || F.state === state) return;
  const was = F.state;
  F.state = state;
  F.bud.visible = state !== 'bloom'; F.petals.visible = state === 'bloom';
  F.budMat.color.setHex(state === 'bud' ? 0xb47cff : 0x4a3050); F.budMat.emissive.setHex(state === 'bud' ? 0x6a2aa0 : 0x100818);
  F.halo.material.opacity = state === 'bud' ? 0.35 : state === 'bloom' ? 0.5 : 0;
  F.halo.material.color.setHex(state === 'bloom' ? 0xffc247 : 0xb47cff);
  if (state === 'bloom' && was === 'bud') { sparks(F.p.clone().setY(F.p.y + 1.7), 0xffd24d, 24, 6, 0.1, 0.6); sfx.glyphRight(); }
}
/** The nearest bud within `r` of a position, or -1. */
export function budAt(X, pos, r) {
  let best = -1, bd = r;
  for (const F of X.flowers) { if (F.state !== 'bud') continue; const d = Math.hypot(pos.x - F.p.x, pos.z - F.p.z); if (d < bd && Math.abs(pos.y - F.p.y) < 2) { bd = d; best = F.i; } }
  return best;
}
/** Draws the channel ring at flower i filled to k (0..1), or hides it (i < 0). */
export function setChannel(X, i, k) {
  const R = X.ring;
  R.mesh.visible = i >= 0;
  if (i < 0) return;
  R.mesh.position.copy(X.flowers[i].p).setY(X.flowers[i].p.y + 0.32);
  const q = Math.round(k * 40) / 40;
  if (q === R.k) return;
  R.k = q;
  const { ctx } = R;
  ctx.clearRect(0, 0, 256, 256);
  ctx.lineWidth = 18; ctx.strokeStyle = 'rgba(180,124,255,0.35)'; ctx.beginPath(); ctx.arc(128, 128, 104, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = OK; ctx.beginPath(); ctx.arc(128, 128, 104, -Math.PI / 2, -Math.PI / 2 + q * Math.PI * 2); ctx.stroke();
  R.tex.needsUpdate = true;
}
/** An awareness eye over a beast: grey to yellow to red, bigger as it fills. One sprite per beast index, placed by the runtime. */
export function beastEye(X, i, pos, aware, howling) {
  let E = X.eyes[i];
  if (!E) {
    const P = canvasPanel(128, 128);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: P.tex, transparent: true, depthTest: false, fog: false }));
    sprite.renderOrder = 5; G.scene.add(sprite);
    E = X.eyes[i] = { ...P, sprite, key: '' };
  }
  E.sprite.visible = aware > 0.02 || howling;
  if (!E.sprite.visible) return;
  E.sprite.position.copy(pos);
  const s = 0.9 + 0.9 * aware; E.sprite.scale.set(s, s * 0.62, 1);
  const key = howling ? 'h' : String(Math.round(aware * 20));
  if (key === E.key) return;
  E.key = key;
  const { ctx, tex } = E, col = howling || aware >= 1 ? BAD : aware > 0.5 ? '#ffb347' : '#ffe9a8';
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(10,4,14,0.75)'; ctx.beginPath(); ctx.ellipse(64, 64, 60, 38, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 8; ctx.beginPath(); ctx.ellipse(64, 64, 52, 30, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(64, 64, 18, 18 * Math.max(0.25, aware), 0, 0, Math.PI * 2); ctx.fill();
  tex.needsUpdate = true;
}
export function updateGardensMech(X, dt, favored, T) {
  X.favored = favored;
  X.prism.visible = favored;
  if (favored) { X.crystal.rotation.y += dt * 2.2; X.prism.position.y = -0.24 + Math.sin(T * 2.4) * 0.008; }
  for (const F of X.flowers) {
    F.t += dt;
    if (F.state === 'bud') { F.bud.rotation.y += dt; F.halo.material.opacity = 0.25 + 0.15 * Math.sin(F.t * 3); }
    if (F.state === 'bloom') F.petals.rotation.y += dt * 0.5;
  }
  stepDoor(X.gate, dt);
  for (const c of X.chalices) { c.t += dt; c.group.rotation.y += dt * 1.5; c.group.children[0].position.y = 0.75 + Math.sin(c.t * 3) * 0.05; }
}
