// Dev-only performance bench (H22). In the browser console on the running game:
//   const { bench } = await import('/tools/perfbench.js');  await bench()
// Starts mission (li, mi), spawns `n` enemies at fixed spots in front of the player, steps the game and
// renders `frames` frames synchronously, and reports CPU time per frame (update and render submit) plus
// draw calls and triangles. Compare runs on the same machine only; absolute numbers depend on the GPU.
const map = JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
const mod = (name) => import(new URL(map[`./js/${name}.js`], document.baseURI).href);

const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2); };

export async function bench({ li = 0, mi = 0, n = 24, frames = 240, types = ['grunt', 'rusher', 'captain', 'heavy'] } = {}) {
  const [{ G }, S, g] = await Promise.all([mod('state'), mod('save'), mod('game')]);
  G.save = S.createSave('vanguard');
  g.startMission(li, mi);
  const M = G.mission, P = G.player, z = M.zones[0];
  P.pos.copy(z.center); P.yaw = 0; P.pitch = 0;
  for (let i = 0; i < n; i++) {
    const a = (i / n - 0.5) * 1.6, d = 9 + (i % 4) * 3;
    const pos = P.pos.clone(); pos.x += Math.sin(a) * d; pos.z -= Math.cos(a) * d;
    g.spawnUnit(z, types[i % types.length], pos, { tier: 'minor' });
  }
  const R = G.renderer, upd = [], ren = [];
  let calls = 0, tris = 0;
  for (let f = 0; f < frames + 60; f++) {
    P.health = P.maxHealth; P.dead = false;
    const t0 = performance.now();
    g.updateGame(1 / 60);
    const t1 = performance.now();
    R.render(G.scene, G.camera);
    const t2 = performance.now();
    if (f >= 60) { upd.push(t1 - t0); ren.push(t2 - t1); calls = R.info.render.calls; tris = R.info.render.triangles; }
  }
  const alive = G.enemies.filter((e) => e.alive).length;
  return { enemies: alive, calls, tris, updMed: pct(upd, 0.5), updP95: pct(upd, 0.95), renMed: pct(ren, 0.5), renP95: pct(ren, 0.95) };
}
