// Dev-only level smoke test. In the browser console on the running game:
//   const { testLevel } = await import('/tools/leveltest.js');  await testLevel(li, mi)
// Walks the player through every zone of a mission, clears each one, and reports
// mesh/collider counts, enemy spawns that landed inside colliders, and errors.
const map = JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
const mod = (name) => import(new URL(map[`./js/${name}.js`], document.baseURI).href);

export async function testLevel(li, mi) {
  const [{ G }, S, g, Ph] = await Promise.all([mod('state'), mod('save'), mod('game'), mod('physics')]);
  const errs = [];
  const onErr = (e) => errs.push(e.message);
  window.addEventListener('error', onErr);
  G.save = S.createSave('vanguard');
  try { g.startMission(li, mi); } catch (e) { window.removeEventListener('error', onErr); return `START ERROR ${e.message}`; }
  const step = (n) => { for (let i = 0; i < n; i++) { G.scene.updateMatrixWorld(); g.updateGame(1 / 60); } };
  let meshes = 0;
  G.scene.traverse((o) => { if (o.isMesh) meshes++; });
  const M = G.mission, P = G.player, rep = [];
  const unreachable = (G.level.groundAt ? await navReach(G) : reachability(G)).join(', ');
  let prev = G.level.spawn.clone();
  try {
    for (const z of M.zones) {
      const c = z.center, dir = prev.clone().sub(c).setY(0);
      if (dir.lengthSq() < 1) dir.set(0, 0, 1);
      P.pos.copy(c).addScaledVector(dir.normalize(), 20);
      P.pos.y = Ph.groundAt(P.pos.x, P.pos.z); // U16e: terrain maps stand the player on the ground
      const startBlocked = !!Ph.pointInColliders(P.pos.clone().setY(P.pos.y + 0.9), 0.3);
      step(90);
      let spawned = 0, inCol = 0;
      for (let w = 0; w < 12 && z.state !== 'cleared'; w++) {
        for (const e of [...G.enemies]) {
          if (!e.alive) continue;
          spawned++;
          if (Ph.pointInColliders(e.pos.clone().setY(e.pos.y + 0.6), 0.2)) inCol++;
          g.dealDamage(e, 1e7, { raw: true });
        }
        if (z.obj) z.obj.done = true; // U15: the smoke test skips the story objective (tools/objtest covers it); the zone clears once its waves do
        P.health = P.maxHealth;
        step(60);
      }
      rep.push(`${z.name}${z.isBoss ? ' (boss)' : ''}: ${z.state}, ${spawned} spawned, ${inCol} inside colliders${startBlocked ? ', APPROACH POINT BLOCKED' : ''}`);
      prev = c.clone();
    }
  } catch (e) { errs.push(`RUN ${e.message}`); }
  window.removeEventListener('error', onErr);
  return `${M.def.name}: ${meshes} meshes, ${G.colliders.length} colliders${unreachable ? `, UNREACHABLE: ${unreachable}` : ''}\n  ${rep.join('\n  ')}${errs.length ? `\n  ERRORS ${errs.join('; ')}` : ''}`;
}

// U16e: on a terrain map the flat flood fill below means nothing (everything stands on a slope), so ask the nav grid: a zone is reached
// when its centre can be walked to from spawn by legal steps (ramps and stairs count, hops do not).
async function navReach(G) {
  const N = await mod('nav');
  const doors = new Set(G.level.doors.map((d) => d.collider)); // doors open as the zones clear, so they do not count as walls here
  const nav = N.buildNav(G.colliders.filter((c) => !doors.has(c)), G.level.bounds);
  const reach = N.floodReach(nav, G.level.spawn.x, G.level.spawn.z);
  return G.mission.zones.filter((z) => {
    for (let dx = -6; dx <= 6; dx += 1) for (let dz = -6; dz <= 6; dz += 1) {
      const i = N.cellIndex(nav, z.center.x + dx, z.center.z + dz);
      if (i >= 0 && reach[i]) return false;
    }
    return true;
  }).map((z) => z.name);
}

// Ground-level flood fill (0.5 m grid, player radius 0.4) from spawn; anything a player can step onto counts as
// open, so this is a lower bound on reachability (stairs are not followed). Returns zones it could not reach.
function reachability(G) {
  const b = G.level.bounds, cell = 0.5, r = 0.4;
  const W = Math.ceil((b.maxX - b.minX) / cell), D = Math.ceil((b.maxZ - b.minZ) / cell);
  const blocked = new Uint8Array(W * D);
  for (const c of G.colliders) {
    if (c.max.y <= 0.6 || c.min.y >= 1.8) continue;
    const x0 = Math.max(0, Math.floor((c.min.x - r - b.minX) / cell)), x1 = Math.min(W - 1, Math.floor((c.max.x + r - b.minX) / cell));
    const z0 = Math.max(0, Math.floor((c.min.z - r - b.minZ) / cell)), z1 = Math.min(D - 1, Math.floor((c.max.z + r - b.minZ) / cell));
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) blocked[z * W + x] = 1;
  }
  const idx = (p) => Math.floor((p.z - b.minZ) / cell) * W + Math.floor((p.x - b.minX) / cell);
  const seen = new Uint8Array(W * D), q = [idx(G.level.spawn)];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop(), x = i % W, z = (i / W) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
      const j = nz * W + nx;
      if (!seen[j] && !blocked[j]) { seen[j] = 1; q.push(j); }
    }
  }
  // a zone counts as reached if any open cell within 6 m of its center was reached
  return G.mission.zones.filter((z) => {
    for (let dx = -6; dx <= 6; dx += cell) for (let dz = -6; dz <= 6; dz += cell) {
      const i = idx({ x: z.center.x + dx, z: z.center.z + dz });
      if (i >= 0 && i < seen.length && seen[i]) return false;
    }
    return true;
  }).map((z) => z.name);
}

// Renders a view of every zone of a mission (from 22 m out, looking at the zone, plus one overview from
// above) into a full-screen overlay for visual review. Call hideTour() to remove it.
export async function tour(li, mi, { size = [400, 250] } = {}) {
  const [{ G }, S, g, THREE] = await Promise.all([mod('state'), mod('save'), mod('game'), import('three')]);
  G.save = S.createSave('vanguard');
  g.startMission(li, mi);
  G.scene.updateMatrixWorld();
  const cam = new THREE.PerspectiveCamera(75, size[0] / size[1], 0.1, 900);
  const views = [];
  let prev = G.level.spawn.clone();
  for (const z of G.mission.zones) {
    const dir = prev.clone().sub(z.center).setY(0);
    if (dir.lengthSq() < 1) dir.set(0, 0, 1);
    const eye = z.center.clone().addScaledVector(dir.normalize(), 22).setY(z.isBoss ? 4 : 2.2);
    views.push([z.name + (z.isBoss ? ' (boss)' : ''), eye, z.center.clone().setY(1.5)]);
    views.push([z.name + ' (above)', z.center.clone().add(new THREE.Vector3(18, 30, 18)), z.center.clone()]);
    prev = z.center.clone();
  }
  for (const e of G.enemies) e.mesh && (e.mesh.visible = false);
  const r = G.renderer, old = new THREE.Vector2();
  r.getSize(old);
  r.setSize(size[0], size[1], false);
  hideTour();
  const wrap = document.createElement('div');
  wrap.id = 'tour';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#111;display:grid;grid-template-columns:repeat(4,1fr);gap:3px;padding:4px;color:#fff;font:11px sans-serif;overflow:auto';
  for (const [name, eye, at] of views) {
    cam.position.copy(eye); cam.lookAt(at);
    G.sun && 0;
    r.render(G.scene, cam);
    const c = document.createElement('canvas');
    c.width = size[0]; c.height = size[1];
    c.getContext('2d').drawImage(r.domElement, 0, 0, size[0], size[1]);
    c.style.width = '100%';
    const cell = document.createElement('div');
    cell.append(c, document.createTextNode(name));
    wrap.append(cell);
  }
  r.setSize(old.x, old.y, false);
  document.body.append(wrap);
  return views.length;
}
export function hideTour() { document.getElementById('tour')?.remove(); }

// U16e: hand-picked views for checking terrain and skies. views: [[name, [x, y, z] eye, [x, y, z] target]]; y is metres above the
// ground under that point. bright adds an ambient light so a night map can be read. Call hideTour() to remove the overlay.
export async function shots(li, mi, views, { size = [640, 360], bright = 0.9, fov = 70, cols = 2 } = {}) {
  const [{ G }, S, g, THREE] = await Promise.all([mod('state'), mod('save'), mod('game'), import('three')]);
  G.save = S.createSave('vanguard');
  g.startMission(li, mi);
  if (bright) G.scene.add(new THREE.AmbientLight(0xffffff, bright));
  G.scene.updateMatrixWorld();
  const gy = (x, z) => (G.level.groundAt ? G.level.groundAt(x, z) : 0);
  const cam = new THREE.PerspectiveCamera(fov, size[0] / size[1], 0.1, 900);
  const r = G.renderer, old = r.getSize(new THREE.Vector2());
  r.setSize(size[0], size[1], false);
  document.getElementById('tour')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'tour';
  wrap.style.cssText = `position:fixed;inset:0;z-index:99999;background:#111;display:grid;grid-template-columns:repeat(${cols},1fr);gap:3px;padding:4px;color:#fff;font:11px sans-serif;overflow:auto`;
  for (const [name, e, t] of views) {
    cam.position.set(e[0], gy(e[0], e[2]) + e[1], e[2]); cam.lookAt(t[0], gy(t[0], t[2]) + t[1], t[2]);
    r.render(G.scene, cam);
    const c = document.createElement('canvas');
    c.width = size[0]; c.height = size[1];
    c.getContext('2d').drawImage(r.domElement, 0, 0, size[0], size[1]);
    c.style.width = '100%';
    const cell = document.createElement('div');
    cell.append(c, document.createTextNode(name));
    wrap.append(cell);
  }
  r.setSize(old.x, old.y, false);
  document.body.append(wrap);
  return views.length;
}
