import * as THREE from 'three';
import { buildGunModel } from './models.js';
import { ELEMENTS } from './data.js';

// Weapon icons are rendered from the real viewmodel meshes into a small
// offscreen canvas, then cached as data URLs. Armour uses simple SVG icons.

let rr = null, scene = null, cam = null;
const cache = new Map();
const W = 160, H = 160; // square, Destiny 2 style
const DIAGONAL = 0.52; // muzzle tilted up and to the right

function init() {
  rr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  rr.setPixelRatio(1);
  rr.setSize(W, H);
  rr.toneMapping = THREE.ACESFilmicToneMapping;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2, 3, 4);
  scene.add(key);
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
  cam.position.set(0, 0, 5);
}

export function weaponIcon(item) {
  const key = `${item.arch}|${item.rarity}|${item.element}|${item.rarity === 'exotic' ? item.name : ''}`;
  if (cache.has(key)) return cache.get(key);
  if (!rr) init();
  const model = buildGunModel(item);
  model.traverse((o) => { if (o.userData.hand) o.visible = false; });
  model.userData.flash.visible = false;
  model.rotation.set(0.08, -Math.PI / 2, 0); // side profile, muzzle to the right
  const tilt = new THREE.Group();
  tilt.add(model);
  tilt.rotation.z = DIAGONAL;
  scene.add(tilt);
  tilt.updateMatrixWorld(true);
  const bb = new THREE.Box3();
  model.traverse((o) => { if (o.isMesh && o.visible && !o.material.transparent) bb.expandByObject(o); });
  const c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
  const half = Math.max(s.x, s.y) / 2 * 1.1;
  Object.assign(cam, { left: -half, right: half, top: half, bottom: -half });
  cam.position.set(c.x, c.y, 5);
  cam.lookAt(c.x, c.y, 0);
  cam.updateProjectionMatrix();
  rr.render(scene, cam);
  const url = rr.domElement.toDataURL('image/png');
  scene.remove(tilt);
  model.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  cache.set(key, url);
  return url;
}

/** Element symbol (Kinetic, Solar, Arc, Void, Stasis, Strand) in the element's color. */
export function elementIcon(id, cls = 'el-ico') {
  const el = ELEMENTS[id];
  if (!el) throw new Error(`No element "${id}"`);
  return `<svg viewBox="0 0 64 64" class="${cls}" style="color:${el.color}" role="img" aria-label="${el.name}"><title>${el.name}</title><g fill="currentColor">${el.symbol}</g></svg>`;
}

const ARMOR_SVG = {
  helmet: '<path d="M32 8c-12 0-20 9-20 21v10c0 3 2 6 5 7l5 2v6h20v-6l5-2c3-1 5-4 5-7V29C52 17 44 8 32 8zm-12 24h24v6H20z"/>',
  arms: '<path d="M20 10h14l4 14 8 4v14l-6 12H22l-6-10V30l4-6z"/><path d="M22 44h18" stroke="#0005" stroke-width="3"/>',
  chest: '<path d="M14 12l10-4 8 6 8-6 10 4 4 16-6 4v22H20V32l-6-4z"/><path d="M32 14v40" stroke="#0005" stroke-width="3"/>',
  legs: '<path d="M18 8h28l-2 20-4 28h-6l-2-24-2 24h-6l-4-28z"/>',
};
export function armorIcon(slot) {
  return `<svg viewBox="0 0 64 64" class="armor-svg" aria-hidden="true"><g fill="currentColor">${ARMOR_SVG[slot]}</g></svg>`;
}

// Faction emblems for the enemy plate (original designs): Fallen a horned shard, Hive a crescent
// with a watching eye, Cabal an armored crest with a visor slit.
const FACTION_SVG = {
  scrappers: '<path d="M32 6 40 22 58 14 46 32 58 50 40 42 32 58 24 42 6 50 18 32 6 14 24 22z"/><circle cx="32" cy="32" r="6" fill="#000" fill-opacity="0.55"/>',
  hollow: '<path d="M44 8A26 26 0 1 0 44 56 20 20 0 1 1 44 8z"/><circle cx="40" cy="32" r="5"/><path d="M14 52 10 62 20 56zM24 58 24 64 30 58z"/>',
  legion: '<path d="M32 4 56 14 52 44 32 60 12 44 8 14z"/><rect x="16" y="24" width="32" height="7" fill="#000" fill-opacity="0.6"/><path d="M32 34 40 46 32 52 24 46z" fill="#000" fill-opacity="0.35"/>',
};
export const FACTION_NAMES = { scrappers: 'Fallen', hollow: 'Hive', legion: 'Cabal' };
export function factionIcon(faction) {
  const body = FACTION_SVG[faction];
  if (!body) throw new Error(`No icon for faction "${faction}"`);
  return `<svg viewBox="0 0 64 64" class="faction-svg" aria-hidden="true"><g fill="currentColor">${body}</g></svg>`;
}

export function subclassIcon(color) {
  return `<svg viewBox="0 0 64 64" class="armor-svg" aria-hidden="true"><g fill="none" stroke="${color}" stroke-width="4"><path d="M32 4 60 32 32 60 4 32z"/><path d="M32 16 48 32 32 48 16 32z" fill="${color}" fill-opacity="0.35"/></g></svg>`;
}
