// H22: the one Taken blight look, shared by the Whisper's wall decor, its mechanic blights and Blight Edge's bombs.
// Destiny's blight: a black orb with a dark, faintly shimmering surface and a soft pale glow round its silhouette.
// The halo is a camera-facing sprite (a ring of light hugging the orb's outline from every side); the orb is a plain sphere.
import * as THREE from 'three';

let swirlTex = null, haloTex = null;

/** Dark surface with faint pale streaks that swirl round a centre. */
function swirl() {
  if (swirlTex) return swirlTex;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#030305'; x.fillRect(0, 0, c.width, c.height);
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const px = rnd() * c.width, py = 20 + rnd() * (c.height - 40), len = 6 + rnd() * 16, a = (rnd() - 0.5) * 0.9;
    x.strokeStyle = `rgba(200,205,225,${0.06 + rnd() * 0.22})`; x.lineWidth = 1 + rnd() * 1.2;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + len * 0.5, py - 3 + a * 6, px + len, py + a * 4); x.stroke();
  }
  swirlTex = new THREE.CanvasTexture(c);
  swirlTex.wrapS = THREE.RepeatWrapping;
  swirlTex.colorSpace = THREE.SRGBColorSpace;
  return swirlTex;
}

/** Radial glow: clear in the middle (the orb covers it), brightest just outside the orb's edge, fading out. */
function halo() {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(220,232,255,0)');
  g.addColorStop(0.5, 'rgba(220,232,255,0)');
  g.addColorStop(0.6, 'rgba(235,242,255,0.95)');
  g.addColorStop(0.7, 'rgba(200,215,255,0.45)');
  g.addColorStop(1, 'rgba(180,200,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  haloTex = new THREE.CanvasTexture(c);
  haloTex.colorSpace = THREE.SRGBColorSpace;
  return haloTex;
}

const HALO_SCALE = 2.0 / 0.55; // sprite size per orb radius: the halo's bright band (0.55..0.6 of the sprite's half width) sits on the orb's edge

/**
 * A blight orb of radius r. Returns { group, core, haloSprite }. `own` gives it its own materials (needed when the caller animates them);
 * otherwise materials are shared by every orb. Spin it by turning `core` (the surface streaks move).
 */
export function blightOrb(r, own = false) {
  const g = new THREE.Group();
  const coreMat = own ? new THREE.MeshBasicMaterial({ map: swirl(), color: 0xffffff }) : sharedCore();
  const core = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), coreMat);
  const haloSprite = new THREE.Sprite(own ? haloMaterial() : sharedHalo());
  haloSprite.scale.setScalar(r * HALO_SCALE);
  g.add(core, haloSprite);
  return { group: g, core, haloSprite };
}

let _core = null, _halo = null;
const sharedCore = () => (_core ||= new THREE.MeshBasicMaterial({ map: swirl(), color: 0xffffff }));
const haloMaterial = () => new THREE.SpriteMaterial({ map: halo(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
const sharedHalo = () => (_halo ||= haloMaterial());

/** Disposes an orb made with own = true (shared textures stay). */
export function disposeBlightOrb(o) {
  o.core.geometry.dispose();
  if (o.core.material !== _core) o.core.material.dispose();
  if (o.haloSprite.material !== _halo) o.haloSprite.material.dispose();
}
