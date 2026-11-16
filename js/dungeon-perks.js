// U23 "The Emperor's Shadow": the exclusive weapon perks (Gilded Tithe, Taster's Instinct, Emperor's Feast, Royal Guard,
// Psionic Echo, Banquet Rush), the exotic Sovereign's Gaze (Royal Mandate) and the Imperial set bonus. Mixed into Player
// (player.js calls each hook once from the matching place: a weapon hit, a kill, the damage multiplier, a reload, incoming
// damage, an orb, Favor and the per-frame tick). Numbers live in IMPERIAL_TUNE (dungeon-loot.js).
import * as THREE from 'three';
import { G } from './state.js';
import { dealDamage, explode, enemiesNear } from './game.js';
import { ringFx, sparks } from './effects.js';
import { IMPERIAL_TUNE as T } from './dungeon-loot.js';

export const MANDATE = { window: 3, hits: 3, radius: 4, dmg: 1.5, refund: 2 };
const _c = new THREE.Vector3();

export const imperialMethods = {
  /** After a weapon hit lands (not a super). */
  imperialHit(w, e, crit, dmg, point) {
    if (w.has('psionicecho') && w.hitCount % T.echoEvery === 0) { // Psionic Echo
      ringFx(point.clone(), T.echoR, 0xa060ff, 0.35);
      for (const o of enemiesNear(e.pos, T.echoR, 6, e)) dealDamage(o, dmg * T.echoDmg, { element: w.item.element === 'kinetic' ? 'void' : w.item.element, source: 'perk', pos: o.center(_c).clone() });
    }
    if (w.has('royalmandate') && crit && e.alive) { // Sovereign's Gaze: Royal Mandate
      if (G.time - (e.mandateT ?? -99) > MANDATE.window) e.mandateN = 0;
      e.mandateT = G.time;
      e.mandateN = (e.mandateN || 0) + 1;
      if (e.mandateN >= MANDATE.hits) {
        e.mandateN = 0;
        const c = e.center(new THREE.Vector3());
        sparks(c, 0xffd27a, 18, 7, 0.1, 0.5);
        explode(c, MANDATE.radius, w.s.dmg * MANDATE.dmg, 'solar', { source: 'perk' });
        w.ammo = Math.min(w.mag, w.ammo + MANDATE.refund);
      }
    }
  },
  /** After a weapon kill. */
  imperialKill(w, e, crit) {
    if (w.has('gildedtithe') && crit) { // Gilded Tithe
      this.status.apply('tithe', { scope: w.idx, add: 1 });
      if (this.status.stacks('tithe', w.idx) >= T.titheStacks) {
        this.status.remove('tithe', w.idx);
        this.instantReload(w);
        this.status.apply('tithedmg', { scope: w.idx, t: T.titheT, set: true });
      }
    }
    if (w.has('emperorsfeast')) this.status.apply('feast', { add: 1, t: T.feastT }); // Emperor's Feast
    if (w.has('banquetrush')) this.status.apply('banquet', { t: T.rushT, set: true }); // Banquet Rush
  },
  /** The weapon's damage multiplier from these perks. */
  imperialDmg(w) {
    let m = 1;
    if (this.status.has('tithedmg', w.idx)) m *= T.titheDmg;
    if (this.status.has('instinct', w.idx)) m *= T.instinctDmg;
    return m;
  },
  /** The reload time multiplier. */
  imperialReload() { return this.status.has('banquet') ? T.rushReload : 1; },
  /** Incoming damage multiplier: Royal Guard on a plate or dais, and the Imperial set while Favored. */
  imperialIncoming() {
    let m = 1;
    if (this.onPlate && this.weapon?.has('royalguard')) m *= T.guardCut;
    if (this.sets.has('imperial') && this.status.has('favor')) m *= IMPERIAL_SET.favorCut;
    return m;
  },
  /** An orb, or Favor: Taster's Instinct reloads and empowers every weapon that has it. */
  imperialRefresh() {
    for (const w of this.weapons) if (w.has('tastersinstinct')) { this.instantReload(w); this.status.apply('instinct', { scope: w.idx, t: T.instinctT, set: true }); }
  },
  /** Per frame: Emperor's Feast heals over its 2 seconds, per stack. */
  imperialTick(dt) {
    const n = this.status.stacks('feast');
    if (n > 0 && !this.dead) this.healPct((T.feastHeal / T.feastT) * dt * Math.min(n, T.feastMax));
  },
};

/** The Imperial set bonus (style.js SETS.imperial): Favor drains slower and you take less damage while Favored. */
export const IMPERIAL_SET = { favorDrain: 0.7, favorCut: 0.9 };
