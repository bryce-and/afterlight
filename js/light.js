// U19 Light and Scaling: one place that turns the Light gap into combat multipliers.
// Missions, patrol zones and activities all read lightMults(); see docs/DECISIONS.md (2026-10-24 thresholds).

export const LIGHT = {
  over: 10,      // being over-Light helps up to +10, no further
  hard: 50,      // up to 50 under: beatable but extremely hard
  // 51 or more under: immune
  immuneIncoming: 12, // incoming damage multiplier while enemies are immune: most hits nearly kill
};

/** Effective Light in a fireteam: a member below the leader plays at the leader's Light. */
export function effectiveLight(own, leader) {
  return Number.isFinite(leader) ? Math.max(own, leader) : own;
}

/** The gap used for combat: your Light minus the enemies', capped at +10. Negative means under-Light. */
export function lightGap(playerLight, enemyLight) {
  return Math.min(LIGHT.over, playerLight - enemyLight);
}

/**
 * Multipliers for a Light gap.
 * Over-Light (gap >= 0): as before v4.1 (+2% dealt and -2.5% taken per point, taken floored at 0.6).
 * Under by 1 to 50: a curve that matches the old one for small gaps and steepens to x0.25 dealt and x3 taken at -50.
 * Under by 51 or more: enemies are immune (nothing you deal lands) and their attacks nearly kill.
 */
export function lightMults(gap) {
  if (gap >= 0) return { gap, immune: false, playerDmgMult: 1 + gap * 0.02, incomingMult: Math.max(0.6, 1 - gap * 0.025) };
  const u = -gap;
  if (u > LIGHT.hard) return { gap, immune: true, playerDmgMult: 0, incomingMult: LIGHT.immuneIncoming };
  return { gap, immune: false, playerDmgMult: 1 - 0.02 * u + 0.0001 * u * u, incomingMult: 1 + 0.025 * u + 0.0003 * u * u };
}

const GLYPHS = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

/** A stable scrambled version of an enemy name (same name, same scramble; spaces kept). */
export function scrambleName(name) {
  let h = 2166136261;
  let out = '';
  for (const ch of String(name)) {
    h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    out += ch === ' ' ? ' ' : GLYPHS[h % GLYPHS.length];
  }
  return out;
}
