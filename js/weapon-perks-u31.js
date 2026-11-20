// U31: the thirty new weapon perks (definitions in data.js PERKS). Player calls: perkMult (per hit, with the target),
// perkDeal (extra dealDamage options), perkHit (after a hit lands), perkKill (on a kill), perkReloaded.
import * as THREE from 'three';
import { G } from './state.js';
import { dealDamage, explode, enemiesNear } from './game.js';
import { raiseCrystal } from './darkness.js';
import { roundsDeal, roundsTick } from './boon-run.js';

export const PK31 = {
  lastround: 1.5, ambush: 1.3, closer: { r: 10, m: 1.25 }, longshot: { r: 30, m: 1.25 }, focus: { step: 0.04, max: 5, window: 2 },
  finishing: { hp: 0.3, m: 1.4 }, hipfire: 1.2, anchored: { t: 1, m: 1.25 }, echo: { kills: 3, window: 4, t: 6, m: 1.3 }, hotstart: { t: 5, m: 1.15 },
  healer: 2, shield: { n: 15, max: 60 }, tenderize: { every: 6, t: 4 },
  permafrost: 1.2, winterbite: { every: 5 }, frostburst: { r: 5, stacks: 2 }, glacial: 25, coldfront: { r: 4, gap: 0.5 }, brittle: 2,
  tangle: { every: 4 }, spindle: { r: 4, dmg: 220 }, frayed: 1.25, taut: 1.4, silk: 0.25,
};

const v3 = () => new THREE.Vector3();
const frozen = (e) => e.status.has('frozen'), slowed = (e) => e.status.has('slow') || e.status.has('frozen');
const severed = (e) => e.status.has('sever') || e.status.has('unravel');

export const weaponPerkMethods = {
  /** Damage multiplier from target-aware perks. Called for every weapon hit (not supers). */
  perkMult(w, e, crit) {
    let m = 1;
    if (w.has('lastround') && w.ammo <= 0) m *= PK31.lastround;
    if (w.has('ambush') && !(e.perkSeen && e.perkSeen[w.idx])) m *= PK31.ambush;
    const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
    if (w.has('closer') && d < PK31.closer.r) m *= PK31.closer.m;
    if (w.has('longshot') && d > PK31.longshot.r) m *= PK31.longshot.m;
    if (w.has('focusfire') && e.focus && e.focus.idx === w.idx && G.time - e.focus.t < PK31.focus.window) m *= 1 + PK31.focus.step * Math.min(PK31.focus.max, e.focus.n);
    if (w.has('finishing') && e.hp / e.maxHp < PK31.finishing.hp) m *= PK31.finishing.m;
    if (w.has('hipfire') && this.adsT < 0.3) m *= PK31.hipfire;
    if (w.has('anchored') && (this.perkStill || 0) >= PK31.anchored.t) m *= PK31.anchored.m;
    if (w.has('echochamber') && G.time < (this.echoT || 0)) m *= PK31.echo.m;
    if (w.has('hotstart') && G.time < (w.hotT || 0)) m *= PK31.hotstart.m;
    if (w.has('permafrost') && slowed(e)) m *= PK31.permafrost;
    if (w.has('frayed') && e.status.has('sever')) m *= PK31.frayed;
    if (w.has('tautline') && e.status.has('suspend')) m *= PK31.taut;
    return m;
  },

  /** Extra dealDamage options (Stasis slow and freeze, Strand unravel, sever, suspend, weaken). */
  perkDeal(w, e, crit) {
    const o = {};
    const n = (w.pkHits = (w.pkHits || 0) + 1);
    if (w.has('unravelrounds') && crit) o.unravel = 3;
    if (w.has('severing') && e.status.has('unravel')) o.sever = 3;
    if (w.has('tangle') && n % PK31.tangle.every === 0) o.suspend = this.suspendMult();
    if (w.has('winterbite') && n % PK31.winterbite.every === 0) o.freeze = this.freezeMult();
    if (w.has('brittle') && crit && e.status.has('slow')) { o.slowAdd = PK31.brittle; o.freezeMult = this.freezeMult(); }
    if (w.has('tenderize') && n % PK31.tenderize.every === 0) o.weaken = PK31.tenderize.t;
    const r = roundsDeal(w, e, crit); // U31 boons: Cryo, Burning, Toxic, Static, Devouring and Threadneedle Rounds
    if (r) { if (r.slowAdd && o.slowAdd) r.slowAdd += o.slowAdd; Object.assign(o, r, r.slowAdd ? { slowAdd: r.slowAdd } : null); }
    return Object.keys(o).length ? o : null;
  },

  /** After a weapon hit lands. */
  perkHit(w, e, crit) {
    if (w.has('ambush')) (e.perkSeen ||= {})[w.idx] = true;
    if (w.has('focusfire')) { const f = e.focus; e.focus = f && f.idx === w.idx && G.time - f.t < PK31.focus.window ? { idx: w.idx, n: f.n + 1, t: G.time } : { idx: w.idx, n: 1, t: G.time }; }
    if (w.has('healer')) this.heal(PK31.healer);
    if (w.has('coldfront') && crit && G.time >= (this.coldT || 0)) {
      this.coldT = G.time + PK31.coldfront.gap; const c = e.center(v3());
      for (const x of enemiesNear(c, PK31.coldfront.r, 8, e)) dealDamage(x, 4, { ...this.stasisO(1), source: 'ability', pos: x.center(v3()), jolted: true });
    }
  },

  /** A weapon kill. */
  perkKill(w, e, crit) {
    const c = e.center(v3());
    if (w.has('ammoreturn') && crit) w.ammo = Math.min(w.mag, w.ammo + 1);
    if (w.has('shieldrounds')) { this.over = Math.min(PK31.shield.max, this.over + PK31.shield.n); this.status.apply('overshield', { t: 6, set: true }); }
    if (w.has('glacialguard') && frozen(e)) { this.over = Math.max(this.over, PK31.glacial); this.status.apply('overshield', { t: 6, set: true }); }
    if (w.has('coldreload') && frozen(e)) this.instantReload(w);
    if (w.has('frostburst') && slowed(e)) for (const x of enemiesNear(c, PK31.frostburst.r, 8, e)) dealDamage(x, 6, { ...this.stasisO(PK31.frostburst.stacks), source: 'ability', pos: x.center(v3()), jolted: true });
    if (w.has('crystalline') && slowed(e)) raiseCrystal(e.pos.clone(), 0.9);
    if (w.has('weaver')) this.threadlings(c, 1);
    if (w.has('spindle') && severed(e)) explode(c, PK31.spindle.r, PK31.spindle.dmg, 'strand', { source: 'perk', jolted: true });
    if (w.has('silkreload') && e.status.has('suspend')) w.ammo = Math.min(w.mag, w.ammo + Math.ceil(w.mag * PK31.silk));
    if (w.has('echochamber')) {
      this.echoKills = (this.echoKills || []).filter((t) => G.time - t < PK31.echo.window); this.echoKills.push(G.time);
      if (this.echoKills.length >= PK31.echo.kills) { this.echoKills = []; this.echoT = G.time + PK31.echo.t; }
    }
  },

  perkReloaded(w) { if (w.has('hotstart')) w.hotT = G.time + PK31.hotstart.t; },

  /** Per frame: how long the Guardian has stood still (Anchored). */
  perkTick(dt) {
    roundsTick(); // U31: Burning and Toxic Rounds damage over time
    this.perkStill = Math.hypot(this.vel.x, this.vel.z) < 0.3 && this.onGround ? (this.perkStill || 0) + dt : 0; },
};
