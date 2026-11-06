// U20a Legend and Ultimate (tiers): the Base, Legendary and Ultimate campaigns. Same 18 missions, harder.
// Pure data and rules (no DOM, no Three.js) so tools/tests.html can check them. See docs/DECISIONS.md (2026-11-06).
import { LOCATIONS } from './data.js';
import { LIGHT_CAP } from './progression.js';

/**
 * over: enemies sit this far above your (combat) Light, Destiny 2 style power lock (0 = the mission's own Light).
 * band: mission Light is rescaled into this range for rewards. cap: highest Light this tier's loot can reach.
 * lethal: no revives; in a fireteam any death ends the run.
 */
export const CAMPAIGN_TIERS = {
  base: { id: 'base', name: 'Base', over: 0, band: null, cap: LIGHT_CAP, lethal: false },
  legendary: { id: 'legendary', name: 'Legendary', over: 25, band: [200, 300], cap: 300, lethal: false },
  ultimate: { id: 'ultimate', name: 'Ultimate', over: 50, band: [300, 350], cap: 350, lethal: true },
};
export const TIER_IDS = ['base', 'legendary', 'ultimate'];
/** Highest Light any item can have. */
export const LIGHT_MAX = CAMPAIGN_TIERS.ultimate.cap;

const MISSION_IDS = LOCATIONS.flatMap((l) => l.missions.map((m) => m.id));
const POWERS = LOCATIONS.flatMap((l) => l.missions.map((m) => m.power));
const P_MIN = Math.min(...POWERS), P_MAX = Math.max(...POWERS);

export const tierOf = (id) => CAMPAIGN_TIERS[id] || CAMPAIGN_TIERS.base;

/** A mission's Light in a tier: the base Light, or the base Light mapped into the tier's band (first mission = band start, last = band end). */
export function tierPower(power, tierId) {
  const t = tierOf(tierId);
  if (!t.band) return power;
  const f = (power - P_MIN) / (P_MAX - P_MIN);
  return Math.round(t.band[0] + f * (t.band[1] - t.band[0]));
}

/** Enemy Light for combat. Base: the mission's Light. Legendary/Ultimate: your combat Light plus the tier offset. */
export function tierEnemyLight(power, tierId, combatLight) {
  const t = tierOf(tierId);
  return t.over ? combatLight + t.over : power;
}

/** A reward Light: `pp + add`, held under `cap`, but never pushed below a Light you already have. */
export const capRoll = (pp, add, cap = LIGHT_CAP) => Math.min(Math.max(cap, pp), pp + add);

/** This Guardian's clear record for a tier (base is the long-standing `s.cleared`). */
export function tierClears(s, tierId) {
  if (tierId === 'base' || !CAMPAIGN_TIERS[tierId]) return s.cleared || {};
  s.tierCleared = s.tierCleared || {};
  return (s.tierCleared[tierId] = s.tierCleared[tierId] || {});
}
export function campaignDone(s, tierId) {
  const c = tierClears(s, tierId);
  return MISSION_IDS.every((id) => c[id]);
}

/** Base is always open. Legendary opens on a base clear, Ultimate on a Legendary clear; an Ultimate clear on any Guardian opens both for all (s.ultimateAll). */
export function tierUnlocked(s, tierId) {
  if (tierId === 'base') return true;
  if (s.ultimateAll) return !!CAMPAIGN_TIERS[tierId];
  if (tierId === 'legendary') return campaignDone(s, 'base');
  if (tierId === 'ultimate') return campaignDone(s, 'legendary');
  return false;
}
export const unlockedTiers = (s) => TIER_IDS.filter((t) => tierUnlocked(s, t));
/** The tier picked in the Director, or Base when that pick is not open (any more). */
export const selectedTier = (s) => (tierUnlocked(s, s.tier) ? s.tier : 'base');

/**
 * Records a clear. Returns what it opened: { legendary, ultimate, all } (true when this clear unlocked it).
 * An Ultimate campaign clear sets the account-wide unlock.
 */
export function recordClear(s, missionId, tierId) {
  const before = { legendary: tierUnlocked(s, 'legendary'), ultimate: tierUnlocked(s, 'ultimate'), all: !!s.ultimateAll };
  tierClears(s, tierId)[missionId] = true;
  if (tierId === 'ultimate' && campaignDone(s, 'ultimate')) s.ultimateAll = true;
  return {
    legendary: !before.legendary && tierUnlocked(s, 'legendary'),
    ultimate: !before.ultimate && tierUnlocked(s, 'ultimate'),
    all: !before.all && !!s.ultimateAll,
  };
}
