// U20b Legend and Ultimate II screens: the full-screen unlock animations, the exotic reward menu, the Skip Campaign confirm.
// Rules live in rewards.js; this file only draws and listens.
import { EXOTIC_ARMOR_PERKS } from './data.js';
import { G } from './state.js';
import { REWARD_MENUS, validateClaim, claimMenu, pendingMenus, skipCampaign, skipAvailableFor } from './rewards.js';
import { OVERLOAD_NAME } from './campaign.js';
import { switchCharacter } from './save.js';
import { sfx } from './audio.js';
import { esc } from './util.js';
import { itemCard, orbitNotice, showOrbit } from './ui.js';

const UNLOCKS = {
  legendary: { cls: 'legendary', title: 'LEGENDARY CAMPAIGN UNLOCKED', sub: 'The same fight, harder. Enemies stand 25 Light above you, or above the mission if you are under it. Pick it in the Director.', ms: 3600 },
  ultimate: { cls: 'ultimate', title: 'ULTIMATE CAMPAIGN UNLOCKED', sub: 'No revives. Enemies stand 50 Light above you, or above the mission if you are under it. Pick it in the Director.', ms: 5800 },
  all: { cls: 'ultimate', title: 'ULTIMATE CAMPAIGN CLEARED', sub: `Legendary and Ultimate are open for every Guardian. Ultimate reward unlocked: ${OVERLOAD_NAME}. Equip any number of exotics. Find it in Inventory.`, ms: 6200 },
};

let animating = false, menuEl = null;
/** True while an unlock animation or a reward menu is on screen. */
export const rewardsOpen = () => animating || !!menuEl;

/** Plays the full-screen unlock animation for 'legendary', 'ultimate' or 'all'. Resolves when the player clicks past it (or after it has run its course). */
export function playUnlock(kind) {
  const U = UNLOCKS[kind];
  if (!U) throw new Error(`playUnlock: no unlock called ${kind}`);
  return new Promise((resolve) => {
    animating = true;
    const el = document.createElement('div');
    el.className = `unlock-ov ${U.cls}`;
    const rays = Array.from({ length: U.cls === 'ultimate' ? 16 : 10 }, (_, i) => `<i style="--a:${(360 / (U.cls === 'ultimate' ? 16 : 10)) * i}deg;--d:${(i % 5) * 0.12}s"></i>`).join('');
    const sparks = Array.from({ length: U.cls === 'ultimate' ? 46 : 26 }, (_, i) => `<b style="--x:${(i * 37) % 100}%;--s:${3 + (i % 7)}px;--t:${2.4 + (i % 5) * 0.7}s;--d:${(i % 9) * 0.25}s"></b>`).join('');
    el.innerHTML = `
      <div class="uo-flash"></div><div class="uo-glow"></div><div class="uo-rays">${rays}</div>
      <div class="uo-ring r1"></div><div class="uo-ring r2"></div>${U.cls === 'ultimate' ? '<div class="uo-ring r3"></div><div class="uo-bars"></div>' : ''}
      <div class="uo-sparks">${sparks}</div>
      <div class="uo-body"><div class="uo-eyebrow">${U.cls === 'ultimate' ? 'Beyond Legend' : 'Afterlight'}</div><h1 class="uo-title">${esc(U.title)}</h1><div class="uo-sweep"></div><p class="uo-sub">${esc(U.sub)}</p><div class="uo-go">Click to continue</div></div>`;
    document.body.appendChild(el);
    if (kind === 'legendary') sfx.areaClear(); else { sfx.bossIntro(); setTimeout(() => sfx.areaClear(), 900); }
    const t0 = performance.now();
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      el.classList.add('out');
      setTimeout(() => { el.remove(); animating = false; resolve(); }, 450);
    };
    el.addEventListener('click', () => { if (performance.now() - t0 > 900) end(); });
    setTimeout(() => el.classList.add('ready'), U.ms);
    setTimeout(end, U.ms + 12000); // never strands the player behind it
  });
}

function menuCard(it) {
  const perk = it.kind === 'armor' ? EXOTIC_ARMOR_PERKS[it.name] : null;
  const text = perk ? `${perk.name}: ${perk.desc}` : it.flavor || '';
  return `<div class="rw-pick" data-id="${it.id}" role="button" tabindex="0">${itemCard(it)}<p class="rw-perk">${esc(text)}</p></div>`;
}

/**
 * The reward menu: keep exactly the menu's number of exotic armor pieces and weapons. Claiming adds them (Postmaster over the cap).
 * "Decide later" keeps the menu in the save; it reopens in Orbit. Resolves when the menu closes.
 */
export function openRewardMenu(s, menu) {
  const def = REWARD_MENUS[menu.tier];
  return new Promise((resolve) => {
    menuEl?.remove();
    const el = document.createElement('div');
    el.className = `rw-ov ${menu.tier}`;
    menuEl = el;
    const picked = { armor: new Set(), weapons: new Set() };
    el.innerHTML = `
      <div class="rw-wrap">
        <div class="rw-eyebrow">${def.name} reward</div>
        <h1 class="rw-title">Choose your exotics</h1>
        <p class="rw-sub">Keep ${def.keepArmor} exotic armor piece${def.keepArmor === 1 ? '' : 's'} and ${def.keepWeapons} exotic weapon${def.keepWeapons === 1 ? '' : 's'}. The rest are gone for good.</p>
        <div class="rw-sec"><div class="rw-head"><b>Exotic armor</b><span id="rw-ca"></span></div><div class="rw-grid" data-k="armor">${menu.armor.map(menuCard).join('')}</div></div>
        <div class="rw-sec"><div class="rw-head"><b>Exotic weapons</b><span id="rw-cw"></span></div><div class="rw-grid" data-k="weapons">${menu.weapons.map(menuCard).join('')}</div></div>
        <div class="rw-btns"><button class="btn primary" id="rw-claim" disabled>Claim</button><button class="btn ghost" id="rw-later">Decide later</button></div>
      </div>`;
    document.body.appendChild(el);
    const claimBtn = el.querySelector('#rw-claim');
    const refresh = () => {
      el.querySelector('#rw-ca').textContent = `${picked.armor.size} / ${def.keepArmor}`;
      el.querySelector('#rw-cw').textContent = `${picked.weapons.size} / ${def.keepWeapons}`;
      el.querySelectorAll('.rw-pick').forEach((c) => c.classList.toggle('on', picked[c.parentElement.dataset.k].has(c.dataset.id)));
      claimBtn.disabled = !!validateClaim(menu, [...picked.armor], [...picked.weapons]);
    };
    const toggle = (card) => {
      const k = card.parentElement.dataset.k, set = picked[k], keep = k === 'armor' ? def.keepArmor : def.keepWeapons;
      if (set.has(card.dataset.id)) set.delete(card.dataset.id);
      else if (set.size < keep) set.add(card.dataset.id);
      else { sfx.denied(); orbitNotice(`You can only keep ${keep}. Deselect one first.`); return; }
      sfx.ui(); refresh();
    };
    el.querySelectorAll('.rw-pick').forEach((c) => {
      c.addEventListener('click', () => toggle(c));
      c.addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); toggle(c); } });
    });
    const close = () => { el.remove(); if (menuEl === el) menuEl = null; resolve(); };
    claimBtn.addEventListener('click', () => {
      const res = claimMenu(s, menu.id, [...picked.armor], [...picked.weapons]);
      if (res.error) { sfx.denied(); orbitNotice(res.error); return; }
      sfx.engram(4);
      orbitNotice(`Claimed ${res.items.map((i) => i.name).join(', ')}${res.sentToPostmaster ? `  ·  ${res.sentToPostmaster} sent to the Postmaster (inventory full)` : ''}`);
      close();
    });
    el.querySelector('#rw-later').addEventListener('click', () => { sfx.ui(); close(); });
    refresh();
  });
}

/** Plays each unlock in turn ({ kind, menu? } from rewards.unlockEvents), opening its reward menu after its animation. */
export async function runUnlocks(s, events) {
  for (const ev of events) {
    await playUnlock(ev.kind);
    if (ev.menu) await openRewardMenu(s, ev.menu);
  }
}

/** Reopens reward menus left unclaimed (the game was closed, or "Decide later"). Called when Orbit opens. */
export async function openPendingMenus(s) {
  if (rewardsOpen()) return;
  for (const menu of [...pendingMenus(s)]) {
    if (G.save !== s || !pendingMenus(s).includes(menu)) continue;
    await openRewardMenu(s, menu);
  }
}

/** Skip Campaign confirm for a Guardian class: warning plus a hold-to-confirm bar. */
export function openSkipConfirm(s, classId, onCancel) {
  if (!skipAvailableFor(s, classId)) throw new Error(`openSkipConfirm: Skip Campaign is not available for ${classId}`);
  const el = document.createElement('div');
  el.className = 'rw-ov skip';
  el.innerHTML = `
    <div class="rw-wrap narrow">
      <div class="rw-eyebrow">Skip Campaign</div>
      <h1 class="rw-title">Skip the base campaign?</h1>
      <p class="rw-sub">Every base mission counts as cleared and your Guardian jumps to the level a full clear reaches. You get a full set of Legendary gear at Light 200, and the Legendary unlock reward. <b>No mission drops are granted.</b> This cannot be undone.</p>
      <button class="rw-hold" id="rw-hold"><em></em><span>Hold to skip</span></button>
      <div class="rw-btns"><button class="btn ghost" id="rw-cancel">Cancel</button></div>
    </div>`;
  document.body.appendChild(el);
  const hold = el.querySelector('#rw-hold'), bar = hold.querySelector('em');
  let raf = 0, t0 = 0;
  const DUR = 1500;
  const stop = () => { cancelAnimationFrame(raf); raf = 0; bar.style.width = '0%'; };
  const start = () => {
    if (raf) return;
    t0 = performance.now();
    const tick = () => {
      const k = (performance.now() - t0) / DUR;
      bar.style.width = `${Math.min(100, k * 100)}%`;
      if (k < 1) { raf = requestAnimationFrame(tick); return; }
      raf = 0;
      confirmed();
    };
    raf = requestAnimationFrame(tick);
  };
  const confirmed = () => {
    el.remove();
    if (classId !== s.classId) switchCharacter(s, classId);
    const res = skipCampaign(s);
    sfx.engram(4);
    runUnlocks(s, [{ kind: 'legendary', menu: res.menu }]); // first, so showOrbit's pending-menu reopen sees the animation and waits
    showOrbit('character');
    if (res.levelUp) orbitNotice(`Level ${res.levelUp.from} to ${res.levelUp.to}`);
  };
  hold.addEventListener('pointerdown', start);
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) hold.addEventListener(ev, stop);
  hold.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) start(); } });
  hold.addEventListener('keyup', stop);
  el.querySelector('#rw-cancel').addEventListener('click', () => { stop(); el.remove(); onCancel?.(); });
}
