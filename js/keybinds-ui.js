// H27: the Controls screen in the pause menu. Pick a scheme, rebind any action (two binds each),
// keep up to three named custom schemes. Rules and data live in js/keybinds.js.
import { G } from './state.js';
import { writeSave } from './save.js';
import { esc } from './util.js';
import { sfx } from './audio.js';
import {
  ACTIONS, BIND_SLOTS, CUSTOM_SLOTS, PRESETS, presetBinds, sanitizeBinds, assign, usesOf, bindable, physLabel, cleanName, setLive,
} from './keybinds.js';

const byId = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));
const clone = (b) => sanitizeBinds(JSON.parse(JSON.stringify(b)));

/** Opens the editor inside `el` (the pause overlay). `back` re-renders the pause menu. */
export function openControls(el, back) {
  const s = G.save.settings;
  let capture = null; // { action, slot } while waiting for an input
  let pending = null; // { action, slot, phys, uses } while asking about a swap
  let note = '';

  const commit = (kb) => { s.keybinds = kb; setLive(kb); writeSave(G.save); };
  const edit = (patch) => commit({ ...s.keybinds, ...patch });
  const schemeName = (sc) => (sc === null ? 'Custom (unsaved)' : PRESETS[sc] ? PRESETS[sc].name : s.keybinds.slots[+sc[4]]?.name || 'Custom');

  function bindTo(action, slot, phys) {
    const { binds } = assign(s.keybinds.binds, action, slot, phys);
    edit({ binds, scheme: null });
  }

  G.bindCapture = null;
  function startCapture(action, slot) {
    capture = { action, slot }; pending = null; note = '';
    G.bindCapture = (phys) => {
      G.bindCapture = null;
      const c = capture; capture = null;
      if (phys === 'Escape') { render(); return; }
      if (!bindable(phys)) { note = `${physLabel(phys) || 'That key'} can't be bound. Esc is always Pause; Ctrl and Cmd make browser shortcuts (Ctrl+W closes the tab).`; sfx.denied?.(); render(); return; }
      const uses = usesOf(s.keybinds.binds, phys).filter((u) => !(u.action === c.action && u.slot === c.slot));
      if (uses.length) { pending = { ...c, phys, uses }; render(); return; }
      bindTo(c.action, c.slot, phys); sfx.ui?.(); render();
    };
    render();
  }

  function render() {
    const kb = s.keybinds;
    const groups = [...new Set(ACTIONS.map((a) => a.group))];
    const bindBtn = (a, i) => {
      const p = kb.binds[a.id][i];
      const live = capture && capture.action === a.id && capture.slot === i;
      return `<button class="kb-bind${live ? ' live' : ''}${p ? '' : ' empty'}" data-a="${a.id}" data-i="${i}" title="Click to rebind, right-click to clear">${live ? 'Press any key or button' : p ? esc(physLabel(p)) : 'Unbound'}</button>`;
    };
    const swapLine = pending ? `<div class="kb-swap"><span><kbd>${esc(physLabel(pending.phys))}</kbd> is already ${pending.uses.map((u) => esc(byId[u.action].label)).join(', ')}. Swap them?</span>
      <button class="btn primary" id="kb-swap-yes">Swap</button><button class="btn" id="kb-swap-no">Cancel</button></div>` : '';
    const scroll = el.querySelector('.kb-modal')?.scrollTop ?? 0; // keep the player's place when a rebind redraws the list
    el.innerHTML = `
    <div class="modal wide kb-modal">
      <div class="eyebrow">Pause menu</div>
      <h1 class="screen-title">Controls</h1>
      <div class="kb-schemes">
        ${Object.entries(PRESETS).map(([id, p]) => `<button class="btn kb-scheme${kb.scheme === id ? ' on' : ''}" data-preset="${id}">${esc(p.name)}</button>`).join('')}
        ${kb.slots.map((sl, i) => (sl ? `<button class="btn kb-scheme${kb.scheme === 'slot' + i ? ' on' : ''}" data-load="${i}">${esc(sl.name)}</button>` : '')).join('')}
      </div>
      <p class="desc">Scheme: <b id="kb-current">${esc(schemeName(kb.scheme))}</b>. Click a bind and press the new key, mouse button or scroll; right-click a bind to clear it. Esc cancels.</p>
      <label class="toggle-row kb-guard">Scroll guard <span class="hint">One weapon swap per swipe. Turn on for a Magic Mouse or trackpad.</span><input type="checkbox" id="kb-guard" ${kb.guard ? 'checked' : ''}></label>
      ${note ? `<div class="kb-note">${esc(note)}</div>` : ''}
      ${swapLine}
      <div class="kb-table">
        ${groups.map((g) => `<div class="kb-group">${esc(g)}</div>${ACTIONS.filter((a) => a.group === g).map((a) => `<div class="kb-row"><span>${esc(a.label)}</span>${Array.from({ length: BIND_SLOTS }, (_, i) => bindBtn(a, i)).join('')}</div>`).join('')}`).join('')}
        <div class="kb-group">Fixed</div><div class="kb-row"><span>Pause</span><span class="kb-fixed">Esc</span><span></span></div><div class="kb-row"><span>Look</span><span class="kb-fixed">Mouse</span><span></span></div>
      </div>
      <div class="kb-group">Saved schemes</div>
      <div class="kb-slots">${Array.from({ length: CUSTOM_SLOTS }, (_, i) => {
        const sl = kb.slots[i];
        return `<div class="kb-slot"><input type="text" maxlength="20" class="kb-name" data-i="${i}" placeholder="Custom ${i + 1}" value="${esc(sl?.name || '')}">
          <button class="btn" data-save="${i}">${sl ? 'Overwrite' : 'Save here'}</button>
          <button class="btn" data-load="${i}" ${sl ? '' : 'disabled'}>Load</button>
          <button class="btn danger" data-del="${i}" ${sl ? '' : 'disabled'}>Delete</button></div>`;
      }).join('')}</div>
      <div class="row-btns"><button class="btn primary" id="kb-back">Back</button></div>
    </div>`;

    el.querySelector('.kb-modal').scrollTop = scroll;
    el.querySelectorAll('.kb-bind').forEach((b) => {
      b.addEventListener('click', (e) => { e.stopPropagation(); if (!capture) startCapture(b.dataset.a, +b.dataset.i); });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); if (capture) return; bindTo(b.dataset.a, +b.dataset.i, null); render(); });
    });
    el.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
      const p = PRESETS[b.dataset.preset];
      edit({ scheme: b.dataset.preset, binds: presetBinds(b.dataset.preset), guard: p.guard }); note = ''; pending = null; sfx.ui?.(); render();
    }));
    el.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.load, sl = s.keybinds.slots[i];
      if (!sl) return;
      edit({ scheme: 'slot' + i, binds: clone(sl.binds), guard: sl.guard }); note = ''; pending = null; sfx.ui?.(); render();
    }));
    el.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.save;
      const name = cleanName(el.querySelector(`.kb-name[data-i="${i}"]`).value, i);
      const slots = s.keybinds.slots.slice();
      slots[i] = { name, binds: clone(s.keybinds.binds), guard: s.keybinds.guard };
      edit({ slots, scheme: 'slot' + i }); note = `Saved as "${name}".`; sfx.ui?.(); render();
    }));
    el.querySelectorAll('.kb-name').forEach((inp) => inp.addEventListener('change', () => {
      const i = +inp.dataset.i, sl = s.keybinds.slots[i];
      if (!sl) return; // an empty slot is named when it is saved
      const slots = s.keybinds.slots.slice();
      slots[i] = { ...sl, name: cleanName(inp.value, i) };
      edit({ slots }); render();
    }));
    el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.del;
      const slots = s.keybinds.slots.slice(); slots[i] = null;
      edit({ slots, scheme: s.keybinds.scheme === 'slot' + i ? null : s.keybinds.scheme }); note = 'Scheme deleted. Your current binds are unchanged.'; render();
    }));
    el.querySelector('#kb-guard').addEventListener('change', (e) => { edit({ guard: e.target.checked, scheme: null }); render(); });
    el.querySelector('#kb-swap-yes')?.addEventListener('click', () => { const p = pending; pending = null; bindTo(p.action, p.slot, p.phys); sfx.ui?.(); render(); });
    el.querySelector('#kb-swap-no')?.addEventListener('click', () => { pending = null; render(); });
    el.querySelector('#kb-back').addEventListener('click', close);
  }

  // Esc backs out one step: cancel a capture or swap, else return to the pause menu. Capture phase beats main.js.
  const onKey = (e) => {
    if (e.code !== 'Escape') return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (capture) { G.bindCapture = null; capture = null; render(); return; }
    if (pending) { pending = null; render(); return; }
    close();
  };
  addEventListener('keydown', onKey, true);
  function close() {
    G.bindCapture = null;
    removeEventListener('keydown', onKey, true);
    back();
  }
  render();
}
