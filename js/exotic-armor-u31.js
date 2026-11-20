// U31 exotic armor: fifteen new pieces and seven reworks (the ones that only gave a % of ability energy now do something).
// Each perk is keyed by the id in EXOTIC_ARMOR_PERKS (data.js). Player calls these hooks: exoKill, exoHit, exoIncoming, exoUse, exoTick.
// All numbers live in EXO31 so tests and tuning have one place.
import * as THREE from 'three';
import { G } from './state.js';
import { dealDamage, explode, enemiesNear } from './game.js';
import { sparks } from './effects.js';

export const EXO31 = {
  heart: { charges: 3, dmg: 700, r: 8 }, // Heart of Inmost Light: three ability uses, then a Light nova
  hallowfire: { r: 6, dmg: 90, gap: 0.5 }, // Hallowfire Heart: Sunheart aura while the super is full
  ahamkara: { delay: 1.4, dmg: 420, r: 4, gap: 0.5 }, // Young Ahamkara's Spine: a wish spike lands where a grenade hit
  contraverse: { over: 35, weak: 4 }, // Contraverse Hold: void grenade blasts weaken what they catch and give an overshield
  starfire: { n: 3, dmg: 380, r: 12 }, // Starfire Protocol: solar grenade kills fire Fusion Bolts at others
  nezarec: { dmg: 320, r: 4.5, over: 20, maxOver: 60 }, // Nezarec's Sin: void ability kills burst and feed the overshield
  quietone: { dmg: 300, r: 6, gap: 3 }, // Mask of the Quiet One: damage taken answers with a void pulse
  doomfang: { dmg: 240, r: 1.8, gap: 0.55 }, // Doom Fang Pauldron: sprint into enemies
  burningsteps: { life: 3.2, dmg: 70, r: 2.2, every: 0.4, tick: 0.5 }, // Path of Burning Steps: fire trail
  actium: { over: 6, max: 60 }, // Actium War Rig: auto rifle and machine gun kills stack overshield
  loreley: { hp: 0.35, over: 40, t: 6, cd: 25 }, // Loreley Splendor Helm: Sunspot below 35% health
  scars: { heal: 8, cap: 40, gap: 0.25 }, // Precious Scars: ability hits heal a flat amount
  bakris: { still: 1.5, t: 3, cd: 9 }, // Mask of Bakris: stand still, vanish
  cowl: { heal: 25, t: 1.5, cd: 6 }, // Assassin's Cowl: kills heal and cloak
  dragonshadow: { t: 3 }, // Dragon's Shadow: dodging reloads everything and speeds you up
  gyrfalcon: { over: 40 }, // Gyrfalcon's Hauberk: kills while invisible give an overshield
  tricksleeves: { dmg: 1.5 }, // Mechaneer's Tricksleeves: sidearms hit 50% harder and reload on swap
  verity: { window: 6, over: 60 }, // Verity's Brow: grenade, melee and weapon kills together
  crown: { dmg: 260, n: 3, r: 10 }, // Crown of Tempests: Arc ability kills arc to others
  phoenixcradle: { life: 4, dmg: 85, r: 3.2, tick: 0.5 }, // Phoenix Cradle: solar grenades leave a burning pool
  karnstein: { heal: 40, gap: 0.4 }, // Karnstein Armlets: melee hits heal a flat amount
  vesper: { dmg: 400, r: 8, over: 40 }, // Vesper of Radius: placing a rift detonates it
};

const v3 = () => new THREE.Vector3();
const center = (e) => e.center(v3());
const zap = (p, e, dmg, element, source = 'ability') => dealDamage(e, dmg, { element, source, pos: center(e), jolted: true });
const near = (p, r) => enemiesNear(p, r);

export const exoArmorMethods = {
  /** The pool of fire patches (Path of Burning Steps, Phoenix Cradle) and delayed spikes (Young Ahamkara's Spine). */
  exoZone(z) { (this.exoZones ||= []).push({ tickT: 0, ...z }); },

  /** Every kill. `chain` kills (from our own splash) do not trigger more. */
  exoKill(e, o, chain) {
    const x = this.exo; if (!x.size || chain || o.jolted) return;
    const w = this.weapon, src = o.source;
    const el = o.element;
    if (x.has('nezarec') && src === 'ability' && el === 'void') { // Nezarec's Sin
      const c = EXO31.nezarec; explode(center(e), c.r, c.dmg, 'void', { source: 'ability', jolted: true });
      this.over = Math.min(c.maxOver, this.over + c.over); this.status.apply('overshield', { t: 6, set: true });
    }
    if (x.has('starfire') && src === 'ability' && el === 'solar' && G.time < this.grenadeWin) { // Starfire Protocol
      const c = EXO31.starfire;
      for (const t of near(this.pos, c.r).filter((q) => q !== e).slice(0, c.n)) { zap(null, t, c.dmg, 'solar'); sparks(center(t), 0xffb347, 10, 6, 0.06, 0.4); }
    }
    if (x.has('crown') && src === 'ability' && el === 'arc') { // Crown of Tempests
      const c = EXO31.crown; for (const t of near(center(e), c.r).filter((q) => q !== e).slice(0, c.n)) zap(null, t, c.dmg, 'arc');
    }
    if (x.has('actium') && src === 'weapon' && (w.A.id === 'auto' || w.A.id === 'mg' || w.A.id === 'xenophage')) { // Actium War Rig
      this.over = Math.min(EXO31.actium.max, this.over + EXO31.actium.over); if (this.over > 0) this.status.apply('overshield', { t: 6, set: true });
    }
    if (x.has('gyrfalcon') && this.status.has('invisible')) { this.over = Math.max(this.over, EXO31.gyrfalcon.over); this.status.apply('overshield', { t: 8, set: true }); } // Gyrfalcon's Hauberk
    if (x.has('cowl') && G.time >= (this.cowlT || 0)) { // Assassin's Cowl
      this.cowlT = G.time + EXO31.cowl.cd; this.heal(EXO31.cowl.heal); this.goInvisible(EXO31.cowl.t, true);
    }
    if (x.has('verity')) { // Verity's Brow: a weapon, a grenade and a melee kill within the window
      const k = src === 'weapon' ? 'weapon' : this.meleeT > 0 || src === 'melee' ? 'melee' : src === 'ability' ? 'grenade' : null;
      if (k) {
        const v = (this.verity ||= {}); v[k] = G.time + EXO31.verity.window;
        if (v.weapon > G.time && v.grenade > G.time && v.melee > G.time) {
          this.verity = {}; this.healPct(1); this.over = Math.max(this.over, EXO31.verity.over); this.status.apply('overshield', { t: 8, set: true });
          for (const wp of this.weapons) this.instantReload(wp);
        }
      }
    }
  },

  /** Every hit that lands (called with the damage options and the target). */
  exoHit(o, e) {
    const x = this.exo; if (!x.size || o.jolted) return;
    const ab = o.source === 'ability' || o.source === 'melee';
    if (x.has('ahamkara') && o.source === 'ability' && G.time < this.grenadeWin && this.meleeT <= 0 && G.time - (this.ahamAt || 0) >= EXO31.ahamkara.gap) { // Young Ahamkara's Spine
      this.ahamAt = G.time; this.exoZone({ kind: 'spike', t: EXO31.ahamkara.delay, pos: center(e) });
    }
    if (x.has('scars') && ab && G.time - (this.scarsAt || 0) >= EXO31.scars.gap) { // Precious Scars
      this.scarsAt = G.time; this.scarsHeal = (this.scarsHeal || 0);
      if (G.time > (this.scarsReset || 0)) { this.scarsHeal = 0; this.scarsReset = G.time + 4; }
      if (this.scarsHeal < EXO31.scars.cap) { this.scarsHeal += EXO31.scars.heal; this.heal(EXO31.scars.heal); }
    }
    if (x.has('karnstein') && o.source === 'melee' && G.time - (this.karnAt || 0) >= EXO31.karnstein.gap) { this.karnAt = G.time; this.heal(EXO31.karnstein.heal); } // Karnstein Armlets
  },

  /** Damage multiplier for the weapon in hand (game.js outgoing). */
  exoOutgoing(o) {
    if (!this.exo.has('tricksleeves') || o.source !== 'weapon') return 1;
    const a = this.weapon?.A.id; return a === 'sidearm' || a === 'forerunner' ? EXO31.tricksleeves.dmg : 1; // Mechaneer's Tricksleeves
  },

  /** Damage about to be taken; returns the amount. */
  exoIncoming(amount, from) {
    const x = this.exo; if (!x.size) return amount;
    if (x.has('quietone') && G.time >= (this.quietPulseT || 0)) { // Mask of the Quiet One: Eye for an Eye
      this.quietPulseT = G.time + EXO31.quietone.gap;
      for (const t of near(this.pos, EXO31.quietone.r)) zap(null, t, EXO31.quietone.dmg, 'void');
      sparks(this.pos.clone().setY(1), 0xb07cff, 24, 7, 0.08, 0.5);
    }
    if (x.has('loreley') && this.health - amount <= this.maxHealth * EXO31.loreley.hp && G.time >= (this.loreleyT || 0)) { // Loreley Splendor Helm: Sunspot
      this.loreleyT = G.time + EXO31.loreley.cd; this.over = Math.max(this.over, EXO31.loreley.over);
      this.status.apply('overshield', { t: EXO31.loreley.t, set: true }); this.status.apply('restoration', { t: EXO31.loreley.t, set: true });
    }
    return amount;
  },

  /** An ability was used: kind is 'grenade', 'melee' or 'class'. */
  exoUse(kind, g) {
    const x = this.exo; if (!x.size) return;
    if (x.has('heart')) { // Heart of Inmost Light: three uses charge a Light nova
      this.heartN = (this.heartN || 0) + 1;
      this.status.apply('lightcharge', { add: 1, set: true });
      if (this.heartN >= EXO31.heart.charges) {
        this.heartN = 0; this.status.remove('lightcharge');
        explode(this.pos.clone().setY(this.pos.y + 0.5), EXO31.heart.r, EXO31.heart.dmg, this.cls.element, { source: 'ability', jolted: true });
        sparks(this.pos.clone().setY(1), 0xf4c542, 40, 9, 0.1, 0.7);
      }
    }
    if (x.has('dragonshadow') && kind === 'class' && this.cls.id === 'stalker') { // Dragon's Shadow
      for (const w of this.weapons) this.instantReload(w); this.status.apply('wind', { t: EXO31.dragonshadow.t, set: true });
    }
    if (x.has('vesper') && kind === 'class' && this.cls.id === 'arcanist') { // Vesper of Radius
      const c = EXO31.vesper; explode(this.pos.clone().setY(this.pos.y + 0.5), c.r, c.dmg, this.cls.element, { source: 'ability', jolted: true });
      this.over = Math.max(this.over, c.over); this.status.apply('overshield', { t: 8, set: true });
    }
  },

  /** A grenade of element `el` went off at pt (called from detonateGrenade). */
  exoGrenade(g, pt) {
    const x = this.exo; if (!x.size) return;
    if (x.has('contraverse') && g.element === 'void') { // Contraverse Hold: weaken what it catches, shield yourself
      const hit = near(pt, 6); if (hit.length) { for (const t of hit) t.status.apply('weaken', { t: EXO31.contraverse.weak }); this.over = Math.max(this.over, EXO31.contraverse.over); this.status.apply('overshield', { t: 6, set: true }); }
    }
    if (x.has('phoenixcradle') && g.element === 'solar') this.exoZone({ kind: 'fire', t: EXO31.phoenixcradle.life, pos: pt.clone(), r: EXO31.phoenixcradle.r, dmg: EXO31.phoenixcradle.dmg, tick: EXO31.phoenixcradle.tick });
  },

  /** Per frame. */
  exoTick(dt) {
    const x = this.exo; if (!x.size) return;
    const hp = this.pos;
    if (x.has('hallowfire') && !this.superActive && this.superCharge >= 100) { // Hallowfire Heart: Sunheart aura
      this.sunT = (this.sunT || 0) - dt;
      if (this.sunT <= 0) { this.sunT = EXO31.hallowfire.gap; for (const t of near(hp, EXO31.hallowfire.r)) zap(null, t, EXO31.hallowfire.dmg, 'solar'); sparks(hp.clone().setY(0.4), 0xffb347, 5, 3, 0.05, 0.4); }
    }
    if (x.has('doomfang') && this.sprinting && G.time >= (this.doomT || 0)) { // Doom Fang Pauldron
      const hit = near(hp, EXO31.doomfang.r);
      if (hit.length) { this.doomT = G.time + EXO31.doomfang.gap; for (const t of hit.slice(0, 4)) zap(null, t, EXO31.doomfang.dmg, 'arc', 'melee'); sparks(hp.clone().setY(1), 0x5fd3ff, 12, 6, 0.06, 0.3); }
    }
    if (x.has('burningsteps') && this.sprinting) { // Path of Burning Steps
      this.trailT = (this.trailT || 0) - dt;
      if (this.trailT <= 0) { this.trailT = EXO31.burningsteps.every; this.exoZone({ kind: 'fire', t: EXO31.burningsteps.life, pos: hp.clone(), r: EXO31.burningsteps.r, dmg: EXO31.burningsteps.dmg, tick: EXO31.burningsteps.tick }); }
    }
    if (x.has('bakris')) { // Mask of Bakris: standing still hides you
      const still = Math.hypot(this.vel.x, this.vel.z) < 0.3 && this.onGround;
      this.stillT = still ? (this.stillT || 0) + dt : 0;
      if (this.stillT >= EXO31.bakris.still && G.time >= (this.bakrisT || 0) && !this.status.has('invisible')) { this.bakrisT = G.time + EXO31.bakris.cd; this.goInvisible(EXO31.bakris.t, true); }
    }
    if (x.has('verity') && this.verity) for (const k of Object.keys(this.verity)) if (this.verity[k] < G.time) delete this.verity[k];
    if (this.exoZones?.length) {
      for (const z of this.exoZones) {
        z.t -= dt;
        if (z.kind === 'spike') { if (z.t <= 0) { explode(z.pos, EXO31.ahamkara.r, EXO31.ahamkara.dmg, 'solar', { source: 'ability', jolted: true }); sparks(z.pos, 0xff6a2a, 24, 7, 0.07, 0.5); } continue; }
        z.tickT -= dt;
        if (z.tickT <= 0) { z.tickT = z.tick; for (const t of near(z.pos, z.r)) zap(null, t, z.dmg, 'solar'); if (Math.random() < 0.5) sparks(z.pos.clone().setY(z.pos.y + 0.2), 0xff8b2b, 2, 2, 0.05, 0.3); }
      }
      this.exoZones = this.exoZones.filter((z) => z.t > 0);
    }
  },
};
