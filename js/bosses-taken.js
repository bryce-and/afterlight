import * as THREE from 'three';
import { mat } from './world.js';
import { PI, cone, grow, horns, shoulderSpikes, backSpines } from './boss-kit.js';
import { taken } from './models-taken.js';

// U29: Taken bosses are the Taken's own units grown and made more imposing: black bodies, white-rimmed void tendrils and horns.
// (Aurix, the Whisper's Mind, has his own pass in models-taken.js buildTakenMind().)
const black = () => mat(0x07080c), halo = () => mat(0xdff4ff, { emissive: 0xdff4ff, emissiveIntensity: 3 });
/** Void tendrils: black spines trailing back and up off the shoulders and down the back. */
function tendrils(k, n, len, y = 0.8) {
  const t = k.torso;
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) cone(k, 0.05, len - i * 0.06, 4, black(), s * (0.2 + i * 0.1), y + i * 0.06, -0.15, t, false, [-0.8, 0, -s * (0.3 + i * 0.15)]);
}
/** Taken are black and white (Bryce, 2026-11-17): every material becomes near-black or bone-white by its brightness, glows go white. Private copies, shared per source so the parts still merge. */
function monochrome(k) {
  const seen = new Map(), hsl = {};
  k.g.traverse((o) => {
    if (!o.isMesh) return;
    let m = seen.get(o.material);
    if (!m) {
      m = o.material.clone();
      if (m.color) {
        m.color.getHSL(hsl);
        m.color.setHex(hsl.l > 0.55 ? 0xdfe6ee : 0x0b0c10);
      }
      if (m.emissive && m.emissiveIntensity > 0.01 && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.01) { m.emissive.setHex(0xdff4ff); m.color?.setHex(0xdff4ff); }
      seen.set(o.material, m);
    }
    o.material = m;
  });
}
const noHover = (fn) => (k) => { fn(k); k.hover = false; };

export const TAKEN_BOSSES = {
  takencaptain: (c) => grow(c, (k) => taken(k, 'tk_captain'), 2.4, (k) => {
    tendrils(k, 3, 0.6); horns(k, k.torso, 1.0, -0.02, 2, 0.5, black(), 0.12, 0.5); backSpines(k, k.torso, 4, 0.4, black());
  monochrome(k); }, 0.125),
  takenchampion: (c) => grow(c, (k) => taken(k, 'tk_knight'), 2.5, (k) => {
    tendrils(k, 3, 0.65); horns(k, k.torso, 1.0, -0.02, 3, 0.5, halo(), 0.12, 0.5); shoulderSpikes(k, k.torso, 0.4, 0.8, 2, 0.45, black());
  monochrome(k); }, 0.44),
  morgeth: (c) => grow(c, (k) => taken(k, 'tk_ogre'), 3.4, (k) => {
    tendrils(k, 4, 0.8, 0.9); horns(k, k.torso, 1.0, -0.02, 3, 0.7, black(), 0.2, 0.6); backSpines(k, k.torso, 5, 0.55, halo());
  monochrome(k); }, 0.397),
  veshra: (c) => grow(c, noHover((k) => taken(k, 'tk_wizard')), 1.6, (k) => {
    tendrils(k, 4, 0.7, 0.7); horns(k, k.torso, 0.9, -0.02, 3, 0.5, black(), 0.12, 0.5);
  monochrome(k); }, 0.902),
};
