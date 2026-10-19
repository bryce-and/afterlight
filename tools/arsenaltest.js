// Dev-only weapon smoke test (U11). In the browser console on the running game:
//   const A = await import('/tools/arsenaltest.js');  await A.run()          // every family and exotic
//   await A.run(['Coldheart'])                                                 // just those
// Starts the first mission with the weapon equipped, puts a grunt in front of the player, holds the trigger
// for a few seconds and reports damage dealt, ammo spent and any error. It does not judge feel; it proves the code paths run.
const map = JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
const mod = (name) => import(new URL(map[`./js/${name}.js`], document.baseURI).href);

export async function setup() {
  const [{ G }, S, g, L, PG, E] = await Promise.all([mod('state'), mod('save'), mod('game'), mod('loot'), mod('progression'), mod('enemies')]);
  return { G, S, g, L, PG, E };
}

const FAMILIES = [
  ['Sidearm', 'primary', 'sidearm'], ['Sword', 'heavy', 'sword'], ['Glaive', 'special', 'glaive'], ['Trace Rifle', 'special', 'trace'],
  ['Rocket Pulse', 'special', 'pulse', 'rocket'], ['Rocket Sidearm', 'special', 'sidearm', 'rocket'], ['Special GL', 'special', 'glauncher', 'lite'], ['Double GL', 'special', 'glauncher', 'double'],
];
const EXOTICS = ['Worldline Zero', 'Heartshadow', 'The Lament', 'Buried Bloodline', 'Forerunner', 'Witherhoard', 'Dead Messenger', 'Edge of Concurrence', 'Edge of Action', 'Edge of Intent', 'Coldheart', 'Prometheus Lens', 'Wavesplitter', 'Divinity'];

export async function one(ctx, label, make) {
  const { G, S, g, L, PG } = ctx;
  const errs = [];
  const onErr = (e) => errs.push(e.message);
  window.addEventListener('error', onErr);
  try {
    G.save = S.createSave('vanguard');
    G.save.progression.xp = PG.xpForLevel(30);
    const it = make(L);
    S.addItem(G.save, it);
    G.save.equipped[it.slot] = it.id;
    g.startMission(0, 0);
    const step = (n) => { for (let i = 0; i < n; i++) { G.scene.updateMatrixWorld(); g.updateGame(1 / 60); } };
    step(30);
    const P = G.player, w = P.weapons.find((x) => x.item.id === it.id);
    P.cur = w.idx; P.switchT = 0;
    // walk into the first zone so its enemies spawn, then pin one grunt 5 m ahead and keep it alive
    const z = G.mission.zones[0], dir = G.level.spawn.clone().sub(z.center).setY(0);
    if (dir.lengthSq() < 1) dir.set(0, 0, 1);
    P.pos.copy(z.center).addScaledVector(dir.normalize(), 20).setY(0);
    step(120);
    const target = G.enemies.find((e) => e.alive);
    if (!target) return { label, error: 'no enemy spawned' };
    for (const e of G.enemies) if (e !== target) e.alive = false;
    P.yaw = 0; P.pitch = 0;
    target.update = function () { this.model.group.position.copy(this.pos); this.model.group.rotation.y = 0; return true; }; // a dummy: it stands still
    const dist = w.A.mode === 'sword' ? 2.8 : 5;
    const pin = () => { target.pos.set(P.pos.x, 0, P.pos.z - dist); target.maxHp = 1e9; target.hp = Math.max(target.hp, 9e8); P.health = P.maxHealth; };
    pin();
    const ammo0 = w.ammo;
    const inp = G.input;
    inp.mouse.left = true; inp.mouse.leftPressed = true;
    let lost = 0;
    for (let i = 0; i < 240; i++) { pin(); const before = target.hp; inp.mouse.leftPressed = i % 20 === 0; step(1); lost += before - target.hp; }
    inp.mouse.left = false;
    return { label, name: it.name, slot: it.slot, mode: w.A.mode, ammo: `${ammo0}->${w.ammo}`, errs, hpLost: Math.round(lost), hits: w.hitCount };
  } catch (e) {
    return { label, error: e.message, stack: String(e.stack).split('\n').slice(0, 3).join(' | '), errs };
  } finally {
    window.removeEventListener('error', onErr);
  }
}

export async function run(only = null) {
  const ctx = await setup();
  const out = [];
  if (!only) for (const [label, slot, arch, frame] of FAMILIES) {
    out.push(await one(ctx, label, (L) => {
      if (!frame) return L.makeWeapon(slot, 80, 3, arch);
      // find a named weapon in that frame
      for (let i = 0; i < 400; i++) { const it = L.makeWeapon(slot, 80, 3, arch); if (it.frame === frame) return it; }
      for (let i = 0; i < 400; i++) { const it = L.makeWeapon(slot, 80, 2, arch); if (it.frame === frame) return it; }
      throw new Error(`no ${arch} ${frame}`);
    }));
  }
  for (const n of EXOTICS) if (!only || only.includes(n)) out.push(await one(ctx, n, (L) => L.makeExotic(n, 80)));
  return out;
}

/** A mission with `make(L)` equipped and one pinned dummy `dist` m ahead. Returns handles for scripted scenarios. */
export async function env(make, dist = 5) {
  const { G, S, g, L, PG } = await setup();
  G.save = S.createSave('vanguard');
  G.save.progression.xp = PG.xpForLevel(30);
  const it = make(L);
  S.addItem(G.save, it);
  G.save.equipped[it.slot] = it.id;
  g.startMission(0, 0);
  const step = (n) => { for (let i = 0; i < n; i++) { G.scene.updateMatrixWorld(); g.updateGame(1 / 60); } };
  step(30);
  const P = G.player, w = P.weapons.find((x) => x.item.id === it.id);
  P.cur = w.idx; P.switchT = 0;
  const z = G.mission.zones[0], dir = G.level.spawn.clone().sub(z.center).setY(0);
  if (dir.lengthSq() < 1) dir.set(0, 0, 1);
  P.pos.copy(z.center).addScaledVector(dir.normalize(), 20).setY(0);
  step(120);
  const target = G.enemies.find((e) => e.alive);
  for (const e of G.enemies) if (e !== target) e.alive = false;
  target.update = function () { this.model.group.position.copy(this.pos); return true; };
  P.yaw = 0; P.pitch = 0;
  const origin = P.pos.clone();
  const pin = () => { P.pitch = 0; P.recoilAcc = 0; target.pos.set(origin.x, 0, origin.z - dist); target.maxHp = 1e9; target.hp = Math.max(target.hp, 9e8); P.health = P.maxHealth; };
  pin();
  step(2); // let the dummy's hit boxes catch up with where it was put
  const inp = G.input;
  const tally = { lost: 0 };
  const stepL = (n) => { for (let i = 0; i < n; i++) { const b = target.hp; step(1); tally.lost += Math.max(0, b - target.hp); } };
  const hold = (frames, o = {}) => {
    inp.mouse.left = o.left ?? true; inp.mouse.right = !!o.right;
    if (o.sprint) { inp.keys.KeyW = true; inp.keys.ShiftLeft = true; }
    for (let f = 0; f < frames; f++) { pin(); inp.mouse.leftPressed = f === 0 && (o.left ?? true); stepL(1); }
    inp.mouse.left = false; inp.mouse.right = false; inp.mouse.leftPressed = false; inp.keys.KeyW = false; inp.keys.ShiftLeft = false;
  };
  const press = (key) => { inp.pressed[key] = true; step(1); inp.pressed[key] = false; };
  return { G, P, w, target, step, stepL, pin, hold, press, origin, it, tally };
}
