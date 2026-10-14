import * as THREE from 'three';
import { buildGunModel } from './models.js';
import { ELEMENTS } from './data.js';
import { buildCharacter } from './characters.js';
import { lookOf } from './style.js';

// Weapon and armor icons are rendered from the real meshes (the viewmodel, or the slot's pieces on the
// Guardian model) into a small offscreen canvas, then cached as data URLs.

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

// Armor icons show the piece on the current class, in its look and the class's shader, glowing in the subclass color.
let armorCtx = { classId: 'vanguard', element: 'solar', shader: null };
/** Called when the class, subclass or shader changes (the character screen does it before drawing tiles). */
export function setArmorIconContext(classId, element, shader) { armorCtx = { classId, element, shader }; }

const ARMOR_VIEW = { helmet: 0.5, arms: 0.35, chest: 0.4, legs: 0.35 }; // turn toward the camera, radians

/** An image URL of the armor piece (rendered and cached), for <img src>. */
export function armorIconURL(item) {
  const { element, shader } = armorCtx;
  const classId = item.classId || armorCtx.classId; // armor of another class is drawn on that class
  const lk = lookOf(item);
  const key = `armor|${classId}|${element}|${shader}|${item.slot}|${lk}`;
  if (cache.has(key)) return cache.get(key);
  if (!rr) init();
  const ch = buildCharacter(classId, element, { helmet: lk, arms: lk, chest: lk, legs: lk, shader });
  const g = ch.group;
  g.rotation.y = ARMOR_VIEW[item.slot];
  g.traverse((o) => { if (o.isMesh) o.visible = o.userData.slot === item.slot; });
  scene.add(g);
  g.updateMatrixWorld(true);
  const bb = new THREE.Box3();
  g.traverse((o) => { if (o.isMesh && o.visible) bb.expandByObject(o); });
  const c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
  const half = Math.max(s.x, s.y) / 2 * 1.12;
  Object.assign(cam, { left: -half, right: half, top: half, bottom: -half });
  cam.position.set(c.x, c.y, 5);
  cam.lookAt(c.x, c.y, 0);
  cam.updateProjectionMatrix();
  rr.render(scene, cam);
  const url = rr.domElement.toDataURL('image/png');
  scene.remove(g);
  g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  cache.set(key, url);
  return url;
}

/** Element symbol (Kinetic, Solar, Arc, Void, Stasis, Strand) in the element's color. */
export function elementIcon(id, cls = 'el-ico') {
  const el = ELEMENTS[id];
  if (!el) throw new Error(`No element "${id}"`);
  return `<svg viewBox="0 0 64 64" class="${cls}" style="color:${el.color}" role="img" aria-label="${el.name}"><title>${el.name}</title><g fill="currentColor">${el.symbol}</g></svg>`;
}

/** An armor item's icon as HTML (the rendered piece). */
export function armorIcon(item) {
  return `<img class="armor-img" src="${armorIconURL(item)}" alt="" draggable="false">`;
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
