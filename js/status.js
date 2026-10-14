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
  // weapon
  rampage: { name: 'Rampage', group: 'weapon', glyph: '▲', color: '#ff7a6b', t: 5, maxStacks: 3 },
  outlaw: { name: 'Outlaw', group: 'weapon', glyph: '↻', color: '#ffd27a', t: 6 },
  wind: { name: 'Killing Wind', group: 'weapon', glyph: '»', color: '#bfe8ff', t: 5 },
  killclip: { name: 'Kill Clip', group: 'weapon', glyph: '▲', color: '#ffd27a', t: 5 },
  feeding: { name: 'Feeding Frenzy', group: 'weapon', glyph: '↻', color: '#ffd27a', t: 3.5 },
  frenzy: { name: 'Frenzy', group: 'weapon', glyph: '▲', color: '#ff7a6b', t: Infinity },
  voltshot: { name: 'Voltshot', group: 'weapon', glyph: 'ϟ', color: '#7fd8ff', t: Infinity },
  memento: { name: 'Memento Mori', group: 'weapon', glyph: '♠', color: '#ffffff', t: Infinity, maxStacks: 99, exotic: true },
  wolves: { name: 'Release the Wolves', group: 'weapon', glyph: '◆', color: '#f4c542', t: 6, exotic: true },
  merciless: { name: 'Merciless', group: 'weapon', glyph: '◆', color: '#f4c542', t: 4, exotic: true },
  conductor: { name: 'Arc Conductor', group: 'weapon', glyph: '◆', color: '#f4c542', t: 6, exotic: true },
};

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
