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
  kill: { grunt: 10, rusher: 8, suicide: 8, captain: 30, heavy: 50, boss: 400 },
  mission: 500,
  firstClear: 1000,
  actCache: 300, // each Horde / Endless cache
};

/**
 * XP needed to go from `level` to level + 1. Loot 2.0 (U10) made the climb steeper: one clean solo run of the
 * base campaign (about 53,000 XP) ends near level 27, and with the usual replays around 30. Level 40 takes ~117,000.
 */
export const xpToNext = (level) => 500 + 80 * (level - 1) + 2 * (level - 1) ** 2;
/** The v1.9 curve, kept so save v8 can carry a player's level and progress over to the new one. */
export const xpToNextV1 = (level) => 500 + 100 * (level - 1);

/** Total XP needed to reach `level` from level 1. */
export function xpForLevel(level, curve = xpToNext) {
  let t = 0;
  for (let l = 1; l < level; l++) t += curve(l);
  return t;
}

/** { level, into, need, max } for a running XP total. */
export function levelInfo(xp, curve = xpToNext) {
  let level = 1, rest = Math.max(0, xp);
  while (level < LEVEL_CAP && rest >= curve(level)) { rest -= curve(level); level++; }
  const max = level >= LEVEL_CAP;
  return { level, into: max ? 0 : rest, need: max ? 0 : curve(level), max };
}

/** An XP total on the v1.9 curve moved to the current one: same level, same share of the way to the next. */
export function convertXp(xp) {
  const old = levelInfo(xp, xpToNextV1);
  if (old.max) return xpForLevel(LEVEL_CAP);
  return xpForLevel(old.level) + Math.floor((old.into / old.need) * xpToNext(old.level));
}

// ---------- Rarity gates (Loot 2.0) ----------
// The level a rarity can be used at. Drops never roll above what the player can use, and gear above it
// can't be equipped. Common and uncommon are open from level 1.
export const RARITY_GATE = { common: 1, uncommon: 1, rare: 5, legendary: 10, exotic: 20 };
const RARITY_IDS = ['common', 'uncommon', 'rare', 'legendary', 'exotic'];
export const LEVEL_TOO_LOW = 'Cannot equip. Player level too low.';
/** True when a player of this level can use an item of this rarity. */
export const canUseRarity = (rarity, level) => level >= (RARITY_GATE[rarity] ?? 1);
/** Index of the highest rarity usable at a level. */
export const maxRarityIndex = (level) => RARITY_IDS.reduce((m, id, i) => (canUseRarity(id, level) ? i : m), 0);
/** A rarity index lowered to what the level allows. */
export const capRarity = (rIdx, level) => Math.min(rIdx, maxRarityIndex(level));

// ---------- Reward track ----------
export const EXOTIC_LEVELS = [20, 40];
export const REWARD_EVERY = 3;

/** The rarity id of the claimable engram at a level, or null. Every engram is the best rarity usable at that level. */
export function rewardAt(level) {
  if (EXOTIC_LEVELS.includes(level)) return 'exotic';
  if (level % REWARD_EVERY === 0) return RARITY_IDS[Math.min(3, maxRarityIndex(level))];
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

/** Drop weights at a curve level (`level`), with every rarity the player (`gateLevel`) can't use set to 0. */
export function rarityWeights(level, gateLevel = level) {
  const w = curveWeights(level);
  return w.map((x, k) => (k <= maxRarityIndex(gateLevel) ? x : 0));
}

function curveWeights(level) {
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

/** Rarity index for a drop at this level. Bonus levels (boss caches, first clears) read further up the curve, but never past the gate. */
export const rollRarity = (level, bonus = 0, r = Math.random) => weightedIndex(rarityWeights(level + bonus, level), r);
