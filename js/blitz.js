// U28 Mission Blitz: five different campaign missions back to back on Legendary numbers, no revives, one run.
// Pure rules (no DOM, no Three.js) so tools/tests.html can check them. See docs/DECISIONS.md (2026-11-16).
import { EXOTIC_RANDOM_WEAPONS, exoticArmorFor, LOCATIONS } from './data.js';
import { CAMPAIGN_TIERS, campaignDone } from './campaign.js';
import { mulberry32 } from './util.js';

export const BLITZ_LENGTH = 5;

/**
 * The tier config a Blitz mission runs on: Legendary numbers (+25 Light, density 1.25) but with no Light floor (enemies are always
 * your combat Light + 25, even when you are under the mission) and lethal (no revives, any death ends the run).
 * Its id stays 'legendary' so every Legendary-keyed rule (rewards, majors, clears) applies unchanged.
 */
export const BLITZ_TIER = { ...CAMPAIGN_TIERS.legendary, floor: false, lethal: true };

/** Every campaign mission, in campaign order: { li, mi, id }. */
export const BLITZ_POOL = LOCATIONS.flatMap((l, li) => l.missions.map((m, mi) => ({ li, mi, id: m.id })));

/** Opens account-wide: any Guardian (the active one or a stored one) has fully cleared the Legendary campaign, or s.ultimateAll. */
export function blitzUnlocked(s) {
  return !!s.ultimateAll || campaignDone(s, 'legendary') || Object.values(s.chars || {}).some((c) => campaignDone(c, 'legendary'));
}
export const BLITZ_LOCKED_HINT = 'Clear the Legendary campaign on any Guardian to unlock';

/** This Guardian's Blitz record, created on first read (older saves have none): `best` is the most missions cleared in one run (5 is a clear). */
export function blitzRecord(s) {
  if (!s.blitz || typeof s.blitz !== 'object') s.blitz = { clears: 0, best: 0 };
  s.blitz.clears = s.blitz.clears || 0;
  s.blitz.best = s.blitz.best || 0;
  return s.blitz;
}

/** Picks `n` different missions from the whole campaign from a seed (the same seed always gives the same list, so a fireteam agrees). */
export function pickMissions(seed, n = BLITZ_LENGTH) {
  if (n > BLITZ_POOL.length) throw new Error(`pickMissions: only ${BLITZ_POOL.length} missions exist`);
  const rng = mulberry32(seed);
  const left = [...BLITZ_POOL], out = [];
  while (out.length < n) out.push(left.splice(Math.floor(rng() * left.length), 1)[0]);
  return out;
}

// ---- run state: { seed, missions, step (0-based mission in play), failed, done } ----
export const newRun = (seed) => ({ seed, missions: pickMissions(seed), step: 0, failed: false, done: false });
/** The run as it stands when mission `step` (0-based) starts (a fireteam member joins the leader's run this way). */
export function runAt(seed, step) {
  const run = newRun(seed);
  if (!Number.isInteger(step) || step < 0 || step >= BLITZ_LENGTH) throw new Error(`runAt: no mission ${step} in a Blitz`);
  return { ...run, step };
}
export const runMission = (run) => run.missions[run.step];
/** Missions cleared so far: the step in play, or all of them once done. */
export const runCleared = (run) => (run.done ? BLITZ_LENGTH : run.step);
/** A clear of the mission in play: the next mission, or the finished run after the last. */
export function clearStep(run) {
  if (run.failed || run.done) throw new Error('clearStep: the run is over');
  return run.step >= BLITZ_LENGTH - 1 ? { ...run, done: true } : { ...run, step: run.step + 1 };
}
/** Any death ends the run. */
export function failRun(run) {
  if (run.done) throw new Error('failRun: the run is already done');
  return { ...run, failed: true };
}
/** "Blitz 2 of 5" and so on: the 1-based mission in play. */
export const runLabel = (run) => `Blitz ${Math.min(BLITZ_LENGTH, run.step + 1)} of ${BLITZ_LENGTH}`;

/** Adds a run's outcome to this Guardian's record: `best` rises to the missions cleared, a full run adds a clear. Returns the record. */
export function recordRun(s, run) {
  const r = blitzRecord(s);
  r.best = Math.max(r.best, runCleared(run));
  if (run.done) r.clears++;
  return r;
}

// ---- reward ----
/** The legendary drops a fireteam adds to each player's exotic: solo 0, two players 1, three players 2. */
export const blitzLegendaries = (fireteam) => Math.max(0, Math.min(2, Math.round(fireteam || 1) - 1));

/**
 * What the run's exotic pick menu offers this Guardian: every exotic weapon and this class's exotic armor not found yet, from the
 * same pools random drops use (mission and dungeon exotics stay out; Darkness exotics wait for their subclass level).
 * When every one is found: 3 random exotic armor pieces for this class instead. `found`: s.exoticsFound.
 * Returns { weapons: [name], armor: [name], allFound }.
 */
export function blitzPools(found, classId, level, rnd = Math.random) {
  const have = new Set(found || []);
  const armorPool = exoticArmorFor(classId, level).map((x) => x.name);
  const weapons = EXOTIC_RANDOM_WEAPONS.map((e) => e.name).filter((n) => !have.has(n));
  const armor = armorPool.filter((n) => !have.has(n));
  if (weapons.length || armor.length) return { weapons, armor, allFound: false };
  const left = [...armorPool], pick3 = [];
  while (pick3.length < 3 && left.length) pick3.push(left.splice(Math.floor(rnd() * left.length), 1)[0]);
  return { weapons: [], armor: pick3, allFound: true };
}
