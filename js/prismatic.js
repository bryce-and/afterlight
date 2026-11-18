// U27 Prismatic: Transcendence and the Prismatic subclass's behaviour in the game. The rules and numbers are in prismatic-rules.js
// (pure, tested); this module holds what runs: the meters on the Player, the activation (its own key, or grenade + melee together),
// the Prismatic grenade swap, the Facets, and the HUD. Mixed into Player by installPrismatic(Player); player.js and game.js call the
// hooks at single points (marked U27 there), the way U22's darkness.js does. Nothing here runs unless a Prismatic subclass is equipped.
//
// Elements: a Prismatic kit's own element is 'prismatic' (colour, sound). Each ability it casts acts in ITS element, so around a cast
// the kit's `element` reads as that ability's element (the cast wrapper in prismInit); a super keeps its element while it runs. Anything
// that outlives the cast (a delayed hit) reads 'prismatic', which no element-specific hook matches.
import { G } from './state.js';
import { ELEMENTS, PRISMATIC_GRENADES } from './data.js';
import { GRENADES, abilityElement } from './subclass.js';
import * as R from './prismatic-rules.js';
import { enemiesNear, explode } from './game.js';
import { castFx } from './abilities.js';
import { sfx } from './audio.js';
import * as ui from './ui.js';

const $ = (s) => document.querySelector(s);
const GREN = (id) => ({ id, ...GRENADES[id] });
/** What each Prismatic grenade is made of: [delay seconds, existing grenade id | 'implode'] in order (all existing helpers). */
const COMPOSE = {
  hailfire: [[0, 'duskfield'], [1.4, 'solar']], // slow field, then scorch
  electrified: [[0, 'shackle'], [0.9, 'pulse']], // suspend, then a jolt chain
  freezing: [[0, 'vortex'], [0.4, 'duskfield'], [2.4, 'implode']], // pull, slow, implode
};

const methods = {
  /** Called once from the Player constructor, after the kit is known. */
  prismInit() {
    this.prism = R.newTranscendence();
    this.isPrism = R.isPrismaticKit(this.cls);
    $('#prism')?.classList.toggle('hidden', !this.isPrism); // the meters are drawn only on a Prismatic subclass
    $('#prism')?.classList.remove('ready', 'active');
    this.prismQ = []; // delayed pieces of a Prismatic grenade
    this.prismChord = { g: -9, m: -9 };
    this.prismBaseGrenade = null;
    this.prismLastRefund = -9;
    if (!this.isPrism) return;
    this.elCast = null; this.elSuper = null;
    Object.defineProperty(this.cls, 'element', { get: () => this.elCast || (this.superActive ? this.elSuper : null) || 'prismatic', configurable: true, enumerable: true });
    const proto = Object.getPrototypeOf(this);
    const wrap = (name, kind, idOf) => {
      this[name] = (...a) => {
        const el = abilityElement(this.cls.id, kind, idOf());
        if (kind === 'super') {
          const had = this.superActive; const r = proto[name].apply(this, a);
          if (!had && this.superActive) this.elSuper = el;
          return r;
        }
        this.elCast = el;
        try { return proto[name].apply(this, a); } finally { this.elCast = null; }
      };
    };
    wrap('useSuper', 'super', () => this.cls.abilities.super.id);
    // the grenade + melee chord: while Transcendence is ready, the first of the two waits a moment for the second (see prismTick)
    const useG = (...a) => {
      const el = abilityElement(this.cls.id, 'grenade', this.cls.abilities.grenade.id);
      this.elCast = el;
      try { return proto.useGrenade.apply(this, a); } finally { this.elCast = null; }
    };
    const useM = (...a) => {
      const el = abilityElement(this.cls.id, 'melee', this.cls.abilities.melee.id);
      this.elCast = el;
      try { return proto.useMelee.apply(this, a); } finally { this.elCast = null; }
    };
    this.prismFire = { g: useG, m: useM };
    this.useGrenade = (...a) => { if (this.prismHoldFor('g', a)) return; useG(...a); };
    this.useMelee = (...a) => { if (this.prismHoldFor('m', a)) return; useM(...a); };
    this.prismEls = {
      root: $('#prism'), light: $('#prism .pm-bar.light i'), dark: $('#prism .pm-bar.dark i'), key: $('#prism-key'),
      tile: document.querySelector('.tbtn.k-transcend'),
    };
    this.prismEls.root?.classList.remove('hidden');
  },

  /** True when this first half of the chord is being held back (Transcendence ready); the other half within the window activates it. */
  prismHoldFor(k, args) {
    if (!R.ready(this.prism)) return false;
    const other = k === 'g' ? 'm' : 'g';
    if (G.time - this.prismChord[other] <= R.TRANSCEND.hold) { this.prismChord = { g: -9, m: -9 }; this.transcend(); return true; }
    if (this.prismChord[k] > -1) return true; // already waiting
    if (k === 'g' ? this.cd.grenade > 0 : this.cd.melee > 0) return false; // that ability could not fire anyway: let it say so
    this.prismChord[k] = G.time; this.prismChord.args = args;
    return true;
  },

  /** Per frame (player.js update): the clock, delayed grenade pieces, the held chord, the key, the HUD. */
  prismTick(dt) {
    if (!this.isPrism) return;
    const m = this.prism;
    if (G.input.pressed.KeyZ) this.transcend();
    // a held-back grenade or melee that no partner followed: fire it now
    for (const k of ['g', 'm']) {
      const at = this.prismChord[k];
      if (at > -1 && G.time - at > R.TRANSCEND.hold) { this.prismChord[k] = -9; this.prismFire[k](...(this.prismChord.args || [])); }
    }
    if (m.active && R.tick(m, dt)) this.endTranscend();
    for (let i = this.prismQ.length - 1; i >= 0; i--) if (G.time >= this.prismQ[i].at) { const q = this.prismQ.splice(i, 1)[0]; q.fn(); }
    if (!this.superActive) this.elSuper = null;
    this.prismHud();
  },

  /** Activate Transcendence (key X/Z, the TRANSCEND tile, or grenade + melee). */
  transcend() {
    if (!this.isPrism || this.dead) return false;
    if (!R.activate(this.prism, this.frag)) { if (G.input.pressed.KeyZ) sfx.denied(); return false; }
    const F = R.FACET, col = ELEMENTS.prismatic;
    sfx.superStart('prismatic');
    castFx('superStart', { p: this.pos.clone(), el: 'prismatic' });
    ui.screenFlash(col.color, 0.45);
    ui.centerMessage('Transcendent', '', 1.4);
    // the class's Prismatic grenade stands in for yours while it lasts
    this.prismBaseGrenade = this.cls.abilities.grenade;
    const pg = GRENADES[PRISMATIC_GRENADES[this.cls.id]];
    this.cls.abilities = { ...this.cls.abilities, grenade: { ...this.prismBaseGrenade, id: PRISMATIC_GRENADES[this.cls.id], ...pg, cd: this.prismBaseGrenade.cd } };
    this.cd.grenade = 0;
    this.status.apply('transcendent', { t: this.prism.t, set: true });
    if (this.frag.has('mending')) this.healPct(F.mendingHeal);
    if (this.frag.has('protection')) this.addOvershield(F.protectionOver, this.prism.t);
    if (this.frag.has('generosity')) { this.giveEnergy('grenade', F.generosityRefund); this.giveEnergy('melee', F.generosityRefund); }
    return true;
  },
  endTranscend() {
    if (this.prismBaseGrenade) { this.cls.abilities = { ...this.cls.abilities, grenade: this.prismBaseGrenade }; this.prismBaseGrenade = null; }
    this.status.remove('transcendent');
  },

  // ---- hooks ----
  /** A hit from a grenade: an ability hit inside the window after a throw. */
  prismFromGrenade(o) { return o.source === 'ability' && G.time < this.grenadeWin; },
  /** game.js dealDamage, for this player's own hits (never relayed ones): fills the meters, and the melee/grenade refund. */
  prismFill(o, dmg) {
    if (!this.isPrism || o.remoteHit || o.jolted || o.companion) return;
    const m = this.prism;
    R.fillMeters(m, o.element, dmg, o.source, this.frag.has('balance') ? R.FACET.balance : 1);
    if (m.active && G.time - this.prismLastRefund > 0.25) {
      if (o.source === 'melee') { this.giveEnergy('grenade', R.TRANSCEND.refund); this.prismLastRefund = G.time; }
      else if (this.prismFromGrenade(o)) { this.giveEnergy('melee', R.TRANSCEND.refund); this.prismLastRefund = G.time; }
    }
  },
  /** game.js dealDamage: weapon damage while Transcendent. */
  prismMult(o) {
    if (!this.isPrism || !(o.source === 'weapon' || o.source === 'perk')) return 1;
    return R.weaponMult(this.prism, this.frag);
  },
  /** takeDamage: resistance against combatants only. */
  prismIncoming(from) {
    return this.isPrism ? R.incomingMult(this.prism, !!(from && (from.pvp || from.isPlayer || from.human))) : 1;
  },
  /** updateAbilities: ability recharge speed while Transcendent. */
  prismRegen(k) { return this.isPrism ? R.regenMult(this.prism, k, this.frag) : 1; },
  /** onKill: Transcendence extends; Facets. */
  prismOnKill(e, o) {
    if (!this.isPrism) return;
    const m = this.prism, F = R.FACET;
    if (m.active) { R.extend(m, this.frag); this.status.apply('transcendent', { t: m.t, set: true }); }
    if (o.jolted || o.companion) return;
    if (this.frag.has('devotion') && o.weapon) this.restore(2);
    if (this.frag.has('courage') && o.source === 'melee') this.status.apply('radiant', { set: true });
    if (this.frag.has('sacrifice') && (o.source === 'melee' || this.prismFromGrenade(o)) && !this.superActive) this.superCharge = Math.min(100, this.superCharge + F.sacrificeSuper);
    if (this.frag.has('purpose') && (o.source === 'ability' || o.source === 'melee')) R.fillBoth(m, F.purposeFill);
  },

  // ---- the Prismatic grenades: pieces of existing grenades, in order ----
  isTranscendGrenade(g) { return !!g?.transcend; },
  prismGrenade(g, pt, hitEnemy) {
    const parts = COMPOSE[g.kind];
    if (!parts) throw new Error(`prismGrenade: no recipe for ${g.kind}`);
    const at = pt.clone();
    for (const [delay, id] of parts) {
      const run = () => {
        if (id === 'implode') {
          castFx('blast', { p: at.clone(), el: 'stasis', r: 5.5 });
          explode(at.clone(), 5.5, 260, 'stasis', { source: 'ability' });
        } else this.detonateGrenade(GREN(id), at.clone(), hitEnemy);
      };
      if (delay <= 0) run(); else this.prismQ.push({ at: G.time + delay, fn: run });
    }
  },

  // ---- HUD (DOM, only while Prismatic is equipped) ----
  prismHud() {
    const E = this.prismEls, m = this.prism;
    if (!E?.root) return;
    if (E.light) E.light.style.width = `${(m.active ? m.t / R.TRANSCEND.cap : m.light / R.TRANSCEND.full) * 100}%`;
    if (E.dark) E.dark.style.width = `${(m.active ? m.t / R.TRANSCEND.cap : m.dark / R.TRANSCEND.full) * 100}%`;
    const ready = R.ready(m);
    E.root.classList.toggle('ready', ready);
    E.root.classList.toggle('active', m.active);
    E.tile?.classList.toggle('ready', ready);
  },
  /** Called when the Player is torn down or the kit changes: hide the meters. */
  prismHide() { $('#prism')?.classList.add('hidden'); document.querySelector('.tbtn.k-transcend')?.classList.remove('ready'); },
};

export function installPrismatic(Player) {
  for (const [k, f] of Object.entries(methods)) {
    if (k in Player.prototype) throw new Error(`installPrismatic: Player already has ${k}`);
    Player.prototype[k] = f;
  }
}
export const _prism = { COMPOSE };
