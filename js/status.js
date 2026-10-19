// Status-effect registry: every timed effect the player can see lives here, so the buff HUD
// (and later aspects, fragments, mods and boons) read one source. Pure logic, no Three.js.
//
// group 'general' shows above the abilities, 'weapon' below them. Weapon effects are scoped
// to a weapon slot index so two weapons with the same perk keep separate timers.
// t: default duration in seconds (Infinity = until removed). maxStacks: cap for apply({ add }).
export const STATUS = {
  // general
  empower: { name: 'Empowered', group: 'general', glyph: '✦', color: '#5fd3ff' },
  rift: { name: 'Healing Rift', group: 'general', glyph: '✚', color: '#b07cff' },
  restoration: { name: 'Restoration', group: 'general', glyph: '✚', color: '#ffb547' },
  overshield: { name: 'Overshield', group: 'general', glyph: '⬢', color: '#c9a6ff' },
  invisible: { name: 'Invisible', group: 'general', glyph: '◌', color: '#9b7cff' },
  lethal: { name: 'Lethal Current', group: 'general', glyph: 'ϟ', color: '#7fd8ff' },
  nezarec: { name: "Nezarec's Sin", group: 'general', glyph: '◆', color: '#f4c542', exotic: true },
  contraverse: { name: 'Contraverse Hold', group: 'general', glyph: '◆', color: '#f4c542', exotic: true },
  heart: { name: 'Inmost Light', group: 'general', glyph: '◆', color: '#f4c542', exotic: true },
  dunemarchers: { name: 'Static Charge', group: 'general', glyph: '◆', color: '#f4c542', exotic: true, t: Infinity },
  nighthawk: { name: 'Celestial Nighthawk', group: 'general', glyph: '◆', color: '#f4c542', exotic: true, t: Infinity },
  quietone: { name: 'Mask of the Quiet One', group: 'general', glyph: '◆', color: '#f4c542', exotic: true },
  hallowfire: { name: 'Hallowfire Heart', group: 'general', glyph: '◆', color: '#f4c542', exotic: true, t: Infinity },
  direahamkara: { name: 'Dire Promise', group: 'general', glyph: '◆', color: '#f4c542', exotic: true },
  sunbracers: { name: 'Helium Spirals', group: 'general', glyph: '◆', color: '#f4c542', exotic: true },
  stormdancer: { name: "Stormdancer's Brace", group: 'general', glyph: '◆', color: '#f4c542', exotic: true, t: Infinity, maxStacks: 5 },
  lunafaction: { name: 'Lunafaction Rift', group: 'general', glyph: '◆', color: '#f4c542', exotic: true },
  // aspects and fragments (Paths of Light)
  sunspot: { name: 'Sunspot', group: 'general', glyph: '☀', color: '#ffb547' },
  roaring: { name: 'Roaring Flames', group: 'general', glyph: '▲', color: '#ff8b2b', t: 10, maxStacks: 3 },
  knockout: { name: 'Knockout', group: 'general', glyph: '✊', color: '#5fd3ff', t: 5 },
  juggernaut: { name: 'Juggernaut', group: 'general', glyph: '⬢', color: '#5fd3ff', t: Infinity },
  rally: { name: 'Rally', group: 'general', glyph: '↻', color: '#ffb36b', t: 6 },
  onyourmark: { name: 'On Your Mark', group: 'general', glyph: '↻', color: '#ffb547', t: 6, maxStacks: 3 },
  fragout: { name: 'Frag Out', group: 'general', glyph: '✹', color: '#ffd27a', t: Infinity },
  gunpowder: { name: 'Gunpowder Gamble', group: 'general', glyph: '✹', color: '#ffb547', t: Infinity },
  flowstate: { name: 'Flow State', group: 'general', glyph: '»', color: '#5fd3ff', t: 6 },
  devour: { name: 'Devour', group: 'general', glyph: '◉', color: '#b07cff', t: 8 },
  radiant: { name: 'Radiant', group: 'general', glyph: '✦', color: '#ffb547', t: 6 },
  frequency: { name: 'Frequency', group: 'general', glyph: '↻', color: '#5fd3ff', t: 5 },
  amplified: { name: 'Amplified', group: 'general', glyph: 'ϟ', color: '#5fd3ff', t: 6 }, // Amplitude and Fast Twitch
  // Light Ascendant
  tempered: { name: 'Tempered Metal', group: 'general', glyph: '»', color: '#ff8b2b', t: 6 },
  unbreakable: { name: 'Unbreakable', group: 'general', glyph: '⬢', color: '#b07cff', t: 2 },
  wol: { name: 'Weapons of Light', group: 'general', glyph: '✦', color: '#b07cff', t: 0.3 },
  well: { name: 'Well of Radiance', group: 'general', glyph: '✚', color: '#ffb547', t: 0.3 },
  // H3: how long your cast rift or barricade lasts
  riftup: { name: 'Rift', group: 'general', glyph: '◎', color: '#cdb6ff' },
  barricadeup: { name: 'Barricade', group: 'general', glyph: '▮', color: '#ffb36b' },
  voidaxe: { name: 'Void Axe (click to throw)', group: 'general', glyph: '⚒', color: '#b07cff', t: 10 },
  // armor mods (Armor 2.0)
  charge: { name: 'Armor Charge', group: 'general', glyph: '◈', color: '#cdb6ff', t: 10, maxStacks: 9 },
  emergency: { name: 'Emergency Reinforcement', group: 'general', glyph: '⬢', color: '#9fd0ff', t: 4 },
  // armor set bonuses (Fashion Is Endgame)
  crosscounter: { name: 'Cross Counter', group: 'general', glyph: '◆', color: '#f4c542', exotic: true, t: 5 },
  outlawsedge: { name: "Outlaw's Edge", group: 'general', glyph: '✦', color: '#e2b55a', t: 6 },
  // one-off procs: a short flash in the buff HUD instead of a line in the top-right feed
  meleeready: { name: 'Melee Ready', group: 'general', glyph: '✊', color: '#5fd3ff', t: 1.5 },
  combo: { name: 'Combination Blow', group: 'general', glyph: '✚', color: '#5fd3ff', t: 1.5 },
  hammer: { name: 'Hammer Recovered', group: 'general', glyph: '⚒', color: '#ffb547', t: 1.5 },
  reloaded: { name: 'Weapons Reloaded', group: 'general', glyph: '↻', color: '#ffb36b', t: 1.5 },
  skullfort: { name: 'Skullfort', group: 'general', glyph: '◆', color: '#f4c542', t: 1.5, exotic: true },
  volatile: { name: 'Volatile Rounds', group: 'weapon', glyph: '✹', color: '#b07cff', t: 6 },
  // weapon
  rampage: { name: 'Rampage', group: 'weapon', glyph: '▲', color: '#ff7a6b', t: 5, maxStacks: 3 },
  outlaw: { name: 'Outlaw', group: 'weapon', glyph: '↻', color: '#ffd27a', t: 6 },
  wind: { name: 'Killing Wind', group: 'weapon', glyph: '»', color: '#bfe8ff', t: 5 },
  killclip: { name: 'Kill Clip', group: 'weapon', glyph: '▲', color: '#ffd27a', t: 5 },
  feeding: { name: 'Feeding Frenzy', group: 'weapon', glyph: '↻', color: '#ffd27a', t: 3.5 },
  frenzy: { name: 'Frenzy', group: 'weapon', glyph: '▲', color: '#ff7a6b', t: Infinity },
  voltshot: { name: 'Voltshot', group: 'weapon', glyph: 'ϟ', color: '#7fd8ff', t: Infinity },
  // Loot 2.0 perks
  rapidhit: { name: 'Rapid Hit', group: 'weapon', glyph: '↻', color: '#ffd27a', t: 2, maxStacks: 5 },
  adrenaline: { name: 'Adrenaline Junkie', group: 'weapon', glyph: '▲', color: '#ff7a6b', t: 4.5, maxStacks: 5 },
  oneforall: { name: 'One for All', group: 'weapon', glyph: '▲', color: '#ff7a6b', t: 10 },
  baitswitch: { name: 'Bait and Switch', group: 'weapon', glyph: '▲', color: '#ff7a6b', t: 10 },
  memento: { name: 'Memento Mori', group: 'weapon', glyph: '♠', color: '#ffffff', t: Infinity, maxStacks: 99, exotic: true },
  wolves: { name: 'Release the Wolves', group: 'weapon', glyph: '◆', color: '#f4c542', t: 6, exotic: true },
  merciless: { name: 'Merciless', group: 'weapon', glyph: '◆', color: '#f4c542', t: 4, exotic: true },
  supercharged: { name: 'Max Power', group: 'weapon', glyph: '◆', color: '#b07cff', t: 6, exotic: true },
  conductor: { name: 'Arc Conductor', group: 'weapon', glyph: '◆', color: '#f4c542', t: 6, exotic: true },
  // weapon procs (short flash)
  whitenail: { name: 'White Nail', group: 'weapon', glyph: '◆', color: '#f4c542', t: 1.5, exotic: true },
  truth: { name: "Hunter's Trace", group: 'weapon', glyph: '◆', color: '#f4c542', t: 1.5, exotic: true },
  hardlight: { name: 'Hard Light', group: 'weapon', glyph: '◆', color: '#f4c542', t: 1.5, exotic: true },
  honed: { name: 'Honed Edge', group: 'weapon', glyph: '◆', color: '#f4c542', t: 1.5, maxStacks: 99, exotic: true },
};

// Debuffs on enemies. Applied through dealDamage by whoever owns the enemy; the plate shows them.
// weaken: +30% damage taken. slow: 35% speed. suppress: cannot attack. burn/poison: marks a
// damage-over-time (the ticks come from the attacker). jolt: the next hits arc into nearby enemies.
export const ENEMY_STATUS = {
  weaken: { name: 'Weakened', glyph: '▼', color: '#b07cff' },
  slow: { name: 'Slowed', glyph: '≈', color: '#9fb4ff' },
  suppress: { name: 'Suppressed', glyph: '⊘', color: '#c9a6ff' },
  burn: { name: 'Scorched', glyph: '♨', color: '#ff8b2b' },
  corrosive: { name: 'Corrosive', glyph: '⬣', color: '#c8d84a' }, // Witherhoard only: a round stuck to the target, or standing in its pool
  poison: { name: 'Poisoned', glyph: '☣', color: '#6dff8e' },
  jolt: { name: 'Jolted', glyph: 'ϟ', color: '#5fd3ff' },
  judged: { name: 'Judged', glyph: '◈', color: '#ffd27a' }, // Divinity: weapon hits on the bubble are precision hits
  blind: { name: 'Blinded', glyph: '◌', color: '#e6d0ff' }, // U9: Sentinel Shield barrier; cannot attack
};
export const WEAKEN_MULT = 1.3;
export const SLOW_MULT = 0.35;

const keyOf = (id, scope) => (scope == null ? id : `${id}@${scope}`);

export class StatusSet {
  constructor(defs = STATUS) { this.defs = defs; this.map = new Map(); }

  /**
   * Start or refresh an effect. The timer only ever grows (a shorter re-apply never cuts it),
   * unless set is true. stacks sets the count, add raises it up to maxStacks.
   */
  apply(id, { t, scope = null, stacks, add, set = false, value } = {}) {
    const def = this.defs[id];
    if (!def) throw new Error(`Unknown status effect "${id}"`);
    const k = keyOf(id, scope);
    let s = this.map.get(k);
    if (!s) { s = { id, scope, def, t: 0, max: 0, stacks: 0, value: undefined }; this.map.set(k, s); }
    const dur = t ?? def.t ?? Infinity;
    if (set || dur > s.t) { s.t = dur; s.max = dur; }
    if (add) s.stacks = Math.min(def.maxStacks ?? 1, s.stacks + add);
    else if (stacks != null) s.stacks = Math.min(def.maxStacks ?? stacks, stacks);
    else s.stacks = Math.max(1, s.stacks);
    if (value !== undefined) s.value = value;
    return s;
  }

  get(id, scope = null) { return this.map.get(keyOf(id, scope)) ?? null; }
  has(id, scope = null) { return this.map.has(keyOf(id, scope)); }
  remaining(id, scope = null) { return this.get(id, scope)?.t ?? 0; }
  stacks(id, scope = null) { return this.get(id, scope)?.stacks ?? 0; }
  remove(id, scope = null) { this.map.delete(keyOf(id, scope)); }

  /** Spend n stacks; the effect ends at zero. Returns the stacks left. */
  consume(id, scope = null, n = 1) {
    const s = this.get(id, scope);
    if (!s) return 0;
    s.stacks -= n;
    if (s.stacks <= 0) { this.remove(id, scope); return 0; }
    return s.stacks;
  }

  /** Drop every effect bound to a scope (a weapon slot that was swapped). */
  clearScope(scope) { for (const [k, s] of this.map) if (s.scope === scope) this.map.delete(k); }
  clear() { this.map.clear(); }

  tick(dt) {
    for (const [k, s] of this.map) {
      if (s.t === Infinity) continue;
      s.t -= dt;
      if (s.t <= 0) this.map.delete(k);
    }
  }

  /** Active effects, optionally for one HUD group, in the order they were first applied. */
  list(group = null) { return [...this.map.values()].filter((s) => !group || s.def.group === group); }
}
