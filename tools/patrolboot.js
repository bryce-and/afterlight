// Dev-only helper for looking around a patrol zone. In the browser console on the running game:
//   const { boot } = await import('/tools/patrolboot.js'); await boot(0);
// Starts the patrol, then gives you window.__step(n), __go(x, z, yaw, pitch, fly), __quiet() (no enemies, no events) and window.__t.
const map = JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
const mod = (name) => import(new URL(map[`./js/${name}.js`] || `./js/${name}.js`, document.baseURI).href);

export async function boot(li = 0) {
  const [{ G }, S, g, pt, Ph] = await Promise.all([mod('state'), mod('save'), mod('game'), mod('patrol'), mod('physics')]);
  window.__errs = []; window.addEventListener('error', (e) => window.__errs.push(e.message));
  window.__t = { G, S, g, pt, Ph };
  G.save = S.createSave('vanguard');
  pt.startPatrol(li);
  window.__step = (n) => { for (let i = 0; i < n; i++) { G.scene.updateMatrixWorld(); g.updateGame(1 / 60); } };
  window.__go = (x, z, yaw, pitch = 0.05, fly = 0) => {
    const P = G.player; P.pos.set(x, Ph.groundAt(x, z) + 0.1 + fly, z); P.vel.set(0, 0, 0); P.yaw = yaw; P.pitch = pitch; P.health = P.maxHealth; window.__step(4);
  };
  window.__quiet = () => {
    const M = G.mission;
    for (const c of M.patrol.camps) { c.state = 'cool'; c.t = 1e9; for (const e of c.zone.enemies) { e.alive = false; e.dieT = 2; } }
    M.patrol.events.nextT = 1e9;
    for (const e of G.enemies) { e.alive = false; e.dieT = 2; }
  };
  return 'patrol started';
}

/** Walks the nav grid from the landing: every beacon, site, event, camp and NPC must be reachable and not inside a collider. Returns the list of problems. */
export async function check() {
  const { G, Ph } = window.__t;
  const nav = await mod('nav');
  const reach = nav.floodReach(G.nav, G.level.spawn.x, G.level.spawn.z);
  const cellOf = (x, z) => Math.floor((z - G.nav.minZ) / G.nav.cell) * G.nav.W + Math.floor((x - G.nav.minX) / G.nav.cell);
  const PS = G.mission.patrol.set;
  const sites = [...PS.beacons.map((b) => [`beacon:${b.id}`, b.x, b.z]), ...PS.beacons.map((b) => [`site:${b.id}`, b.site.x, b.site.z]), ...PS.events.map((e) => [`event:${e.id}`, e.x, e.z]),
    ...PS.camps.map((c, i) => [`camp${i}`, c.x, c.z]), ...Object.entries(PS.npcs).map(([id, n]) => [`npc:${id}`, n.x, n.z])];
  const bad = [];
  for (const [n, x, z] of sites) {
    const ok = reach.has ? reach.has(cellOf(x, z)) : reach[cellOf(x, z)];
    const inCol = Ph.pointInColliders({ x, y: Ph.groundAt(x, z) + 0.9, z }, 0.4);
    if (!ok || inCol) bad.push(n + (ok ? '' : ' unreachable') + (inCol ? ' in-collider' : ''));
  }
  return bad;
}
