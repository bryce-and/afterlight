// Subclass screen icons: a frame shape per slot type (super, grenade, melee, class, jump,
// aspect, fragment) around a glyph generated from the ability's id, in its element color.
// Pure string building (no DOM, no Three.js), so the tests can check every icon is distinct.

const FRAMES = {
  super: '<path d="M32 2 58 17 58 47 32 62 6 47 6 17z"/>',
  grenade: '<circle cx="32" cy="32" r="28"/>',
  melee: '<path d="M32 3 61 32 32 61 3 32z"/>',
  class: '<path d="M8 8H56V36L32 60 8 36z"/>',
  jump: '<path d="M32 4 60 56H4z"/>',
  aspect: '<path d="M20 4H44L60 20V44L44 60H20L4 44V20z"/><path d="M23 10H41L54 23V41L41 54H23L10 41V23z" fill="none" stroke-opacity="0.45"/>',
  fragment: '<path d="M32 8 53 20 53 44 32 56 11 44 11 20z"/>',
};

/** Small deterministic hash of a string (FNV-1a). */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const f1 = (n) => Math.round(n * 10) / 10;
const pt = (r, a) => `${f1(32 + r * Math.cos(a))} ${f1(32 + r * Math.sin(a))}`;

// Glyph families. Each takes the hash bits and draws inside a ~16px radius.
const GLYPHS = [
  (h) => { // n-pointed star
    const n = 3 + (h % 6), rot = ((h >> 3) % 8) * (Math.PI / 16);
    const d = Array.from({ length: n * 2 }, (_, i) => pt(i % 2 ? 6 : 16, rot + (i * Math.PI) / n - Math.PI / 2)).join(' L');
    return `<path d="M${d}z"/>`;
  },
  (h) => { // ring with ticks
    const n = 2 + (h % 7), rot = ((h >> 4) % 6) * 0.25;
    const ticks = Array.from({ length: n }, (_, i) => { const a = rot + (i / n) * Math.PI * 2; return `<path d="M${pt(8, a)} L${pt(17, a)}" stroke-width="3.5"/>`; }).join('');
    return `<circle cx="32" cy="32" r="6"/>${ticks}`;
  },
  (h) => { // stacked chevrons
    const n = 1 + (h % 3), up = (h >> 2) % 2 ? -1 : 1;
    return Array.from({ length: n }, (_, i) => { const y = 32 + up * (i * 7 - (n - 1) * 3.5); return `<path d="M20 ${y + up * 5} L32 ${y - up * 5} L44 ${y + up * 5}" fill="none" stroke-width="4"/>`; }).join('');
  },
  (h) => { // crossed bars
    const n = 2 + (h % 3), rot = ((h >> 2) % 4) * (Math.PI / 8);
    return Array.from({ length: n }, (_, i) => { const a = rot + (i / n) * Math.PI; return `<path d="M${pt(16, a)} L${pt(16, a + Math.PI)}" stroke-width="4"/>`; }).join('') + '<circle cx="32" cy="32" r="3.5"/>';
  },
  (h) => { // bolt
    const flip = (h % 2) ? -1 : 1, k = 3 + ((h >> 1) % 4);
    return `<path d="M${32 + flip * 6} 14 L${32 - flip * k} 33 L${32 + flip * 2} 33 L${32 - flip * 6} 50 L${32 + flip * k} 29 L${32 - flip * 2} 29z"/>`;
  },
  (h) => { // orbiting dots
    const n = 3 + (h % 5), r = 9 + ((h >> 3) % 4) * 2;
    return `<circle cx="32" cy="32" r="${4 + ((h >> 5) % 3)}"/>` + Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return `<circle cx="${f1(32 + r * Math.cos(a))}" cy="${f1(32 + r * Math.sin(a))}" r="2.6"/>`; }).join('');
  },
  (h) => { // nested triangles
    const n = 1 + (h % 3), down = (h >> 2) % 2;
    return Array.from({ length: n }, (_, i) => { const r = 17 - i * 5, a0 = down ? Math.PI / 2 : -Math.PI / 2; return `<path d="M${pt(r, a0)} L${pt(r, a0 + 2.094)} L${pt(r, a0 + 4.189)}z" fill="${i % 2 ? '#0b0e13' : 'currentColor'}"/>`; }).join('');
  },
  (h) => { // crescent
    const a = ((h % 8) / 8) * Math.PI * 2, o = 5 + ((h >> 3) % 4);
    return `<circle cx="32" cy="32" r="15"/><circle cx="${f1(32 + o * Math.cos(a))}" cy="${f1(32 + o * Math.sin(a))}" r="13" fill="#0b0e13"/>`;
  },
];

/** SVG markup for an ability, aspect or fragment. slot: a key of FRAMES. */
export function abilityIcon(slot, id, color) {
  const frame = FRAMES[slot];
  if (!frame) throw new Error(`No icon frame for slot "${slot}"`);
  const h = hash(`${slot}:${id}`);
  const glyph = GLYPHS[h % GLYPHS.length](h >>> 3);
  const turn = (hash(`turn:${id}`) % 12) * 30;
  return `<svg viewBox="0 0 64 64" class="ab-svg" aria-hidden="true" style="color:${color}"><g fill="#0b0e13" stroke="currentColor" stroke-width="3" stroke-linejoin="round">${frame}</g><g transform="rotate(${turn} 32 32)" fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="0">${glyph}</g></svg>`;
}

/** An empty or locked slot. */
export function emptySlotIcon(slot) {
  return `<svg viewBox="0 0 64 64" class="ab-svg" aria-hidden="true"><g fill="none" stroke="#ffffff33" stroke-width="2.5" stroke-dasharray="5 4">${FRAMES[slot]}</g></svg>`;
}
