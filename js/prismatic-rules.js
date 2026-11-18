// U27 Prismatic: Transcendence rules. Pure data and functions (no DOM, no Three.js) so tools/tests.html can check them.
// js/prismatic.js wires them into the Player at a few marked points (the U22 pattern).
//
// Two meters: Light (fed by Solar, Arc and Void damage) and Dark (Stasis and Strand). Kinetic feeds both at half rate. Super damage
// does not fill them, and nothing fills them while you are Transcendent. When both are full you can activate: a short window of faster
// ability regeneration, more weapon damage and damage resistance against combatants. Kills extend it up to a cap. Starting numbers,
// tuned with tools/playcheck.sh (Destiny 2's own are not published).

export const LIGHT_ELEMENTS = ['solar', 'arc', 'void'];
export const DARK_ELEMENTS = ['stasis', 'strand'];

export const TRANSCEND = {
  full: 100, // a full meter
  perDamage: 0.04, // meter points per point of damage: 2500 damage fills one
  kineticRate: 0.5, // Kinetic fills both meters at this share
  duration: 10, // seconds
  killExtend: 1, // seconds per kill
  cap: 20, // the longest a Transcendence can run
  regen: 1.5, // ability recharge speed (applied outside the REGEN_CAP, like Destiny 2's "boosted")
  weaponDmg: 1.1, // weapon damage
  resist: 0.8, // incoming damage from combatants (never from players)
  refund: 0.15, // melee hits refund this share of the grenade and the other way round
  hold: 0.15, // seconds the second of grenade + melee has to follow the first to count as the chord
};
/** Facet tuning (the Prismatic fragments, see subclass.js FRAGMENTS). */
export const FACET = {
  balance: 1.25, // meter fill speed
  dawn: 3, // extra seconds
  hopeKill: 2, // kill extension multiplier
  justice: 1.05, // weapon damage, on top of weaponDmg
  graceClass: 1.25, // class ability recharge while Transcendent
  purposeFill: 5, // per ability kill, both meters
  sacrificeSuper: 3, // % super energy per grenade or melee kill
  mendingHeal: 0.5,
  generosityRefund: 0.3,
  protectionOver: 50,
};

/** A fresh state: both meters empty, not Transcendent. */
export const newTranscendence = () => ({ light: 0, dark: 0, active: false, t: 0, max: 0, kills: 0 });

/** True for the kit of a Prismatic subclass (meters, the transcend key and the tile show only then). */
export const isPrismaticKit = (kit) => !!kit?.prismatic;

/** Which meters an element feeds, as shares of the damage: { light, dark }. */
export function meterShare(element) {
  if (LIGHT_ELEMENTS.includes(element)) return { light: 1, dark: 0 };
  if (DARK_ELEMENTS.includes(element)) return { light: 0, dark: 1 };
  if (element === 'kinetic') return { light: TRANSCEND.kineticRate, dark: TRANSCEND.kineticRate };
  return { light: 0, dark: 0 };
}

/**
 * Damage you dealt fills the meters. `source` 'super' never fills; nothing fills while Transcendent. `fillMult` is the Facet of Balance.
 * Returns the state (mutated).
 */
export function fillMeters(m, element, dmg, source = 'weapon', fillMult = 1) {
  if (m.active || source === 'super' || !(dmg > 0)) return m;
  const share = meterShare(element), pts = dmg * TRANSCEND.perDamage * fillMult;
  m.light = Math.min(TRANSCEND.full, m.light + pts * share.light);
  m.dark = Math.min(TRANSCEND.full, m.dark + pts * share.dark);
  return m;
}
/** A flat fill of both meters (Facet of Purpose), in meter points. */
export function fillBoth(m, pts) {
  if (m.active) return m;
  m.light = Math.min(TRANSCEND.full, m.light + pts);
  m.dark = Math.min(TRANSCEND.full, m.dark + pts);
  return m;
}

export const ready = (m) => !m.active && m.light >= TRANSCEND.full && m.dark >= TRANSCEND.full;
/** Seconds one Transcendence can run for this kit (Facet of Dawn adds time). */
export const durationFor = (frag) => TRANSCEND.duration + (frag?.has?.('dawn') ? FACET.dawn : 0);
export const capFor = (frag) => TRANSCEND.cap + (frag?.has?.('dawn') ? FACET.dawn : 0);

/** Starts Transcendence if both meters are full. Returns true when it started. */
export function activate(m, frag) {
  if (!ready(m)) return false;
  m.light = 0; m.dark = 0;
  m.active = true; m.kills = 0;
  m.t = m.max = durationFor(frag);
  return true;
}
/** A kill while Transcendent adds time up to the cap (Facet of Hope doubles it). */
export function extend(m, frag) {
  if (!m.active) return m;
  const add = TRANSCEND.killExtend * (frag?.has?.('hope') ? FACET.hopeKill : 1);
  m.kills++;
  m.t = Math.min(capFor(frag), m.t + add);
  m.max = Math.max(m.max, m.t);
  return m;
}
/** Counts the clock down. Returns true on the frame it ends. */
export function tick(m, dt) {
  if (!m.active) return false;
  m.t -= dt;
  if (m.t > 0) return false;
  m.active = false; m.t = 0; m.max = 0;
  return true;
}
/** The end of a mission or activity empties everything. */
export function reset(m) { m.light = 0; m.dark = 0; m.active = false; m.t = 0; m.max = 0; m.kills = 0; return m; }

/** Weapon damage multiplier while Transcendent. */
export const weaponMult = (m, frag) => (m.active ? TRANSCEND.weaponDmg * (frag?.has?.('justice') ? FACET.justice : 1) : 1);
/** Incoming damage multiplier: only against combatants (enemies), never against other players. */
export const incomingMult = (m, fromPlayer = false) => (m.active && !fromPlayer ? TRANSCEND.resist : 1);
/** Ability recharge multiplier while Transcendent: 'grenade' | 'melee' | 'class'. */
export const regenMult = (m, kind, frag) => (m.active ? TRANSCEND.regen * (kind === 'class' && frag?.has?.('grace') ? FACET.graceClass : 1) : 1);

/** Whether the tracking is on at all: only a Prismatic subclass draws and feeds the meters. */
export const tracked = (kit) => isPrismaticKit(kit);

/** The flag co-op sends: 0 no Prismatic, 1 Prismatic idle, 2 Transcendent (teammates see the glow). */
export const coopFlag = (kit, m) => (!isPrismaticKit(kit) ? 0 : m.active ? 2 : 1);
