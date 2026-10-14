// Guardian progression: level 1-40 from XP, the level reward track, drop rarity
// by level, and the Light cap. Pure data and functions (no DOM, no Three.js) so
// tools/tests.html can check them directly.
import { CLASSES } from './data.js';
import { weightedIndex } from './util.js';

export const LEVEL_CAP = 40;
/** Highest Light the base campaign can reach (Legendary and Ultimate raise it later). */
export const LIGHT_CAP = 200;

// XP sources. Kills are shared by the whole fireteam; mission and cache XP go to whoever opens it.
export const XP = {
  kill: { grunt: 10, rusher: 8, captain: 30, heavy: 50, boss: 400 },
  mission: 500,
  firstClear: 1000,
  actCache: 300, // each Horde / Endless cache
};

/** XP needed to go from `level` to level + 1. */
export const xpToNext = (level) => 500 + 100 * (level - 1);

/** Total XP needed to reach `level` from level 1. */
export function xpForLevel(level) {
  let t = 0;
  for (let l = 1; l < level; l++) t += xpToNext(l);
  return t;
}

/** { level, into, need, max } for a running XP total. */
export function levelInfo(xp) {
  let level = 1, rest = Math.max(0, xp);
  while (level < LEVEL_CAP && rest >= xpToNext(level)) { rest -= xpToNext(level); level++; }
  const max = level >= LEVEL_CAP;
  return { level, into: max ? 0 : rest, need: max ? 0 : xpToNext(level), max };
}

// ---------- Reward track ----------
export const EXOTIC_LEVELS = [20, 40];
export const LEGENDARY_EVERY = 3;

/** 'exotic' | 'legendary' | null: the claimable item reward at a level. */
export function rewardAt(level) {
  if (EXOTIC_LEVELS.includes(level)) return 'exotic';
  if (level % LEGENDARY_EVERY === 0) return 'legendary';
  return null;
}

// ---------- Subclasses ----------
/** Level a subclass unlocks at (starters are 1). */
export const subclassLevel = (classId, subId) => CLASSES[classId].subclasses[subId]?.unlockLevel ?? 1;

/** [{ classId, subId, name }] of subclasses that unlock exactly at `level` (starters are not listed). */
export function subclassesUnlockedAt(level) {
  const out = [];
  for (const [classId, c] of Object.entries(CLASSES)) {
    for (const [subId, sc] of Object.entries(c.subclasses)) if (sc.unlockLevel === level) out.push({ classId, subId, name: sc.name });
  }
  return out;
}

// ---------- Drop rarity by level ----------
// Weights for [common, uncommon, rare, legendary, exotic] at anchor levels, interpolated
// linearly between them. Legendaries are rare at 15 and almost all you see at 40.
export const RARITY_CURVE = [
  { level: 1, w: [60, 30, 10, 0, 0] },
  { level: 10, w: [35, 38, 25, 1.5, 0.5] },
  { level: 15, w: [22, 36, 36, 5, 1] },
  { level: 25, w: [8, 22, 45, 23, 2] },
  { level: 35, w: [2, 8, 30, 57, 3] },
  { level: 40, w: [0, 1, 6, 90, 3] },
];

export function rarityWeights(level) {
  const L = Math.max(1, Math.min(LEVEL_CAP, level));
  for (let i = 1; i < RARITY_CURVE.length; i++) {
    const a = RARITY_CURVE[i - 1], b = RARITY_CURVE[i];
    if (L <= b.level) {
      const t = (L - a.level) / (b.level - a.level);
      return a.w.map((x, k) => x + (b.w[k] - x) * t);
    }
  }
  return [...RARITY_CURVE[RARITY_CURVE.length - 1].w];
}

/** Rarity index for a drop at this level. Bonus levels (boss caches, first clears) read further up the curve. */
export const rollRarity = (level, bonus = 0, r = Math.random) => weightedIndex(rarityWeights(level + bonus), r);
