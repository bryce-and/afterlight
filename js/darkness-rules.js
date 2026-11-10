// U22 Darkness: the pure rules and numbers for Stasis and Strand (no DOM, no Three.js) so the tests can check them.
// Stasis (docs/reference/stasis): slow stacks up into a freeze; damage shatters a frozen target or a crystal
// in a shrapnel blast; crystals freeze what is near them as they form and dissolve over time.
// Strand: suspend lifts a target helplessly into the air, unravel makes hits on it spin threads into
// enemies nearby, sever cuts the damage it deals. Bosses (and exotic-mission bosses) are only slowed or
// severed: they never freeze or suspend.

export const DARK_UNLOCK = 28; // Guardian level the six Darkness subclasses unlock at (Bryce, 2026-11-09)
export const DARK_ELEMENTS = ['stasis', 'strand'];

export const STASIS = {
  slowT: 6, freezeAt: 4, bossSlowCap: 3, // H23: freeze at 4 stacks (was 5), slow lasts 6s (was 4)
  freezeT: { grunt: 3, rusher: 3, suicide: 3, captain: 2.4, heavy: 1.6 },
  shatter: { dmg: 260, r: 4, splash: 150 }, // the frozen target takes dmg; enemies within r take splash
  crystal: { life: 10, freezeR: 2.6, freezeT: 2.5, r: 4.5, dmg: 180, size: 1.3 },
  // Players hit by Stasis enemies: three stacks of Chilled freeze you; mash Space to break out early at a small health cost
  player: { slowT: 3, freezeAt: 3, freezeT: 2.4, breakStep: 0.35, breakCost: 0.04, move: 0.6, handling: 1.35, spread: 1.5, regen: 0.5 },
};

export const STRAND = {
  suspendT: { grunt: 3.5, rusher: 3.5, suicide: 3.5, captain: 2.5, heavy: 1.5 },
  lift: 1.8,
  unravel: { t: 6, n: 2, r: 8, dmg: 34, gap: 0.35 },
  sever: { t: 6, mult: 0.6 },
  tangle: { life: 10, r: 4.5, dmg: 240, suspend: 1 },
  woven: { t: 6, cut: 0.55 },
  // H23: threadlings skitter along the ground (speed), leap at a target within leapR (leapT seconds in the air),
  // and burst. A Broodweaver's threadlings that find nothing perch on the caster (at most perchMax) and jump off
  // when the caster deals direct damage (at most once per releaseGap). H24: perched ones shrink to perchScale and
  // circle low at the caster's feet (perchY up, perchR out) so they stay out of the first-person view.
  threadling: { life: 6, dmg: 90, speed: 11, seekR: 24, leapR: 3.2, leapT: 0.32, perchMax: 5, releaseGap: 0.4, scale: 1.6, perchScale: 0.6, perchY: 0.3, perchR: 0.7 },
  player: { suspendT: 1.4 },
};

/** Can this subclass's threadlings perch on the caster? Only the Broodweaver's (Destiny 2's Warlock trait). */
export const canPerch = (sub) => sub === 'broodweaver';
/** Perch `add` threadlings on top of `cur`: returns how many are perched now and how many found no room. */
export function perchAdd(cur, add, max = STRAND.threadling.perchMax) {
  const perched = Math.min(max, cur + add);
  return { perched, lost: cur + add - perched };
}
/** H24: does this hit release perched threadlings? Any direct damage the caster deals (weapon, melee, ability, super);
 *  not companions (threadlings themselves, turrets), chain hits, perk procs or zero-damage relays. */
export const releasesPerch = (o, dmg) => dmg > 0 && !o.remoteHit && !o.raw && !o.companion && !o.jolted
  && (o.source === 'weapon' || o.source === 'melee' || o.source === 'ability' || o.source === 'super');

// H23: Darkness weapon perks (they roll only on weapons of their element, PERK_ELEMENT) and the "Rounds" buffs
// that make weapon hits apply a Darkness debuff (Chilling, Severing; Unraveling Rounds from U22).
export const DARK_PERKS = {
  chillclip: { stacks: 1, crit: 2, gap: 0.25 }, // hits slow; precision hits slow twice
  headstone: { size: 0.9 }, // precision kills raise a Stasis crystal
  hatchling: { n: 1 }, // precision kills weave a threadling
  slice: { hits: 3, window: 1.5 }, // 3 hits on one enemy within 1.5s sever it
};
export const ROUNDS = { chilling: { stacks: 1, gap: 0.25 } };
/** Slow stacks a weapon hit adds (Chill Clip, Chilling Rounds, Whisper of Impairment), or 0. A frozen target gets none so the hit shatters it. */
export function weaponChill({ chillclip = false, chilling = false, impairment = false, slowed = false, frozen = false, crit = false }) {
  if (frozen) return 0;
  let n = 0;
  if (chillclip) n += crit ? DARK_PERKS.chillclip.crit : DARK_PERKS.chillclip.stacks;
  if (chilling) n += ROUNDS.chilling.stacks;
  if (impairment && slowed) n += 1;
  return n;
}
/** Slice: keep the hit times within the window; returns the kept list and whether this hit severs. */
export function sliceHit(times, now) {
  const S = DARK_PERKS.slice;
  const kept = times.filter((t) => now - t < S.window);
  kept.push(now);
  return kept.length >= S.hits ? { times: [], sever: true } : { times: kept, sever: false };
}

const isBossLike = (e) => !!(e.isBoss || e.exoBoss);
export const canFreeze = (e) => !isBossLike(e);
export const canSuspend = (e) => !isBossLike(e);

/**
 * Add Stasis slow stacks. Returns the new stack count and whether the target freezes now
 * (the stacks are spent on the freeze). Bosses stop at bossSlowCap and never freeze.
 */
export function chill(stacks, add, boss = false) {
  const cap = boss ? STASIS.bossSlowCap : STASIS.freezeAt;
  const n = Math.min(cap, stacks + add);
  if (!boss && n >= STASIS.freezeAt) return { stacks: 0, freeze: true };
  return { stacks: n, freeze: false };
}

/** Seconds an enemy of base class `cls` stays frozen (or suspended); `mult` from fragments such as Whisper of Durance. */
export const freezeTime = (cls, mult = 1) => (STASIS.freezeT[cls] ?? STASIS.freezeT.grunt) * mult;
export const suspendTime = (cls, mult = 1) => (STRAND.suspendT[cls] ?? STRAND.suspendT.grunt) * mult;

/**
 * Does this hit shatter a frozen target? Every damaging hit does (a fireteam member's relayed hits too),
 * except the Stasis hits that slow or freeze, which would break the freeze they just made. Shatter
 * blasts do shatter other frozen enemies, so a frozen crowd can chain.
 */
export const shatters = (o, dmg) => dmg > 0 && !o.slowAdd && !o.freeze;

/** Shatter damage after fragments: Whisper of Fissures adds `fissures` (0.5 = +50%) and a metre of radius. */
export function shatterBlast(fissures = 0) {
  const S = STASIS.shatter;
  return { dmg: S.dmg * (1 + fissures), splash: S.splash * (1 + fissures), r: S.r + (fissures ? 1 : 0) };
}

/** A player's Chilled stacks from enemy Stasis: returns the new stacks and whether you freeze. */
export function playerChill(stacks, add) {
  const n = stacks + add;
  return n >= STASIS.player.freezeAt ? { stacks: 0, freeze: true } : { stacks: n, freeze: false };
}

/** Time left on a player's freeze after a Space press: each press breaks off breakStep seconds. */
export const breakFree = (t) => Math.max(0, t - STASIS.player.breakStep);

/** Enemy damage multiplier while severed. */
export const severMult = (severed) => (severed ? STRAND.sever.mult : 1);

/** How many enemies an unraveled target's threads reach (the target itself is not one of them). */
export const unravelTargets = (near, n = STRAND.unravel.n) => near.slice(0, n);

// ---- Darkness enemies ----
// A Captain whose shield rolls Stasis (Fallen) or Strand (Cabal) wields that Darkness: it throws a Darkness
// grenade every few seconds. Stasis grenades chill (3 stacks freeze); Strand grenades suspend you.
export const DARK_GRENADE = {
  cd: [8, 13], minRange: 6, maxRange: 26, r: 4, dmg: 20,
  stasis: { color: 0x4d88ff, name: 'Stasis grenade', chill: 2, field: 3 },
  strand: { color: 0x35e366, name: 'Strand grenade', suspendR: 3.2 },
};
/** The Darkness element a unit wields from its shield element, or null. */
export const darkWielder = (cls, shieldEl) => (cls === 'captain' && DARK_ELEMENTS.includes(shieldEl) ? shieldEl : null);
