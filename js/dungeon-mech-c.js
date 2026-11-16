// U23 chunk C: the interactive objects of The Gauntlet and The Throne, built from SHADOW_LAYOUT. The runtime (js/dungeon-c.js) decides;
// this file only draws, moves and reports.
//   Gauntlet: gold-grate stairs (solid only for the local player while Favored, as the Underbelly's grates), the shield wall across each
//             landing with its four sigil plates and the herald board (the row's sigil, drawn only under Favor), the sweeping wards (movers
//             on the shared clock: exotic-rules.js moverState / moverBox, imported only), and the hidden alcove's door.
//   Throne  : the four Thought Lanterns and the Mind board (seen and shot only inside the Mindscape), Calus's Gaze (a sweeping beam from
//             the throne), and The Emperor's Feast (the gold orb that swells over him in his final stand).
import * as THREE from 'three';
import { G } from './state.js';
import { sfx } from './audio.js';
import { sparks } from './effects.js';
import { moverState, moverBox } from './exotic-rules.js';
import { drawSigil, setExtraTargets } from './dungeon-mech.js';
import { buildDoor, setDoor, stepDoor, pushOut } from './dungeon-mech-b.js';
import { GRATE_T } from './level-shadow.js';

const GOLD = 0xd9a520, GOLDL = 0xffc247, OK = '#ffd24d', BAD = '#ff3a2a';
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.5, ...o });
const glowMat = (color, o = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: o, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
function canvasPanel(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx: canvas.getContext('2d'), tex };
}
function addCol(col) { G.colliders.push(col); G.hitDirty = true; return col; }
function dropCol(col) { const k = G.colliders.indexOf(col); if (k >= 0) G.colliders.splice(k, 1); G.hitDirty = true; }
function medallion(P, sigil, ring = '#d9a520', fill = '#ffd24d') {
  const { ctx, canvas, tex } = P, S = canvas.width, c = S / 2;
  ctx.clearRect(0, 0, S, S);
  const g = ctx.createRadialGradient(c, c * 0.8, S * 0.05, c, c, S * 0.48);
  g.addColorStop(0, '#b47cff'); g.addColorStop(1, '#3a1460');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, S * 0.47, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = S * 0.05; ctx.strokeStyle = ring; ctx.stroke();
  if (sigil) drawSigil(ctx, sigil, c, c, S * 0.32, fill);
  tex.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// The Gauntlet
// ---------------------------------------------------------------------------
export function buildGauntletMech(seg) {
  const root = new THREE.Group();
  G.scene.add(root);
  const X = { root, seg, grates: [], stairs: [], rows: [], wards: [], chalices: [], door: null, favored: false, out: 0 };
  // stairs: one instanced slab mesh and one ghost outline per row; a collider per tile (pass unless Favored)
  const box = new THREE.BoxGeometry(1, 1, 1);
  const runs = [...new Set(seg.grates.map((g) => g.run))];
  for (const run of runs) {
    const tiles = seg.grates.filter((g) => g.run === run);
    const slabMat = std(GOLD, { emissive: 0x6a4410, emissiveIntensity: 0.7, transparent: true, opacity: 1 });
    const ghostMat = glowMat(GOLDL, 0.16);
    const slab = new THREE.InstancedMesh(box, slabMat, tiles.length), ghost = new THREE.InstancedMesh(box, ghostMat, tiles.length);
    const m = new THREE.Matrix4();
    tiles.forEach((g, k) => {
      const w = g.x1 - g.x0, d = Math.abs(g.z0 - g.z1);
      m.compose(new THREE.Vector3((g.x0 + g.x1) / 2, g.top - GRATE_T / 2, (g.z0 + g.z1) / 2), new THREE.Quaternion(), new THREE.Vector3(w, GRATE_T, d));
      slab.setMatrixAt(k, m); ghost.setMatrixAt(k, m);
      const col = addCol({ min: { x: g.x0, y: g.top - GRATE_T, z: Math.min(g.z0, g.z1) }, max: { x: g.x1, y: g.top, z: Math.max(g.z0, g.z1) }, pass: true, grate: true });
      X.grates.push({ spec: g, col });
    });
    slab.frustumCulled = false; ghost.frustumCulled = false;
    root.add(slab, ghost);
    X.stairs.push({ run, slab, ghost, slabMat, ghostMat });
  }
  // shield walls, plates and heralds
  for (const R of seg.rows) {
    const W = R.wall, w = W.x1 - W.x0, cx = (W.x0 + W.x1) / 2;
    const shieldMat = glowMat(0x9a4cff, 0.32);
    const shield = new THREE.Mesh(new THREE.PlaneGeometry(w, W.h), shieldMat);
    shield.position.set(cx, W.y + W.h / 2, W.z);
    const frame = new THREE.Group();
    for (const x of [W.x0 + 0.3, W.x1 - 0.3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, W.h + 0.6, 0.8), std(GOLD)); p.position.set(x, W.y + W.h / 2, W.z); frame.add(p); }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, 0.9), std(GOLD)); lintel.position.set(cx, W.y + W.h + 0.25, W.z); frame.add(lintel);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.9), glowMat(0xb06cff, 0.8)); sill.position.set(cx, W.y + 0.06, W.z); frame.add(sill);
    root.add(shield, frame);
    const col = addCol({ min: { x: W.x0, y: W.y, z: W.z - 0.4 }, max: { x: W.x1, y: W.y + W.h, z: W.z + 0.4 } });
    // the herald: a medallion on the wall's south face (a gold ring always; the sigil only under Favor)
    const HP = canvasPanel(256, 256);
    const herald = new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), new THREE.MeshBasicMaterial({ map: HP.tex, transparent: true, fog: false, depthWrite: false }));
    herald.position.set(...W.herald); herald.renderOrder = 3;
    const backer = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.3, 24).rotateX(Math.PI / 2), std(GOLD, { emissive: 0x3a2408 }));
    backer.position.set(W.herald[0], W.herald[1], W.herald[2] - 0.2);
    root.add(backer, herald);
    const plates = W.plates.map((pl, i) => {
      const g = new THREE.Group(); g.position.set(...pl.p);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.16, 16), std(0xe9e2d2)); base.position.y = 0.08;
      const rimMat = glowMat(0xb06cff, 0.5);
      const rim = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.45, 28).rotateX(-Math.PI / 2), rimMat); rim.position.y = 0.17;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 0.18), std(GOLD)); post.position.y = 0.95;
      const P = canvasPanel(256, 256); medallion(P, pl.sigil);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.75, 28), new THREE.MeshBasicMaterial({ map: P.tex, transparent: true, fog: false, side: THREE.DoubleSide }));
      disc.position.y = 2.3;
      const L = canvasPanel(256, 96);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ map: L.tex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      label.position.y = 3.35; label.visible = false;
      g.add(base, rim, post, disc, label);
      root.add(g);
      return { i, sigil: pl.sigil, p: v3(pl.p), group: g, disc, rimMat, label, L, flashT: 0 };
    });
    X.rows.push({ row: R.row, spec: W, shield, shieldMat, frame, col, open: false, fade: 1, herald: { ...HP, mesh: herald, sigil: null, shown: undefined }, plates });
  }
  // sweeping wards: a tall purple energy slab in a gold frame, charging white before it sweeps across the stair
  for (const m of seg.movers) {
    const [sx, sy, sz] = m.s;
    const g = new THREE.Group(); g.position.set(m.p[0], m.p[1], m.p[2]);
    const core = glowMat(0x7a2ad0, 0.4);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), core);
    const caps = [-1, 1].map((s) => { const c = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.2, 0.3, sz + 0.2), std(GOLD, { emissive: 0x3a2408 })); c.position.y = (s * sy) / 2; return c; });
    g.add(slab, ...caps);
    const t0 = m.p[1] - 4.0; // the tile it crosses
    const rail = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(m.travel) + sx, 0.04, sz), glowMat(0xb06cff, 0.2));
    rail.position.set(m.p[0] + m.travel / 2, t0 + 0.04, m.p[2]);
    root.add(g, rail);
    const b = moverBox(m, 0);
    const col = addCol({ min: { x: b.min[0], y: b.min[1], z: b.min[2] }, max: { x: b.max[0], y: b.max[1], z: b.max[2] }, mover: true });
    X.wards.push({ spec: m, group: g, core, rail, col, phase: 'rest' });
  }
  if (seg.secretDoor) X.door = buildDoor(seg.secretDoor, root, 0x8a6a22);
  return X;
}

/** The row's herald sigil (null: none yet). Drawn only while the local player holds Favor. */
export function setRowSigil(X, r, sigil) { const H = X.rows[r]?.herald; if (H) { H.sigil = sigil; H.shown = undefined; } }
function drawHerald(X, R) {
  const H = R.herald, want = R.open ? 'open' : X.favored && H.sigil ? H.sigil : '';
  if (H.shown === want) return;
  H.shown = want;
  const P = { canvas: H.canvas, ctx: H.ctx, tex: H.tex };
  if (want === 'open') medallion(P, null, '#ffd24d');
  else if (want) medallion(P, want, '#ffd24d');
  else { medallion(P, null); const c = H.canvas.width / 2; H.ctx.fillStyle = 'rgba(255,255,255,0.14)'; H.ctx.beginPath(); H.ctx.arc(c, c, c * 0.3, 0, Math.PI * 2); H.ctx.fill(); H.tex.needsUpdate = true; }
}
/** Drops (or raises) a row's shield wall. */
export function setWall(X, r, open) {
  const R = X.rows[r];
  if (!R || R.open === open) return;
  R.open = open;
  if (open) { dropCol(R.col); sparks(R.shield.position.clone(), 0xb06cff, 30, 9, 0.12, 0.7); sfx.blightDown?.(); }
  else { if (!G.colliders.includes(R.col)) addCol(R.col); R.fade = 1; }
  R.herald.shown = undefined;
}
/** An offering's flash on a plate: 'ok' gold, 'bad' red. */
export function flashGPlate(X, r, i, kind) {
  const P = X.rows[r]?.plates[i];
  if (!P) return;
  P.flashT = 0.8; P.rimMat.color.setHex(kind === 'ok' ? 0xffd24d : 0xff3a2a); P.rimMat.opacity = 0.95;
  sparks(P.p.clone().setY(P.p.y + 1.2), kind === 'ok' ? 0xffd24d : 0xff3a2a, 18, 6, 0.1, 0.5);
  if (kind === 'ok') sfx.glyphRight(); else sfx.glyphWrong();
}
/** "1 of 3" over a plate for the local player's strikes (0 hides it). */
export function setGStrike(X, r, i, n, limit) {
  const P = X.rows[r]?.plates[i];
  if (!P) return;
  P.label.visible = n > 0;
  if (!n) return;
  const { ctx, canvas, tex } = P.L;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(30,6,10,0.8)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = BAD; ctx.font = 'bold 54px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${n} of ${limit}`, canvas.width / 2, canvas.height / 2);
  tex.needsUpdate = true;
}
/** The plate a position stands on: { r, i } or null. Only rows whose wall still stands. */
export function gPlateAt(X, pos) {
  for (const R of X.rows) {
    if (R.open) continue;
    for (const P of R.plates) if (Math.hypot(pos.x - P.p.x, pos.z - P.p.z) < 1.6 && Math.abs(pos.y - P.p.y) < 1.2) return { r: R.row, i: P.i };
  }
  return null;
}
export const openSecretDoor = (X) => setDoor(X.door, true);

/** Per frame, everyone. `favorLeft`: the local player's Favor seconds. `T`: the shared clock (wards). */
export function updateGauntletMech(X, dt, favorLeft, T, P) {
  const fav = favorLeft > 0;
  X.favored = fav;
  X.out = Math.max(0, Math.min(1, X.out + (fav ? dt : -dt) / 0.35));
  const blink = fav && favorLeft < 3 ? 0.55 + 0.45 * Math.sin(T * 16) : 1;
  for (const g of X.grates) g.col.pass = !fav;
  for (const S of X.stairs) { S.slab.visible = X.out > 0.02; S.slabMat.opacity = X.out * blink; S.ghost.visible = !fav; }
  const cam = G.camera;
  for (const R of X.rows) {
    drawHerald(X, R);
    if (R.open && R.fade > 0) { R.fade = Math.max(0, R.fade - dt * 1.5); R.shieldMat.opacity = 0.32 * R.fade; R.shield.visible = R.fade > 0.01; }
    else if (!R.open) R.shieldMat.opacity = 0.26 + 0.08 * Math.sin(T * 2.2);
    for (const Q of R.plates) {
      if (Q.flashT > 0) { Q.flashT -= dt; if (Q.flashT <= 0) { Q.rimMat.color.setHex(0xb06cff); Q.rimMat.opacity = 0.5; } }
      if (R.open) Q.rimMat.opacity = 0.12;
      if (cam) { const wp = Q.group.position; Q.disc.rotation.y = Math.atan2(cam.position.x - wp.x, cam.position.z - wp.z); Q.label.rotation.y = Q.disc.rotation.y; }
    }
  }
  for (const m of X.wards) {
    const st = moverState(m.spec, T), b = moverBox(m.spec, st.u);
    m.group.position.set(m.spec.p[0], m.spec.p[1], m.spec.p[2]);
    m.group.position[m.spec.axis] += m.spec.travel * st.u;
    Object.assign(m.col.min, { x: b.min[0], y: b.min[1], z: b.min[2] }); Object.assign(m.col.max, { x: b.max[0], y: b.max[1], z: b.max[2] });
    const k = st.phase === 'tele' ? st.tele : st.phase === 'fire' || st.phase === 'hold' ? 1 : st.phase === 'ret' ? 0.35 : 0;
    const flick = st.phase === 'tele' ? 0.7 + 0.3 * Math.sin(T * (10 + 24 * st.tele)) : 1;
    m.core.color.setRGB(0.45 + 0.55 * k * flick, 0.16 + 0.8 * k * k * flick, 0.82 + 0.18 * k);
    m.core.opacity = 0.32 + 0.45 * k;
    m.rail.material.opacity = 0.15 + 0.6 * k;
    if (st.phase !== m.phase) {
      const near = P && m.group.position.distanceTo(P.pos) < 40;
      if (near && st.phase === 'tele') sfx.pistonHum(m.group.position.clone());
      if (near && st.phase === 'fire') sfx.pistonSlam(m.group.position.clone());
      m.phase = st.phase;
    }
    if (P && !P.dead && st.u > 0.002) pushOut(m, b, P);
  }
  stepDoor(X.door, dt);
  for (const c of X.chalices) { c.t += dt; c.group.rotation.y += dt * 1.5; c.group.children[0].position.y = 0.75 + Math.sin(c.t * 3) * 0.05; }
}

// ---------------------------------------------------------------------------
// The Throne
// ---------------------------------------------------------------------------
export function buildThroneMech(seg) {
  const root = new THREE.Group();
  G.scene.add(root);
  const X = { root, seg, lanterns: [], chalices: [], board: null, gaze: null, feast: null, mind: false, sigils: [] };
  // Thought Lanterns: a violet flame in a gold cage with its sigil disc; only seen (and shot) inside the Mindscape
  seg.lanterns.forEach((p, i) => {
    const g = new THREE.Group(); g.position.set(...p);
    const flameMat = glowMat(0xc78bff, 0.85);
    const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), flameMat);
    const cage = new THREE.Mesh(new THREE.OctahedronGeometry(1.25, 0), new THREE.MeshBasicMaterial({ color: GOLDL, wireframe: true, transparent: true, opacity: 0.7, fog: false }));
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.25, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
    const P = canvasPanel(256, 256);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.1, 28), new THREE.MeshBasicMaterial({ map: P.tex, transparent: true, fog: false, side: THREE.DoubleSide, depthWrite: false }));
    disc.position.y = 2.3; disc.renderOrder = 3;
    g.add(flame, cage, hit, disc);
    g.visible = false;
    root.add(g);
    const L = { i, p: v3(p), group: g, flame, flameMat, cage, hit, disc, P, sigil: null, flashT: 0, t: Math.random() * 6 };
    hit.userData.mechShot = () => X.onLanternShot?.(i);
    X.lanterns.push(L);
  });
  // the Mind board: the round's order and progress, drawn on the north wall, visible only inside the Mindscape
  const B = canvasPanel(1024, 256);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: B.tex, transparent: true, fog: false, depthWrite: false }));
  board.position.set(...seg.board); board.visible = false; board.renderOrder = 3;
  root.add(board);
  X.board = { ...B, mesh: board, key: '', flash: null, flashT: 0 };
  // Calus's Gaze: a long thin beam from over the throne, sweeping the hall
  const gz = seg.gaze, range = 62;
  const beamGeo = new THREE.ConeGeometry(range * Math.tan(0.22), range, 20, 1, true).rotateX(-Math.PI / 2).translate(0, 0, range / 2);
  const beam = new THREE.Mesh(beamGeo, glowMat(0xb06cff, 0.1));
  beam.position.set(gz.p[0], gz.p[1], gz.p[2]); beam.rotation.x = 0.07; beam.raycast = () => {};
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), glowMat(0xe2c4ff, 0.9)); eye.position.copy(beam.position);
  root.add(beam, eye);
  X.gaze = { beam, eye, yaw: gz.yaw };
  // The Emperor's Feast: a gold orb that swells over him, a column of light, a ring closing on the hall
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), glowMat(0xffc247, 0.75));
  const column = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 40, 20, 1, true), glowMat(0xffd27a, 0.0));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64).rotateX(-Math.PI / 2), glowMat(0xffc247, 0.0));
  orb.visible = false; column.visible = false; ring.visible = false;
  root.add(orb, column, ring);
  X.feast = { orb, column, ring };
  return X;
}

/** Which sigil each lantern carries (a list of four). */
export function setLanternSigils(X, list) {
  X.sigils = list.slice();
  X.lanterns.forEach((L, i) => { L.sigil = list[i]; medallion(L.P, list[i]); });
}
/** The local player is (or is no longer) in the Mindscape: lanterns and board show and the lanterns become shootable. */
export function setMindView(X, on) {
  if (X.mind === on) return;
  X.mind = on;
  for (const L of X.lanterns) L.group.visible = on;
  X.board.mesh.visible = on;
  setExtraTargets(on ? X.lanterns.map((L) => L.hit) : []);
}
/** The Mind board: the round's order (null: blank), the steps done lit gold. */
export function drawMind(X, round, flash = null) {
  const Bd = X.board, key = round ? `${round.order.join()}|${round.progress}|${flash || ''}` : flash || '';
  if (Bd.key === key) return;
  Bd.key = key;
  const { ctx, canvas, tex } = Bd, W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = flash === 'bad' ? 'rgba(80,10,20,0.85)' : 'rgba(26,8,40,0.85)'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = flash === 'ok' ? OK : flash === 'bad' ? BAD : '#d9a520'; ctx.lineWidth = 12; ctx.strokeRect(6, 6, W - 12, H - 12);
  if (round) round.order.forEach((sg, k) => {
    const cx = ((k + 0.5) / round.order.length) * W, done = k < round.progress;
    ctx.globalAlpha = done ? 0.35 : 1;
    drawSigil(ctx, sg, cx, H / 2, H * 0.33, done ? '#9a8a6a' : k === round.progress ? OK : '#e9d7ff');
    ctx.globalAlpha = 1;
    if (k === round.progress) { ctx.strokeStyle = OK; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, H / 2, H * 0.44, 0, Math.PI * 2); ctx.stroke(); }
  });
  tex.needsUpdate = true;
}
export function flashLantern(X, i, kind) {
  const L = X.lanterns[i];
  if (!L) return;
  L.flashT = 0.8; L.flameMat.color.setHex(kind === 'ok' ? 0xffd24d : 0xff3a2a);
  sparks(L.p.clone(), kind === 'ok' ? 0xffd24d : 0xff3a2a, 22, 7, 0.1, 0.6);
}
/**
 * Per frame, everyone. gazeYaw: the beam's facing; aware 0..1: how close the local player is to being drawn in (tints the beam);
 * feastK: the final stand's progress (null when not in it) and `at`, where Calus stands.
 */
export function updateThroneMech(X, dt, T, gazeYaw, aware, gazeOn, feastK, at) {
  for (const L of X.lanterns) {
    L.t += dt;
    L.flame.scale.setScalar(1 + 0.12 * Math.sin(L.t * 5));
    L.cage.rotation.y += dt * 0.6;
    if (L.flashT > 0) { L.flashT -= dt; if (L.flashT <= 0) L.flameMat.color.setHex(0xc78bff); }
    if (G.camera) L.disc.rotation.y = Math.atan2(G.camera.position.x - L.p.x, G.camera.position.z - L.p.z);
  }
  if (X.board.flashT > 0) X.board.flashT -= dt;
  const Gz = X.gaze;
  Gz.beam.visible = gazeOn; Gz.eye.visible = gazeOn;
  Gz.beam.rotation.y = gazeYaw;
  Gz.beam.material.color.setRGB(0.69 + 0.31 * aware, 0.42 + 0.4 * aware, 1);
  Gz.beam.material.opacity = 0.08 + 0.12 * aware + 0.02 * Math.sin(T * 6);
  const F = X.feast, on = feastK != null;
  F.orb.visible = on; F.column.visible = on; F.ring.visible = on;
  if (on) {
    const r = 0.4 + 2.6 * feastK;
    F.orb.position.set(at.x, at.y + 5.5 + feastK * 2, at.z); F.orb.scale.setScalar(r * (1 + 0.06 * Math.sin(T * (6 + 18 * feastK))));
    F.orb.rotation.y += dt * (1 + 4 * feastK);
    F.column.position.set(at.x, at.y + 20, at.z); F.column.material.opacity = 0.05 + 0.25 * feastK * (0.7 + 0.3 * Math.sin(T * 9));
    const R = 46 * (1 - feastK) + 3; // the ring closes on him
    F.ring.position.set(at.x, at.y + 0.12, at.z); F.ring.scale.setScalar(R); F.ring.material.opacity = 0.35 + 0.4 * feastK;
  }
  for (const c of X.chalices) { c.t += dt; c.group.rotation.y += dt * 1.5; c.group.children[0].position.y = 0.75 + Math.sin(c.t * 3) * 0.05; }
}

export function disposeMechC(X) {
  if (!X) return;
  G.scene?.remove(X.root);
  X.root.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
  for (const g of X.grates || []) dropCol(g.col);
  for (const R of X.rows || []) dropCol(R.col);
  for (const m of X.wards || []) dropCol(m.col);
  if (X.door) { dropCol(X.door.col); const j = G.staticMeshes?.indexOf(X.door.door) ?? -1; if (j >= 0) G.staticMeshes.splice(j, 1); }
  for (const c of X.chalices || []) G.scene?.remove(c.group);
  if (X.lanterns) setExtraTargets([]);
  G.hitDirty = true;
}
