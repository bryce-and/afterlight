// Headless play-check with a real loadout. Run by tools/playcheck.sh, or in the browser console on the running game:
//   const P = await import('/tools/playcheck.js');  await P.playcheck(li, mi, { tier: 'base', loadout: 'meta' })
// Equips a meta loadout (legendary primary, special and heavy, one random exotic weapon, legendary armor, all at the
// mission's tier Light; level 30) or the starter kit (loadout: 'starter'), starts the mission, then a bot walks to each zone,
// aims at the nearest enemy and fires (heavy, then special, on bosses; primary otherwise) until the zone clears.
// The bot never really dies: a death is counted and the player is topped up, so one run measures the whole mission.
// Reports per zone: clear time (simulated seconds), kills, deaths, damage taken, and whether the bot stalled (then the
// zone is finished with raw damage and flagged TIME CAP). Also every page error and console.error. It does not use abilities.
const map = JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
const mod = (name) => import(new URL(map[`./js/${name}.js`], document.baseURI).href);

const ZONE_CAP = { base: 150, legendary: 300, ultimate: 300 }; // simulated seconds per zone before the bot gives up on it
const STALL = 6; // seconds without hurting the target before the bot steps toward it

export async function playcheck(li, mi, { tier = 'base', loadout = 'meta', exotic = null } = {}) {
  const [{ G }, S, g, L, PG, Ph, D, C] = await Promise.all([mod('state'), mod('save'), mod('game'), mod('loot'), mod('progression'), mod('physics'), mod('data'), mod('campaign')]);
  const errs = [];
  const onErr = (e) => errs.push(e.message || String(e.reason));
  window.addEventListener('error', onErr);
  window.addEventListener('unhandledrejection', onErr);
  const cerr = console.error;
  console.error = (...a) => { errs.push(a.map(String).join(' ').slice(0, 200)); cerr.apply(console, a); };
  try {
    const def = D.LOCATIONS[li].missions[mi];
    const light = C.tierPower(def.power, tier);
    G.save = S.createSave('vanguard');
    G.save.progression.xp = PG.xpForLevel(30);
    let kit = 'starter kit';
    if (loadout === 'meta') {
      const items = [L.makeWeapon('primary', light, 3), L.makeWeapon('heavy', light, 3)];
      const ex = exotic ? L.makeExotic(exotic, light) : L.makeWeapon('special', light, 4);
      items.push(ex.slot === 'special' ? null : L.makeWeapon('special', light, 3), ex);
      for (const slot of ['helmet', 'arms', 'chest', 'legs']) items.push(L.makeArmor(slot, light, 3, null, G.save.classId));
      for (const it of items.filter(Boolean)) { S.addItem(G.save, it); G.save.equipped[it.slot] = it.id; }
      kit = ['primary', 'special', 'heavy'].map((s) => S.getEquipped(G.save, s)).map((it) => `${it.name}${it.exotic ? ' (exotic)' : ''}`).join(', ');
    }
    const startErr = (() => { try { g.startMission(li, mi, tier); return null; } catch (e) { return e.message; } })();
    if (startErr) return `START ERROR ${startErr}`;
    const step = (n) => { for (let i = 0; i < n; i++) { G.scene.updateMatrixWorld(); g.updateGame(1 / 60); } };
    const M = G.mission, P = G.player, inp = G.input;
    let deaths = 0, taken = 0;
    const realTake = P.takeDamage.bind(P);
    P.takeDamage = (amount, from) => { const h = P.health + P.shield; realTake(amount, from); taken += Math.max(0, h - Math.max(0, P.health) - P.shield); };
    P.die = () => { deaths++; P.health = P.maxHealth; P.dead = false; }; // count it, keep playing
    const head = [`${def.name} (${tier}, Light ${light}, enemies ${M.enemyLight ?? '?'}): ${kit}`];
    const rep = [];
    let prev = G.level.spawn.clone(), total = 0;
    for (const z of M.zones) {
      const c = z.center, dir = prev.clone().sub(c).setY(0);
      if (dir.lengthSq() < 1) dir.set(0, 0, 1);
      P.pos.copy(c).addScaledVector(dir.normalize(), 20);
      P.pos.y = Ph.groundAt(P.pos.x, P.pos.z);
      const d0 = deaths, t0 = taken, k0 = M.kills, hits = () => P.weapons.reduce((a, w) => a + (w.hitCount || 0), 0), h0 = hits();
      let f = 0, idle = 0, target = null, lastHp = 0, stalled = false;
      lastTarget = null;
      while (z.state !== 'cleared' && f < (ZONE_CAP[tier] ?? 300) * 60) {
        if (z.obj) z.obj.done = true; // story objectives are not the bot's job (tools/objtest covers them)
        if (!target?.alive) { // focus fire: keep one target until it dies, then take the nearest
          const live = G.enemies.filter((e) => e.alive);
          target = live.sort((a, b) => a.pos.distanceToSquared(P.pos) - b.pos.distanceToSquared(P.pos))[0] || null;
        }
        if (target) {
          aim(P, target);
          pickWeapon(P, target);
          inp.mouse.left = true; inp.mouse.leftPressed = f % 8 === 0;
          const hp = target.hp + (target.shield || 0);
          if (hp < lastHp || target !== lastTarget) idle = 0; else idle++;
          lastHp = hp; lastTarget = target;
          if (idle > STALL * 60) { // no progress: step toward it (around cover, through a door)
            const to = target.pos.clone().sub(P.pos).setY(0);
            if (to.length() > 6) { P.pos.addScaledVector(to.normalize(), 4); P.pos.y = Ph.groundAt(P.pos.x, P.pos.z); } else target = null; // close and still no progress: try another
            idle = 0;
          }
        } else { inp.mouse.left = false; }
        step(1); f++;
      }
      inp.mouse.left = false;
      let left = '';
      if (z.state !== 'cleared') { // finish it so the rest of the mission is still checked
        stalled = true;
        const alive = G.enemies.filter((e) => e.alive);
        left = ` [${alive.length} left: ${alive.slice(0, 4).map((e) => `${e.typeId || e.type || 'enemy'} ${e.pos.distanceTo(P.pos).toFixed(0)} m, ${(e.pos.y - P.pos.y).toFixed(0)} m up, ${Math.round(100 * e.hp / e.maxHp)}% hp${e.immune ? ', immune' : ''}`).join('; ')}${z.pending ? `; ${z.pending} pending` : ''}]`;
        for (let w = 0; w < 12 && z.state !== 'cleared'; w++) { for (const e of [...G.enemies]) if (e.alive) g.dealDamage(e, 1e7, { raw: true }); step(60); }
      }
      const secs = f / 60; total += secs;
      rep.push(`${z.name}${z.isBoss ? ' (boss)' : ''}: ${z.state}${stalled ? ' TIME CAP (finished with raw damage)' + left : ''} in ${secs.toFixed(0)} s, ${M.kills - k0} kills, ${hits() - h0} hits, ${deaths - d0} bot deaths, ${Math.round(taken - t0)} damage taken`);
      prev = c.clone();
    }
    head.push(`total ${total.toFixed(0)} s, ${M.kills} kills, ${deaths} bot deaths (the bot stands in the open and uses no abilities; compare runs, not absolutes)`);
    return `${head.join('\n  ')}\n  ${rep.join('\n  ')}${errs.length ? `\n  ERRORS ${[...new Set(errs)].join('; ')}` : '\n  no errors'}`;
  } catch (e) {
    return `RUN ERROR ${e.message} | ${String(e.stack).split('\n').slice(1, 3).join(' | ')}${errs.length ? `\n  ERRORS ${errs.join('; ')}` : ''}`;
  } finally {
    window.removeEventListener('error', onErr);
    window.removeEventListener('unhandledrejection', onErr);
    console.error = cerr;
  }
}
let lastTarget = null;

/**
 * U24 Roguelike Horde check: `sh tools/playcheck.sh horde <waves>`. Meta armor at `light` (the weapons are the run's own kit), a bot fights the
 * waves, takes the first boon at each boon screen, and the run reports per-wave clear time, boons held, the sealed room and spawn fairness.
 * Fails on page errors, a bot that leaves the room, a spawn inside the fair distances, or a wave that does not clear.
 */
export async function hordecheck(waves = 6, { light = 250, allBoons = false, act = 'horde_rogue' } = {}) {
  const [{ G }, S, g, L, PG, Ph, B] = await Promise.all([mod('state'), mod('save'), mod('game'), mod('loot'), mod('progression'), mod('physics'), mod('boons')]);
  const errs = [], onErr = (e) => errs.push(e.message || String(e.reason));
  window.addEventListener('error', onErr); window.addEventListener('unhandledrejection', onErr);
  const cerr = console.error;
  console.error = (...a) => { errs.push(a.map(String).join(' ').slice(0, 200)); cerr.apply(console, a); };
  try {
    G.save = S.createSave('vanguard');
    G.save.progression.xp = PG.xpForLevel(30);
    for (const slot of ['helmet', 'arms', 'chest', 'legs']) { const it = L.makeArmor(slot, light, 3, null, G.save.classId); S.addItem(G.save, it); G.save.equipped[it.slot] = it.id; }
    for (const slot of ['primary', 'special', 'heavy']) { const it = L.makeWeapon(slot, light, 3); S.addItem(G.save, it); G.save.equipped[slot] = it.id; }
    g.startActivity(act, 12345);
    const M = G.mission, P = G.player, inp = G.input;
    if (!M.boonRun) throw new Error('hordecheck: no boon run started');
    if (allBoons) { // LOADOUT=allboons: every boon twice, to shake out errors in every effect
      const BR = await mod('boon-run');
      for (let n = 0; n < 2; n++) for (const b of B.BOONS) BR.takeOption(P, { kind: 'boon', id: b.id });
    }
    const step = () => { G.scene.updateMatrixWorld(); g.updateGame(1 / 60); };
    let deaths = 0, taken = 0, outside = 0, unfair = 0;
    const realTake = P.takeDamage.bind(P);
    P.takeDamage = (a, f) => { const h = P.health + P.shield; realTake(a, f); taken += Math.max(0, h - Math.max(0, P.health) - P.shield); };
    P.die = () => { deaths++; P.health = P.maxHealth; P.dead = false; };
    const rep = [], seen = new Set();
    let target = null, lastT = null, lastHp = 0, idle = 0, f = 0, waveStart = 0, lastWave = 0, kit = P.weapons.map((w) => w.item.name).join(', ');
    const room = () => M.zones[0].room;
    const checkSpawns = () => {
      for (const e of G.enemies) {
        if (!e.alive || seen.has(e)) continue;
        seen.add(e);
        if (e.born != null) continue;
        const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z), suicide = !!e.def?.suicide;
        if (d < (suicide ? B.SPAWN_RULES.suicideFromPlayer : B.SPAWN_RULES.enemyFromPlayer) - 1 && f - waveStart < 5) unfair++;
        const r = room();
        if (r && (e.pos.x < r.minX - 0.5 || e.pos.x > r.maxX + 0.5 || e.pos.z < r.minZ - 0.5 || e.pos.z > r.maxZ + 0.5)) outside++;
      }
    };
    while (M.wave < waves + 1 && f < 60 * 60 * 25 && G.state === 'playing') {
      if (M.wave !== lastWave) { // a wave began
        if (lastWave) rep.push(`wave ${lastWave}: ${((f - waveStart) / 60).toFixed(0)} s`);
        lastWave = M.wave; waveStart = f;
        if (M.wave > waves) break;
      }
      const boonEl = document.querySelector('.rw-ov.boon');
      if (boonEl) { boonEl.querySelector('.bn-card')?.click(); await new Promise((r) => setTimeout(r, 0)); }
      if (M.phase === 'move' || M.phase === 'inter' || M.phase === 'boon') { for (let i = 0; i < 5; i++) step(); f += 5; inp.mouse.left = false; continue; }
      if (!target?.alive) target = G.enemies.filter((e) => e.alive).sort((a, b) => a.pos.distanceToSquared(P.pos) - b.pos.distanceToSquared(P.pos))[0] || null;
      if (target) {
        aim(P, target); pickWeapon(P, target);
        inp.mouse.left = true; inp.mouse.leftPressed = f % 8 === 0;
        const hp = target.hp + (target.shield || 0);
        if (hp < lastHp || target !== lastT) idle = 0; else idle++;
        lastHp = hp; lastT = target;
        if (idle > STALL * 60) { // no progress: step toward it (around cover)
          const to = target.pos.clone().sub(P.pos).setY(0);
          if (to.length() > 6) { P.pos.addScaledVector(to.normalize(), 4); P.pos.y = Ph.groundAt(P.pos.x, P.pos.z); } else target = null;
          idle = 0;
        }
      } else inp.mouse.left = false;
      if (f % 600 === 0) for (const w of P.weapons) if (w.reserve !== Infinity) w.reserve = w.maxReserve; // the bot has no ammo bricks to pick up
      step(); f++;
      if (f % 60 === 0) checkSpawns();
      const r = room();
      if (r && (P.pos.x < r.minX - 0.5 || P.pos.x > r.maxX + 0.5 || P.pos.z < r.minZ - 0.5 || P.pos.z > r.maxZ + 0.5)) outside++;
      if (f % 3600 === 0 && !G.enemies.some((e) => e.alive)) { /* idle */ }
      if (M.phase === 'combat' && f - waveStart > 60 * 240) { rep.push(`wave ${M.wave}: TIME CAP, left: ${G.enemies.filter((e) => e.alive).slice(0, 4).map((e) => `${e.typeId || e.type || 'enemy'} ${e.pos.distanceTo(P.pos).toFixed(0)} m ${(e.pos.y - P.pos.y).toFixed(0)} up hp ${Math.round(e.hp)}`).join(', ')}`); for (const e of [...G.enemies]) if (e.alive) g.dealDamage(e, 1e7, { raw: true }); waveStart = f; }
    }
    inp.mouse.left = false;
    const boons = Object.entries(M.boonRun.boons).map(([k, n]) => `${k}${n > 1 ? ' x' + n : ''}`).join(', ') || 'none';
    const wep = Object.entries(M.boonRun.weapons).map(([k, v]) => `${k}: ${v.name}`).join(', ') || 'none';
    const bad = outside || unfair || rep.some((x) => x.includes('TIME CAP')) || (M.wave > 5 && !M.boonRun.picks);
    const head = `${M.act.name} (${waves} waves, armor Light ${light}, kit: ${kit}): ${bad ? 'PROBLEM' : 'ok'}, wave ${M.wave}, arena ${M.arenaIdx + 1} (${M.loc.name}), ${M.kills} kills, ${deaths} bot deaths`;
    return `${head}\n  ${rep.join('\n  ')}\n  boons: ${boons}; weapon swaps: ${wep}; sealed room: ${outside ? outside + ' LEAKS' : 'no leaks'}; unfair spawns: ${unfair}${errs.length ? `\n  ERRORS ${[...new Set(errs)].join('; ')}` : '\n  no errors'}`;
  } catch (e) {
    return `RUN ERROR ${e.message} | ${String(e.stack).split('\n').slice(1, 3).join(' | ')}${errs.length ? `\n  ERRORS ${errs.join('; ')}` : ''}`;
  } finally {
    window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onErr); console.error = cerr;
  }
}

function aim(P, e) {
  const t = e.center({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } });
  const dx = t.x - P.pos.x, dz = t.z - P.pos.z, dy = t.y - (P.pos.y + P.eyeH);
  P.yaw = Math.atan2(-dx, -dz); // getForward: (-sin yaw, sin pitch, -cos yaw)
  P.pitch = Math.atan2(dy, Math.hypot(dx, dz));
}

// Bosses get heavy, then special; everything else gets the primary (infinite reserve). Swords stay out of the bot's hands.
function pickWeapon(P, e) {
  const has = (w) => w && !w.A.sword && (w.ammo > 0 || w.reserve > 0);
  const by = (slot) => P.weapons.find((w) => w.item.slot === slot);
  const want = e.isBoss ? [by('heavy'), by('special'), by('primary')].find(has) : by('primary');
  if (want && P.cur !== want.idx) { P.cur = want.idx; P.switchT = 0; }
}
