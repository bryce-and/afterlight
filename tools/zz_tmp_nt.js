// Dev-only AI smoke test (U13a). In the browser console on the running game:
//   const { testNav } = await import('/tools/navtest.js');  await testNav(li, mi, seconds)
// Builds the nav grid, checks a path from spawn to every zone, then lets each zone's enemies fight a
// stationary, unkillable player for `seconds` and reports leash breaks, stuck units, melee swings,
// suicide blasts, ledge posts and frame cost.
const map = JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
const mod = (name) => import(new URL(map[`./js/${name}.js`], document.baseURI).href);

export async function testNav(li, mi, seconds = 25) {
  const [{ G }, S, g, N, A, E, THREE] = await Promise.all([mod('state'), mod('save'), mod('game'), mod('nav'), mod('ai'), mod('enemies'), import('three')]);
  G.save = S.createSave('vanguard');
  g.startMission(li, mi);
  const M = G.mission, P = G.player, rep = [];
  const nav = G.nav;
  let walk = 0, ledge = 0;
  for (const h of nav.hgt) { if (h >= 0) walk++; if (h >= N.NAV.ledgeMin) ledge++; }
  rep.push(`${M.def.name}: grid ${nav.W}x${nav.D}, ${walk} walkable cells, ${ledge} ledge cells, ${G.colliders.length} colliders (${G.colliders.filter((c) => c.rot).length} oriented)`);
  // the Guardian is unkillable here: refilled every frame so a long fight can't fail the mission
  const step = (n) => { for (let i = 0; i < n; i++) { P.health = P.maxHealth; P.shield = P.maxShield; G.scene.updateMatrixWorld(); g.updateGame(1 / 60); } };
  let prev = G.level.spawn.clone();
  for (const z of M.zones) {
    const t0 = performance.now();
    const p = N.findPath(nav, prev.x, prev.z, z.center.x, z.center.z);
    const ms = (performance.now() - t0).toFixed(1);
    const dir = prev.clone().sub(z.center).setY(0);
    if (dir.lengthSq() < 1) dir.set(0, 0, 1);
    P.pos.copy(z.center).addScaledVector(dir.normalize(), 20).setY(0);
    P.vel.set(0, 0, 0);
    let maxOut = 0, stuck = 0, swings = 0, blasts = 0, posts = 0, kills = 0, frames = 0, worst = 0;
    const seen = new Set();
    step(90);
    const inside = new Set();
    for (let f = 0; f < seconds * 60; f++) {
      P.health = P.maxHealth;
      const t = performance.now();
      step(1);
      worst = Math.max(worst, performance.now() - t); frames++;
      for (const e of z.enemies) {
        if (!e.alive) continue;
        seen.add(e);
        maxOut = Math.max(maxOut, Math.hypot(e.pos.x - z.center.x, e.pos.z - z.center.z) - A.leashRadius(z));
        if (e.cmSwing > 0 && !e._sw) { swings++; e._sw = true; } else if (e.cmSwing <= 0) e._sw = false;
        if (e.post && !e._po) { posts++; e._po = true; }
        if (e.fuse > 0 && !e._fu) { blasts++; e._fu = true; }
        stuck = Math.max(stuck, 0); if (e.stuckN) e._sn = e.stuckN;
        inside.add(e);
      }
      if (z.state === 'cleared') break;
    }
    stuck = [...seen].reduce((n, e) => n + (e.stuckN || 0), 0);
    kills = [...seen].filter((e) => !e.alive).length;
    // close quarters: stand next to a ranged unit and count its melee swings
    const near = z.enemies.find((e) => e.alive && e.def.closeMelee && !e.isBoss);
    let close = 0;
    if (near) {
      P.pos.set(near.pos.x + 1.4, near.pos.y, near.pos.z);
      for (let f = 0; f < 6 * 60 && near.alive; f++) { P.health = P.maxHealth; P.pos.set(near.pos.x + 1.4, near.pos.y, near.pos.z); step(1); if (near.cmSwing > 0 && !near._c) { close++; near._c = true; } else if (near.cmSwing <= 0) near._c = false; }
    }
    rep.push(`  ${z.name}${z.isBoss ? ' (boss)' : ''}: path ${p ? (p.partial ? 'PARTIAL' : 'ok') + ` ${p.pts.length}wp ${ms}ms` : 'NONE'}, ${seen.size} units, max past leash ${maxOut.toFixed(1)}m, stuck events ${stuck}, melee swings ${swings}, fuses ${blasts}, ledge posts ${posts}, close-range swings ${close}, worst frame ${worst.toFixed(1)}ms`);
    for (let w = 0; w < 14 && z.state !== 'cleared'; w++) {
      for (const e of [...G.enemies]) if (e.alive) g.dealDamage(e, 1e7, { raw: true });
      P.health = P.maxHealth;
      step(60);
    }
    prev = z.center.clone();
  }
  // suicide unit (Hive and Fallen levels only): one runs at a Guardian standing 14 m away
  if (G.mission.loc.enemyNames.suicide) {
    P.pos.copy(G.level.spawn).setY(0);
    const z = { center: P.pos.clone(), enemies: [], isBoss: false };
    let at = null;
    for (let a = 0; a < 16 && !at; a++) { const q = P.pos.clone(); q.x += Math.sin(a * 0.39) * 14; q.z += Math.cos(a * 0.39) * 14; if (N.heightAt(nav, q.x, q.z) >= 0 && N.lineClear(nav, q.x, q.z, P.pos.x, P.pos.z)) at = q; }
    if (!at) { rep.push('  suicide unit: no clear spot 14 m from spawn'); return rep.join('\n'); }
    const e = new E.Enemy('suicide', at, { zone: z, hpMult: 1, dmgMult: 1 });
    G.enemies.push(e); z.enemies.push(e);
    const hp0 = P.health; let t = 0;
    for (; t < 600 && e.alive; t++) { P.health = Math.min(P.maxHealth, P.health); step(1); }
    rep.push(`  suicide unit (${e.name}): ${e.alive ? 'STILL ALIVE' : 'detonated'} after ${(t / 60).toFixed(1)}s, player took ${(hp0 - P.health).toFixed(0)}`);
  }
  return rep.join('\n');
}
