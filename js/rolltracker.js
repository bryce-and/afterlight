// H23 Roll Tracker: the Orbit "Rolls" tab. Every weapon, its fixed perk pool and where it drops, searchable by weapon or perk.
// The tracker reads the live tables (frames.js, data.js, exotic-rules.js) every time, so a perk or weapon added there shows up here with no change.
// Pure functions (trackerEntries, searchTracker) have no DOM so tools/tests.js can check them; renderRollTracker is the screen.
import { ARCHETYPES, ELEMENTS, PERKS, EXOTIC_PERKS, EXOTIC_WEAPONS, PERK_COLUMN_NAMES, RARITIES, SLOT_NAMES } from './data.js';
import { LEGENDARY_WEAPONS, NAMED_WEAPONS, FRAMES, perkPoolFor, frameSlot } from './frames.js';
import { exoticDef } from './exotic-rules.js';
import { weaponIcon, weaponSilhouette, elementIcon } from './icons.js';
import { esc } from './util.js';

const COLUMNS = ['mag', 'damage', 'effect'];

// Drop sources, each tied to the code that really hands the item out:
const WHERE = 'enemy engrams, mission clear rewards, Horde and Endless rewards';
const WORLD = `World drop: ${WHERE}`;
const SRC = {
  world: WORLD,
  levelTrack: 'Level track engram',
  starter: 'New Guardian kit: a common of every weapon type',
  skip: 'Skip Campaign gear: one Legendary weapon per ammo slot',
  exoticRepeat: 'Exotic mission repeat clears: two Legendary drops',
  horde: 'Horde: the final wave always pays an exotic; Endless: an exotic every 10 waves past 30',
  levelExotic: 'Level track exotic engram at levels 20 and 40',
  tiers: 'Legendary tier: an exotic on every clear of the final campaign mission; Ultimate tier: one on the first clear of every mission',
  menus: 'Legendary and Ultimate unlock reward menus: pick from random exotics',
  kiosk: 'Exotic Kiosk (after you earn it): buy it again for glimmer',
};

const perkInfo = (id) => PERKS[id] || EXOTIC_PERKS[id] || null;
const perkName = (id) => perkInfo(id)?.name || id;
const frameName = (arch, frame) => (frame ? FRAMES[arch]?.[frame]?.name ?? frame : null);

function sourcesFor(rarity, tpl) {
  if (rarity === 'exotic') {
    if (tpl.mission) {
      const def = exoticDef(tpl.mission);
      return [`Exotic mission: ${def.name}. First clear only; it never drops anywhere else`, SRC.kiosk];
    }
    return [`World drop (exotic engram): ${WHERE}`, SRC.levelExotic, SRC.horde, SRC.tiers, SRC.menus, SRC.kiosk];
  }
  if (rarity === 'common') return [SRC.starter, SRC.world];
  if (rarity === 'legendary') return [SRC.world, SRC.levelTrack, SRC.skip, SRC.exoticRepeat];
  return [SRC.world, SRC.levelTrack];
}

let cached = null, cachedKey = '';
/** One entry per weapon: named commons to rares, legendaries and exotics. Rebuilt when the tables change size, so late additions show. */
export function trackerEntries() {
  const key = `${NAMED_WEAPONS.length}|${LEGENDARY_WEAPONS.length}|${EXOTIC_WEAPONS.length}|${Object.keys(PERKS).length}|${Object.keys(EXOTIC_PERKS).length}`;
  if (cached && key === cachedKey) return cached;
  const out = [];
  const add = (n, rarity) => {
    out.push({
      name: n.name, arch: n.arch, frame: n.frame, element: n.element, slot: frameSlot(n.arch, n.frame), rarity, exotic: false,
      pool: perkPoolFor(n), sources: sourcesFor(rarity),
    });
  };
  for (const n of NAMED_WEAPONS) add(n, n.rarity);
  for (const l of LEGENDARY_WEAPONS) add(l, 'legendary');
  for (const x of EXOTIC_WEAPONS) {
    out.push({
      name: x.name, arch: x.arch, frame: null, element: x.element, slot: x.slot || ARCHETYPES[x.arch].slot, rarity: 'exotic', exotic: true,
      perks: [...x.perks], mission: x.mission || null, flavor: x.flavor || '', sources: sourcesFor('exotic', x),
    });
  }
  cached = out; cachedKey = key;
  return out;
}

const entryPerks = (e) => (e.exotic ? e.perks : COLUMNS.flatMap((c) => e.pool[c]));
/** True when the perk id (or its display name) contains the lowercase query. */
export const perkMatches = (id, q) => !!q && (id.toLowerCase().includes(q) || perkName(id).toLowerCase().includes(q));

/** Weapons whose name or any perk (display name or id) contains the query. `filters`: { element, slot, arch }, each optional. */
export function searchTracker(query = '', filters = {}) {
  const q = String(query || '').trim().toLowerCase();
  const { element, slot, arch } = filters || {};
  return trackerEntries().filter((e) => {
    if (element && e.element !== element) return false;
    if (slot && e.slot !== slot) return false;
    if (arch && e.arch !== arch) return false;
    if (!q) return true;
    return e.name.toLowerCase().includes(q) || entryPerks(e).some((p) => perkMatches(p, q));
  });
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
const view = { query: '', element: '', slot: '', arch: '', sel: null };
const keyOf = (e) => `${e.arch}|${e.name}`;
const RARITY_NAME = Object.fromEntries(RARITIES.map((r) => [r.id, r]));
const RARITY_NOTE = 'Uncommon drops roll 1 perk (Magazine), Rare drops 2 (Magazine and one of Damage or Effect), Legendary drops all 3. Common drops have none.';

function iconFor(e) {
  const item = { kind: 'weapon', name: e.name, arch: e.arch, frame: e.frame, element: e.element, rarity: e.rarity, slot: e.slot, perks: [], exotic: e.exotic ? e.perks[0] : null };
  try { return `<img class="rt-big" src="${weaponIcon(item)}" alt="" draggable="false">`; }
  catch (err) { console.error('Roll Tracker: weapon icon failed for', e.name, err); return weaponSilhouette(e.arch); }
}

function perkHTML(id, q, sig) {
  const p = perkInfo(id);
  return `<div class="ins-perk${sig ? ' exo' : ''}${perkMatches(id, q) ? ' rt-hit' : ''}"><i></i><div><b>${esc(perkName(id))}${sig ? ' <small>Signature</small>' : ''}</b><span>${esc(p?.desc || '')}</span></div></div>`;
}

function detailHTML(e, q) {
  const r = RARITY_NAME[e.rarity];
  const arch = ARCHETYPES[e.arch];
  const fr = e.frame ? FRAMES[e.arch]?.[e.frame] : null;
  const body = e.exotic
    ? `<div class="ins-col"><div class="ins-col-h">Fixed perks (every drop)</div>${e.perks.map((p, i) => perkHTML(p, q, i === 0)).join('')}</div>`
    : `<div class="ins-cols">${COLUMNS.map((c) => `<div class="ins-col"><div class="ins-col-h">${esc(PERK_COLUMN_NAMES[c])}</div>${e.pool[c].map((p) => perkHTML(p, q, false)).join('')}</div>`).join('')}</div>`;
  return `
    <div class="rt-card" style="--rc:${r.color}">
      <div class="rt-head">${iconFor(e)}<div>
        <div class="ins-name">${esc(e.name)}</div>
        <div class="ins-type">${esc(r.name)}  ·  ${esc(arch.name)}</div></div></div>
      <div class="ins-tags"><span>${elementIcon(e.element)}${esc(ELEMENTS[e.element].name)}</span><span>${esc(SLOT_NAMES[e.slot] || e.slot)} ammo</span></div>
      ${e.exotic && e.flavor ? `<div class="ins-flavor">${esc(e.flavor)}</div>` : ''}
      ${fr ? `<div class="ins-frame"><span>Frame</span><b>${esc(fr.name)}</b><em>${esc(fr.desc)}</em></div>` : ''}
      <div class="ins-frame"><span>${e.exotic ? 'Perks' : 'Perk pool'}</span></div>
      ${body}
      <div class="ins-note">${e.exotic ? 'Exotics have fixed perks. The first one is the signature perk.' : esc(RARITY_NOTE)}</div>
      <div class="ins-frame"><span>Drop source</span>${e.sources.map((s) => `<em class="rt-src">${esc(s)}</em>`).join('')}</div>
    </div>`;
}

/** Fills the Orbit main area with the Roll Tracker. */
export function renderRollTracker(main) {
  const all = trackerEntries();
  const options = (vals, label, cur) => `<option value="">${label}</option>${vals.map(([v, n]) => `<option value="${esc(v)}"${cur === v ? ' selected' : ''}>${esc(n)}</option>`).join('')}`;
  const elems = Object.values(ELEMENTS).map((x) => [x.id, x.name]);
  const slots = ['primary', 'special', 'heavy'].map((s) => [s, SLOT_NAMES[s] || s]);
  const archIds = [...new Set(all.map((e) => e.arch))], dup = (a) => archIds.filter((b) => ARCHETYPES[b].name === ARCHETYPES[a].name).length > 1;
  const arches = archIds.map((a) => [a, ARCHETYPES[a].name + (!dup(a) ? '' : ARCHETYPES[a].exoticOnly ? ' (Exotic)' : ` (${SLOT_NAMES[ARCHETYPES[a].slot] || ARCHETYPES[a].slot})`)]).sort((a, b) => a[1].localeCompare(b[1])); // H23: two families can share a name (heavy and primary)
  main.innerHTML = `
    <div class="rt">
      <aside class="rt-side">
        <div class="eyebrow">Roll Tracker</div>
        <input id="rt-q" class="rt-q" type="search" placeholder="Search a weapon or a perk" autocomplete="off" spellcheck="false" value="${esc(view.query)}">
        <div class="rt-filters">
          <select id="rt-el" aria-label="Element">${options(elems, 'Any element', view.element)}</select>
          <select id="rt-sl" aria-label="Ammo slot">${options(slots, 'Any slot', view.slot)}</select>
          <select id="rt-ar" aria-label="Archetype">${options(arches, 'Any archetype', view.arch)}</select>
        </div>
        <div class="rt-count" id="rt-count"></div>
        <div class="rt-list" id="rt-list"></div>
      </aside>
      <section class="rt-detail" id="rt-detail"></section>
    </div>`;
  const $q = (s) => main.querySelector(s);
  const paint = () => {
    const rows = searchTracker(view.query, view);
    if (!rows.some((e) => keyOf(e) === view.sel)) view.sel = rows[0] ? keyOf(rows[0]) : null;
    $q('#rt-count').textContent = `${rows.length} of ${all.length} weapons`;
    $q('#rt-list').innerHTML = rows.map((e) => `<button class="rt-row${keyOf(e) === view.sel ? ' sel' : ''}" data-k="${esc(keyOf(e))}" style="--rc:${RARITY_NAME[e.rarity].color}">
      <span class="rt-sil">${weaponSilhouette(e.arch)}</span>
      <span class="rt-rn"><b>${esc(e.name)}</b><small>${esc(RARITY_NAME[e.rarity].name)}  ·  ${esc(ARCHETYPES[e.arch].name)}  ·  ${esc(ELEMENTS[e.element].name)}</small></span></button>`).join('') || '<div class="ins-none">No weapon or perk matches.</div>';
    const sel = rows.find((e) => keyOf(e) === view.sel);
    $q('#rt-detail').innerHTML = sel ? detailHTML(sel, view.query.trim().toLowerCase()) : '<div class="ins-none">Nothing to show.</div>';
    main.querySelectorAll('.rt-row').forEach((b) => b.addEventListener('click', () => { view.sel = b.dataset.k; paint(); }));
  };
  $q('#rt-q').addEventListener('input', (ev) => { view.query = ev.target.value; paint(); });
  $q('#rt-el').addEventListener('change', (ev) => { view.element = ev.target.value; paint(); });
  $q('#rt-sl').addEventListener('change', (ev) => { view.slot = ev.target.value; paint(); });
  $q('#rt-ar').addEventListener('change', (ev) => { view.arch = ev.target.value; paint(); });
  paint();
  $q('#rt-q').focus();
}
