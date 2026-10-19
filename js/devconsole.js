// Secret dev console. Tap / three times to open it, Esc to close it.
// Not mentioned in the Update Log or Roadmap on purpose. Commands live in devcommands.js.
import { G, unlockPointer } from './state.js';
import { addItem, writeSave } from './save.js';
import { runCommand, completions } from './devcommands.js';
import * as ui from './ui.js';

const TAPS = 3, TAP_WINDOW_MS = 1200;
let taps = [];
let box = null; // { el, input, out, close }

function css() {
  if (document.getElementById('devcon-css')) return;
  const s = document.createElement('style');
  s.id = 'devcon-css';
  s.textContent = `#devcon{position:fixed;left:0;right:0;bottom:0;z-index:99999;background:rgba(8,10,14,.92);border-top:1px solid #4d8fe0;padding:10px 16px;font:14px/1.5 ui-monospace,Menlo,monospace;color:#d8e0ea}
#devcon .dc-out{min-height:1.5em;white-space:pre-wrap;color:#9fb0c4}#devcon .dc-out.err{color:#ff8a7a}#devcon .dc-out.ok{color:#8fd694}
#devcon .dc-row{display:flex;gap:8px;align-items:center}#devcon input{flex:1;background:transparent;border:0;outline:0;color:#fff;font:inherit}`;
  document.head.appendChild(s);
}

function say(msg, cls) {
  box.out.textContent = msg;
  box.out.className = `dc-out ${cls || ''}`;
}

function grant(item) {
  const dropped = addItem(G.save, item);
  writeSave(G.save);
  ui.lootToast(item);
  if (dropped) ui.feed(`Inventory full: auto-dismantled ${dropped.name}`, '#aaa');
}

function open() {
  if (box || G.state === 'title' || !G.save) return;
  css();
  const el = document.createElement('div');
  el.id = 'devcon';
  el.innerHTML = '<div class="dc-out"></div><div class="dc-row"><span>&gt;</span><input type="text" spellcheck="false" autocomplete="off" /></div>';
  document.body.appendChild(el);
  const input = el.querySelector('input');
  const out = el.querySelector('.dc-out');
  const history = [];
  let hi = 0, tab = null; // tab: { options, i } while cycling Tab completions
  input.addEventListener('keydown', (e) => {
    e.stopPropagation(); // the game must not see typing
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!tab) {
        const options = completions(input.value);
        if (!options.length) return;
        tab = { options, i: -1 };
      }
      tab.i = (tab.i + 1) % tab.options.length;
      input.value = tab.options[tab.i];
      if (tab.options.length > 1) say(tab.options.map((o, i) => (i === tab.i ? `[${o.trim()}]` : o.trim())).slice(0, 8).join('   '));
      return;
    }
    if (e.key === 'Enter') {
      const line = input.value.trim();
      if (!line) return;
      history.push(line); hi = history.length;
      let r;
      try { r = runCommand(line, { save: G.save, grant }); } catch (err) { console.error(err); r = { ok: false, msg: `Error: ${err.message}` }; }
      say(r.msg, r.ok ? 'ok' : 'err');
      input.value = '';
    } else if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault(); hi = Math.max(0, hi - 1); input.value = history[hi];
    } else if (e.key === 'ArrowDown' && history.length) {
      e.preventDefault(); hi = Math.min(history.length, hi + 1); input.value = history[hi] || '';
    }
  });
  input.addEventListener('input', () => { tab = null; }); // any edit (typing, paste, delete) restarts Tab cycling
  input.addEventListener('keyup', (e) => e.stopPropagation());
  const wasPlaying = G.state === 'playing';
  box = {
    el, input, out,
    close() {
      el.remove();
      box = null;
      // opening released the mouse, which paused the game; closing hands it back
      if (wasPlaying && (G.state === 'paused' || G.mpMenu)) ui.resumeGame();
    },
  };
  say('Dev console. /give <name>   /gamerule <rule>   /playerlevel <n>   (Tab completes, Esc closes)');
  if (wasPlaying && !G.mpMenu) unlockPointer();
  input.focus();
}

// Capture phase on window, registered at import, so the gesture and Esc win over every other handler.
addEventListener('keydown', (e) => {
  if (box) {
    if (e.code === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); box.close(); }
    return;
  }
  if (e.code !== 'Slash' || e.repeat || e.shiftKey || e.metaKey || e.altKey || e.ctrlKey) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable) { taps = []; return; } // typing a name or code is not the gesture
  const now = performance.now();
  taps = taps.filter((t) => now - t < TAP_WINDOW_MS);
  taps.push(now);
  e.preventDefault();
  if (taps.length >= TAPS) { taps = []; open(); }
}, true);
