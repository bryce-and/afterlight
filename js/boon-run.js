// U24 Roguelike Horde: the runtime side of boons. The rules and numbers live in boons.js; this file applies them to the live
// Guardian and enemies through hooks that player.js and game.js call (each hook is a no-op outside a Horde run).
import * as THREE from 'three';
import { G } from './state.js';
import { makeWeapon as makeItemWeapon, makeExotic } from './loot.js';
import { lightning, sparks } from './effects.js';
import { ELEMENTS, EXOTIC_RANDOM_WEAPONS, ARCHETYPES } from './data.js';
import {
  newBoonRun, resetBoonRun, boonTotals, damageMult, damageTakenMult, reloadTimeMult, magMult, shieldMult, speedMult, jumpMult, extraDrops, shotCount, MULTISHOT_EXTRA_DMG,
  chargeMult, specialDropMult, frostSlow, BOON_CONST, BOONS, BOON_BY_ID, applyOption, rollOffer,
} from './boons.js';
import { dealDamage, enemiesNear, explode } from './game.js';

/** H35: the slots every Roguelike run starts with. The weapon in each slot is a random legendary (any archetype of that slot), whatever the player owns. */
export const HORDE_KIT = [{ slot: 'primary' }, { slot: 'special' }, { slot: 'heavy' }];

export const hordeRun = () => (G.mission?.act?.roguelike ? G.mission.boonRun || null : null);
let cache = { run: null, picks: -1, t: {} };
/** The summed boon effects for the running Horde, {} outside one. Cached until a pick changes the run. */
export function bt() {
  const run = hordeRun();
  if (!run) return NOEFFECT;
  if (cache.run !== run || cache.picks !== run.picks) cache = { run, picks: run.picks, t: boonTotals(run) };
  return cache.t;
}
const NOEFFECT = {};
const on = () => !!hordeRun();

/** Starts a fresh run inventory for this Horde and swaps in the kit (the save's own loadout is not touched). */
export function startBoonRun(M, P, power) {
  M.boonRun = newBoonRun();
  M.boonState = { momentum: [], rushUntil: 0, saves: 0, savesUsed: 0, lastWave: 0 };
  cache = { run: null, picks: -1, t: {} };
  for (const k of HORDE_KIT) {
    const item = makeItemWeapon(k.slot, power, 3);
    item.isNew = false;
    P.swapWeapon(P.weapons.findIndex((w) => w.item.slot === k.slot), item);
  }
  refreshBoons(P);
}
/** Run over (death or clear): the inventory is gone. */
export function endBoonRun(M) { if (M.boonRun) resetBoonRun(M.boonRun); }

/** The weapon pool a swap offer draws from: this Guardian's class-agnostic legendaries by archetype, plus the exotic weapons. */
export function weaponPool(power) {
  const pool = [];
  for (const slot of ['primary', 'special', 'heavy']) {
    for (let i = 0; i < 2; i++) { // two random legendaries per slot, rolled now so the offer names real items
      try { const it = makeItemWeapon(slot, power, 3); pool.push({ slot, name: it.name, exotic: false, item: it }); } catch { /* a slot with no named weapon is skipped */ }
    }
  }
  for (const e of EXOTIC_RANDOM_WEAPONS) pool.push({ slot: e.slot || ARCHETYPES[e.arch].slot, name: e.name, exotic: true });
  return pool;
}
/** Builds the actual item for a weapon option (legendary from the offer's own roll, or the named exotic). */
export function itemForOption(o, power, pool) {
  if (o.exotic) { const it = makeExotic(o.name, power); it.isNew = false; return it; }
  const it = pool.find((w) => w.name === o.name && w.slot === o.slot)?.item;
  if (!it) throw new Error(`itemForOption: ${o.name} is not in the offer pool`);
  it.isNew = false;
  return it;
}

/** Applies one chosen option for the local Guardian: a buff, or a weapon swap that replaces the slot for the run. */
export function takeOption(P, option, item = null) {
  const run = G.mission.boonRun;
  applyOption(run, option);
  if (option.kind === 'weapon') P.swapWeapon(P.weapons.findIndex((w) => w.item.slot === option.slot), item);
  refreshBoons(P);
}

/** Re-reads every stat a boon touches (call after any pick, and after the kit swap). */
export function refreshBoons(P) {
  P.applyStats();
  for (const w of P.weapons) {
    w.magBase ??= w.mag;
    const m = Math.max(1, Math.round(w.magBase * magMult(bt())));
    w.mag = m;
    w.ammo = Math.min(w.ammo, m);
  }
}

// ---- stats (called from Player.applyStats) ----
export function applyBoonStats(P) {
  if (!on()) return;
  const t = bt();
  P.maxShield = Math.round(P.maxShield * shieldMult(t));
  P.hpBase ??= P.maxHealth; // Vitality: scale from the Guardian's own base, and give the new health when it grows
  const hp = Math.round(P.hpBase * (1 + (t.hpMax || 0)));
  if (hp > P.maxHealth) P.health += hp - P.maxHealth;
  P.maxHealth = hp; P.health = Math.min(P.health, hp);
  if (t.regen) { P.regenRate *= 1 + t.regen; P.regenDelay /= 1 + t.regen; }
  P.speed *= speedMult(t);
  P.jumpV *= jumpMult(t);
  P.superRate *= chargeMult(t, 'super');
  P.cdMax.grenade /= chargeMult(t, 'grenade');
  P.cdMax.melee /= chargeMult(t, 'melee');
  P.cdMax.class /= chargeMult(t, 'class');
}
/** Reload time and move-speed multipliers read each use. */
export const reloadMult = () => (on() ? reloadTimeMult(bt()) : 1);
export function moveMult() {
  if (!on()) return 1;
  const S = G.mission.boonState;
  return G.time < S.rushUntil ? 1 + (bt().rushSpeed || 0) : 1;
}
export const dropMult = () => (on() ? specialDropMult(bt()) : 1);

// ---- damage dealt ----
const _c = new THREE.Vector3();
function momentumStacks() {
  const S = G.mission.boonState;
  S.momentum = S.momentum.filter((t) => t > G.time);
  return S.momentum.length;
}
/** The boon multiplier for one weapon hit on enemy e. */
export function outgoing(P, e) {
  if (!on() || !e) return 1;
  const t = bt();
  return damageMult(t, {
    boss: !!e.isBoss, elite: !!(e.isBoss ? false : e.tier === 'major' || e.cls === 'heavy'),
    shieldDown: P.maxShield > 0 && P.shield <= 0, targetFrac: e.maxHp ? e.hp / e.maxHp : null, selfFrac: P.maxHealth ? P.health / P.maxHealth : null, momentumStacks: momentumStacks(),
  });
}
/** After a weapon hit lands: Frostbite slow, Arc Conductor chain (precision), Ricochet. `dmg` is the hit's final damage. */
export function afterHit(P, e, dmg, crit, point) {
  if (!on() || !e || e.isGuardian) return;
  const t = bt();
  const slow = frostSlow(t);
  if (slow > 0 && e.alive) e.status?.apply?.('slow', { t: BOON_CONST.frostSecs });
  if (crit && t.arcChain) {
    for (const o of enemiesNear(e.pos, 9, Math.min(4, Math.round(t.arcChain)), e)) {
      o.center(_c); lightning(point, _c, ELEMENTS.arc.hex, 0.03);
      dealDamage(o, dmg * 0.5, { element: 'arc', source: 'perk', pos: _c.clone() });
    }
  }
  if (t.ricochet) {
    const n = Math.min(4, Math.round(t.ricochet));
    for (const o of enemiesNear(e.pos, BOON_CONST.ricochetRange, n, e)) {
      o.center(_c); lightning(point, _c, 0xffe3a0, 0.02);
      dealDamage(o, dmg * BOON_CONST.ricochetDmg, { element: 'kinetic', source: 'perk', pos: _c.clone() });
    }
  }
}

// ---- kills ----
export function onKillBoons(P, e, o) {
  if (!on()) return;
  const t = bt(), S = G.mission.boonState;
  if (t.killHeal) P.healPct(Math.min(1, t.killHeal));
  if (t.killShield) P.shield = Math.min(P.maxShield, P.shield + P.maxShield * t.killShield);
  if (t.killSuper && !P.superActive) P.superCharge = Math.min(100, P.superCharge + t.killSuper);
  if (t.killCd) for (const k of ['grenade', 'melee', 'class']) P.cd[k] = Math.max(0, P.cd[k] - P.cdMax[k] * Math.min(0.5, t.killCd));
  if (t.momentum) S.momentum.push(G.time + BOON_CONST.momentumSecs);
  if (t.rushSpeed) S.rushUntil = G.time + BOON_CONST.rushSecs;
  if (t.gravePct) {
    const w = P.weapon;
    if (w && w.reserve > 0) {
      const give = Math.min(w.reserve === Infinity ? Infinity : w.reserve, Math.max(1, Math.ceil(w.mag * t.gravePct)), w.mag - w.ammo);
      if (give > 0) { w.ammo += give; if (w.reserve !== Infinity) w.reserve -= give; }
    }
  }
  if (t.crownBlast && o.crit) {
    const c = e.center(new THREE.Vector3());
    explode(c, BOON_CONST.crownBlastRadius, (e.maxHp || 100) * BOON_CONST.crownBlastDmg * Math.min(3, t.crownBlast), 'solar', { source: 'perk', small: true });
  }
  if (t.grenadeHeavy && o.source === 'ability' && P.grenadeWin && G.time < P.grenadeWin) {
    const w = P.weapons.find((x) => x.item.slot === 'heavy');
    if (w && w.reserve !== Infinity) w.reserve = Math.min(w.maxReserve, w.reserve + Math.max(1, Math.round(w.brick * 0.5 * t.grenadeHeavy)));
  }
}
/** Scorched Earth: a grenade's burst leaves burning ground. */
export function onGrenade(P, pt) {
  if (!on() || !bt().scorch) return;
  const n = Math.round(bt().scorch);
  const until = G.time + BOON_CONST.scorchSecs;
  let next = 0;
  G.tickers.push({ update(dt) {
    next -= dt;
    if (next <= 0) {
      next = 0.5;
      for (const x of enemiesNear(pt, 3.2, 8)) dealDamage(x, 60 * n, { element: 'solar', source: 'perk', pos: x.center(new THREE.Vector3()), burn: 0.6 });
      sparks(pt.clone().setY(0.2), ELEMENTS.solar.hex, 6, 2, 0.08, 0.5);
    }
    return G.time < until;
  } });
}

// ---- damage taken ----
/** Iron Skin: returns the reduced amount. */
export const incoming = (amount) => (on() ? amount * damageTakenMult(bt(), G.player?.shield > 0) : amount);
/** Multishot: { total, extra, dmg } for a gun that fires `base` bullets (no boon: { total: base, extra: 0 }). */
export const shots = (base) => (on() ? { ...shotCount(bt(), base), dmg: MULTISHOT_EXTRA_DMG } : { total: base, extra: 0, dmg: 1 });
/** Beacon: extra boon orbs this round. */
export const beaconDrops = () => (on() ? extraDrops(bt()) : 0);
export const PHOENIX_GRACE = 2.5; // seconds of invulnerability after Phoenix Rite saves you
/** Phoenix Rite: true when a killing blow was absorbed (the Guardian is left at 1 health). Saves refill each wave. */
export function phoenixSave(P) {
  if (!on()) return false;
  const S = G.mission?.boonState, saves = Math.round(bt().phoenix || 0);
  if (!S || S.savesUsed >= saves) return false;
  S.savesUsed++;
  P.health = 1;
  P.phoenixT = G.time + PHOENIX_GRACE; // U31: a moment of safety, so the rest of the volley that landed the killing blow cannot finish you
  sparks(P.pos.clone().setY(1), 0xffb347, 40, 8, 0.1, 0.8);
  return true;
}
/** A new wave starts: Phoenix Rite saves refill. */
export function newWave() { if (G.mission?.boonState) G.mission.boonState.savesUsed = 0; }

// ---- display ----
/** "Name x2" lines for the HUD / pause list. */
export const boonLines = () => {
  const run = hordeRun();
  if (!run) return [];
  return Object.entries(run.boons).map(([id, n]) => `${BOON_BY_ID[id].name}${n > 1 ? ` x${n}` : ''}`);
};
export { BOONS, rollOffer };
