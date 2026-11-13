// H27 "This is for you, Nathan!": rebindable controls.
// Gameplay code reads fixed canonical inputs (G.input.keys.KeyQ, G.input.mouse.right, G.input.mouse.wheel).
// This module maps whatever the player physically presses onto those canonical inputs, so a rebind
// needs no change anywhere else (co-op relays, sparrow, tower and every prompt keep working).
// Physical ids: a KeyboardEvent.code ('KeyQ', 'Space'), 'Mouse0'..'Mouse4' (button), 'WheelUp' / 'WheelDown'.
// Targets: a canonical key code, 'mouse:left', 'mouse:right', or 'wheel:1' / 'wheel:-1' (next / previous weapon).

/** Every rebindable action, in menu order. `target` is what gameplay reads. */
export const ACTIONS = [
  { id: 'forward', label: 'Move forward', target: 'KeyW', group: 'Movement' },
  { id: 'back', label: 'Move back', target: 'KeyS', group: 'Movement' },
  { id: 'left', label: 'Move left', target: 'KeyA', group: 'Movement' },
  { id: 'right', label: 'Move right', target: 'KeyD', group: 'Movement' },
  { id: 'sprint', label: 'Sprint', target: 'ShiftLeft', group: 'Movement' },
  { id: 'jump', label: 'Jump / class jump', target: 'Space', group: 'Movement' },
  { id: 'fire', label: 'Fire', target: 'mouse:left', group: 'Weapons' },
  { id: 'ads', label: 'Aim down sights', target: 'mouse:right', group: 'Weapons' },
  { id: 'reload', label: 'Reload', target: 'KeyR', group: 'Weapons' },
  { id: 'weapon1', label: 'Kinetic weapon', target: 'Digit1', group: 'Weapons' },
  { id: 'weapon2', label: 'Energy weapon', target: 'Digit2', group: 'Weapons' },
  { id: 'weapon3', label: 'Power weapon', target: 'Digit3', group: 'Weapons' },
  { id: 'nextWeapon', label: 'Next weapon', target: 'wheel:1', group: 'Weapons' },
  { id: 'prevWeapon', label: 'Previous weapon', target: 'wheel:-1', group: 'Weapons' },
  { id: 'grenade', label: 'Grenade', target: 'KeyQ', group: 'Abilities' },
  { id: 'melee', label: 'Melee', target: 'KeyB', group: 'Abilities' },
  { id: 'charged', label: 'Charged melee ability', target: 'KeyV', group: 'Abilities' },
  { id: 'classAbility', label: 'Class ability', target: 'KeyC', group: 'Abilities' },
  { id: 'super', label: 'Super', target: 'KeyF', group: 'Abilities' },
  { id: 'interact', label: 'Interact / revive', target: 'KeyE', group: 'General' },
  { id: 'ghost', label: 'Ghost', target: 'Tab', group: 'General' },
  { id: 'orbit', label: 'Go to Orbit (Ghost, hold)', target: 'KeyO', group: 'General' },
  { id: 'character', label: 'Character (gear, mods, vault)', target: 'KeyI', group: 'General' },
];
export const ACTION_IDS = ACTIONS.map((a) => a.id);
const BY_ID = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));
/** Binds per action: a primary and an alternate. */
export const BIND_SLOTS = 2;
/** Named custom schemes a player can keep. */
export const CUSTOM_SLOTS = 3;

// Keys that can never be bound: Esc is always Pause; Ctrl and Cmd combine with movement keys into browser
// shortcuts the page cannot block (Ctrl+W, Cmd+W close the tab), and on a Mac Ctrl+click is a right-click.
export const RESERVED = new Set(['Escape', 'ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight', 'ContextMenu', 'CapsLock', 'Fn', 'FnLock']);
const PHYS_RE = /^(Key[A-Z]|Digit[0-9]|Numpad[A-Za-z0-9]+|F([1-9]|1[0-2])|Arrow(Up|Down|Left|Right)|Shift(Left|Right)|Alt(Left|Right)|Space|Tab|Enter|Backspace|Backquote|Minus|Equal|Bracket(Left|Right)|Backslash|Semicolon|Quote|Comma|Period|Slash|IntlBackslash|Insert|Delete|Home|End|PageUp|PageDown|Mouse[0-4]|Wheel(Up|Down))$/;
/** A physical input the game accepts as a bind. */
export const bindable = (p) => typeof p === 'string' && PHYS_RE.test(p) && !RESERVED.has(p);

const KEYBOARD = {
  forward: ['KeyW'], back: ['KeyS'], left: ['KeyA'], right: ['KeyD'], sprint: ['ShiftLeft'], jump: ['Space'],
  fire: ['Mouse0'], ads: ['Mouse2'], reload: ['KeyR'], weapon1: ['Digit1'], weapon2: ['Digit2'], weapon3: ['Digit3'],
  nextWeapon: ['WheelDown'], prevWeapon: ['WheelUp'],
  grenade: ['KeyQ'], melee: ['KeyB'], charged: ['KeyV'], classAbility: ['KeyC'], super: ['KeyF'],
  interact: ['KeyE'], ghost: ['Tab'], orbit: ['KeyO'], character: ['KeyI'],
};
// Magic Mouse / trackpad: one click is Fire. Aim works from a held X as well as a two-finger (secondary) click,
// since a Magic Mouse's right side is off by default. Melee moves next to the left hand (G), and weapon
// switching keeps the swipe but behind the scroll guard, with T as a key for Next weapon.
const TRACKPAD = {
  ...KEYBOARD,
  ads: ['KeyX', 'Mouse2'], melee: ['KeyG'], nextWeapon: ['KeyT', 'WheelDown'],
};
/** Built-in schemes. `guard` turns on the scroll guard (one weapon swap per swipe). */
export const PRESETS = {
  keyboard: { name: 'Keyboard and mouse', binds: KEYBOARD, guard: false },
  trackpad: { name: 'Magic Mouse / trackpad', binds: TRACKPAD, guard: true },
};

const pad = (arr) => { const a = (Array.isArray(arr) ? arr : []).slice(0, BIND_SLOTS); while (a.length < BIND_SLOTS) a.push(null); return a; };
const cloneBinds = (b) => Object.fromEntries(ACTION_IDS.map((id) => [id, pad(b?.[id])]));
export const presetBinds = (id) => cloneBinds(PRESETS[id].binds);

/** Cleans a bind table from a save: unknown actions dropped, bad or reserved inputs cleared, duplicates removed, missing actions take the Keyboard default. */
export function sanitizeBinds(raw) {
  const out = {}, seen = new Set();
  for (const id of ACTION_IDS) {
    const given = raw && typeof raw === 'object' && Array.isArray(raw[id]) ? raw[id] : null;
    const src = given ?? KEYBOARD[id];
    out[id] = pad(src.map((p) => (bindable(p) && !seen.has(p) ? (seen.add(p), p) : null)));
  }
  return out;
}

/** The settings.keybinds shape: { scheme, binds, guard, slots }. scheme is 'keyboard' | 'trackpad' | 'slot0..2' | null (edited, unsaved). */
export function defaultKeybinds() { return { scheme: 'keyboard', binds: presetBinds('keyboard'), guard: false, slots: Array(CUSTOM_SLOTS).fill(null) }; }
export function sanitizeKeybinds(raw) {
  const d = defaultKeybinds();
  if (!raw || typeof raw !== 'object') return d;
  const slots = Array.from({ length: CUSTOM_SLOTS }, (_, i) => {
    const s = Array.isArray(raw.slots) ? raw.slots[i] : null;
    if (!s || typeof s !== 'object') return null;
    return { name: cleanName(s.name, i), binds: sanitizeBinds(s.binds), guard: !!s.guard };
  });
  const okScheme = (sc) => sc === null || PRESETS[sc] || (/^slot[0-2]$/.test(sc) && slots[+sc[4]]);
  return { scheme: okScheme(raw.scheme) ? raw.scheme : null, binds: sanitizeBinds(raw.binds), guard: !!raw.guard, slots };
}
export const cleanName = (n, i = 0) => (typeof n === 'string' && n.trim() ? n.trim().slice(0, 20) : `Custom ${i + 1}`);

/** Where a physical input is already bound: [{ action, slot }]. */
export function usesOf(binds, phys) {
  const out = [];
  for (const id of ACTION_IDS) binds[id].forEach((p, slot) => { if (p === phys) out.push({ action: id, slot }); });
  return out;
}

/**
 * Binds `phys` to `action` at `slot`. If another action already uses it, that action takes this
 * action's old bind (a swap). Returns { binds, swapped: [{ action, slot }] }; `binds` is a new table.
 */
export function assign(binds, action, slot, phys) {
  if (!BY_ID[action] || slot < 0 || slot >= BIND_SLOTS) throw new Error(`assign: bad action or slot ${action}/${slot}`);
  if (phys !== null && !bindable(phys)) throw new Error(`assign: ${phys} cannot be bound`);
  const b = cloneBinds(binds);
  const old = b[action][slot];
  const swapped = phys === null ? [] : usesOf(b, phys).filter((u) => !(u.action === action && u.slot === slot));
  for (const u of swapped) b[u.action][u.slot] = old ?? null;
  b[action][slot] = phys;
  return { binds: b, swapped };
}

/** physical id -> list of targets, for the input layer. */
export function buildLookup(binds) {
  const m = new Map();
  for (const id of ACTION_IDS) for (const p of binds[id]) if (p) { if (!m.has(p)) m.set(p, []); m.get(p).push(BY_ID[id].target); }
  return m;
}

/** The physical id of a mouse event. On a Mac a Ctrl+click is the secondary click, so it counts as the right button. */
export const mousePhys = (button, ctrlKey = false, mac = false) => (button === 0 && ctrlKey && mac ? 'Mouse2' : `Mouse${button}`);

// Scroll guard: a trackpad or Magic Mouse swipe sends dozens of small wheel events plus momentum.
// With the guard on, the deltas add up until they pass `step` px, then one swap fires and the wheel is
// ignored until it has been quiet for `quiet` ms (the end of the swipe and its momentum).
export const WHEEL_GUARD = { step: 40, quiet: 220 };
export const wheelState = () => ({ acc: 0, last: -1e9, locked: false });
/** Returns -1 (up), 1 (down) or 0 for one wheel event. Without the guard every event counts (the old behaviour). */
export function wheelStep(st, deltaY, now, guard) {
  if (!deltaY) return 0;
  if (!guard) return Math.sign(deltaY);
  const idle = now - st.last > WHEEL_GUARD.quiet;
  st.last = now;
  if (idle) { st.acc = 0; st.locked = false; }
  if (st.locked) return 0;
  if (Math.sign(st.acc) !== Math.sign(deltaY)) st.acc = 0;
  st.acc += deltaY;
  if (Math.abs(st.acc) < WHEEL_GUARD.step) return 0;
  st.locked = true;
  return Math.sign(st.acc);
}

const NAMED = {
  Space: 'Space', Tab: 'Tab', Enter: 'Enter', Backspace: 'Backspace', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', AltLeft: 'L-Alt', AltRight: 'R-Alt',
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', IntlBackslash: '§',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Insert: 'Ins', Delete: 'Del', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn',
  Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5', WheelUp: 'Wheel ↑', WheelDown: 'Wheel ↓',
};
/** Short label for a physical input ('KeyQ' -> 'Q'). */
export function physLabel(p) {
  if (!p) return '';
  if (NAMED[p]) return NAMED[p];
  if (/^Key[A-Z]$/.test(p)) return p.slice(3);
  if (/^Digit[0-9]$/.test(p)) return p.slice(5);
  if (p.startsWith('Numpad')) return 'Num ' + p.slice(6);
  return p;
}
/** Label for an action's binds, e.g. 'E' or 'X / RMB'; 'Unbound' when it has none. */
export const actionLabel = (binds, id) => binds[id].filter(Boolean).map(physLabel).join(' / ') || 'Unbound';

/** The controls list the pause menu and subclass screen show, built from the live binds. */
export function controlsList(binds) {
  const L = (id) => actionLabel(binds, id);
  return [
    [`${L('forward')} ${L('left')} ${L('back')} ${L('right')}`, 'Move'], [L('sprint'), 'Sprint'], [L('jump'), 'Jump / class jump'], ['Mouse', 'Look'],
    [L('fire'), 'Fire'], [L('ads'), 'Aim down sights'], [L('reload'), 'Reload'],
    [`${L('weapon1')} ${L('weapon2')} ${L('weapon3')} / ${L('nextWeapon')}`, 'Switch weapon'],
    [L('grenade'), 'Grenade'], [L('melee'), 'Melee'], [`Hold ${L('interact')}`, 'Revive a teammate'], [L('charged'), 'Charged melee ability'],
    [L('classAbility'), 'Class ability'], [L('super'), 'Super'], [L('interact'), 'Interact'], [L('ghost'), 'Ghost'],
    [L('character'), 'Character (gear, mods, vault)'], ['Esc', 'Pause'],
  ];
}

// ---------- live binds ----------
// The input layer (main.js) and on-screen prompts read the active binds from here; the pause menu calls
// setLive whenever the player changes them.
const live = { kb: defaultKeybinds(), lookup: buildLookup(defaultKeybinds().binds) };
export function setLive(kb) { live.kb = kb; live.lookup = buildLookup(kb.binds); }
/** Points the live binds at a save's keybinds when the save (or its table) changed; cheap, called per input event. */
export function syncLive(kb) { if (kb && kb !== live.kb) setLive(kb); }
export const liveKeybinds = () => live.kb;
/** Targets a physical input drives right now ([] when unbound). */
export const liveTargets = (phys) => live.lookup.get(phys) || [];
/** Label of an action under the active binds, for prompts like '[E]  Open Cache'. */
export const keyName = (id) => actionLabel(live.kb.binds, id);
