// H27: the first-launch agreement (fan project, AI-built, as-is terms, privacy notice).
// A player must tick and accept it before playing. Stored on its own key, not in the save, so it applies
// before a Guardian exists and survives a save reset. Bump TERMS_VERSION when the text changes and
// everyone is asked again.
import { esc } from './util.js';

export const TERMS_VERSION = 1;
export const TERMS_KEY = 'afterlight-terms';
export const ISSUES_URL = 'https://github.com/bryce-and/afterlight/issues';

/** True when a stored acceptance covers the current text. */
export const termsCurrent = (stored, version = TERMS_VERSION) => Number.isInteger(stored?.v) && stored.v >= version;

let memo = null; // the acceptance for this tab when localStorage is blocked
const store = (() => { try { return globalThis.localStorage; } catch { return null; } })();
function readStored() {
  if (memo) return memo;
  try { return JSON.parse(store?.getItem(TERMS_KEY) || 'null'); } catch (e) { console.error('Could not read the terms acceptance:', e); return null; }
}
export const termsAccepted = () => termsCurrent(readStored());
export function acceptTerms(now = Date.now()) {
  memo = { v: TERMS_VERSION, at: now };
  try { store?.setItem(TERMS_KEY, JSON.stringify(memo)); } catch (e) { console.error('Could not store the terms acceptance; you will be asked again next visit.', e); }
}

/** The agreement text, as [heading, paragraphs] sections. */
export const TERMS_SECTIONS = [
  ['A fan project', [
    'Afterlight is a free, non-commercial fan project made for fun. It is inspired by Destiny and uses names from it.',
    'Afterlight is not made, approved, endorsed or sponsored by Bungie, Inc., and is not affiliated with Bungie or any of its partners. Destiny and related names and marks belong to Bungie, Inc. The game itself uses no Bungie artwork, models, audio or code: its models, effects and sounds are made from scratch in code.',
    'Afterlight is not sold, has no ads, and takes no payments or donations.',
  ]],
  ['Built with AI', [
    'Afterlight is "vibe coded": it was designed by a person and largely written with the help of AI coding tools. Expect rough edges, odd behaviour and bugs.',
  ]],
  ['Provided as is', [
    'Afterlight is provided "as is", without any warranty of any kind. It may crash, lose your progress, or stop being available at any time. You play at your own risk.',
    'To the fullest extent the law allows, the creator is not liable for any loss or damage that comes from playing it or not being able to play it.',
    'Play responsibly: take breaks, and stop if you feel unwell. The game has flashing effects.',
  ]],
  ['Privacy', [
    'No account, no sign-up, no analytics, no ads, no tracking cookies. The creator does not collect or receive your personal information.',
    'Your progress and settings are saved only in this browser (local storage). Clearing your browser data deletes them.',
    'The game loads fonts from Google Fonts and code from the jsDelivr CDN. Like any website, those services see your IP address when they send files to your browser.',
    'Co-op (Fireteam) is optional. It connects players directly (WebRTC) using the free PeerJS service to find each other. When you join a fireteam, PeerJS and your teammates can see your IP address, and teammates see your Guardian name, class, Light and level. Only play with people you trust.',
    'Afterlight is hosted on GitHub Pages; GitHub\'s own privacy policy covers its servers.',
  ]],
  ['Questions and requests', [
    `Questions, bug reports, privacy concerns or rights-holder requests: open an issue at ${ISSUES_URL}. Requests from rights holders will be dealt with promptly, including taking content down.`,
  ]],
];

const linkify = (t) => esc(t).replace(esc(ISSUES_URL), `<a href="${ISSUES_URL}" target="_blank" rel="noopener">${esc(ISSUES_URL)}</a>`);

/**
 * Shows the agreement over everything. `required`: a first launch (or new version); it can only be
 * accepted, and `onAccept` runs after. Otherwise it is read-only with a Close button (and Esc).
 */
export function openTerms({ required = false, onAccept = null } = {}) {
  if (document.getElementById('terms')) return;
  const el = document.createElement('div');
  el.id = 'terms';
  el.className = 'screen overlay';
  el.innerHTML = `
    <div class="modal wide terms-modal" role="dialog" aria-modal="true" aria-labelledby="terms-title">
      <div class="eyebrow">Afterlight</div>
      <h1 class="screen-title" id="terms-title">Terms &amp; Privacy</h1>
      ${required ? '<p class="desc">Please read and accept this before you play.</p>' : ''}
      <div class="terms-body">${TERMS_SECTIONS.map(([h, ps]) => `<h2>${esc(h)}</h2>${ps.map((p) => `<p>${linkify(p)}</p>`).join('')}`).join('')}</div>
      ${required ? `<label class="terms-ack"><input type="checkbox" id="terms-ok"> I have read this. I understand Afterlight is an unofficial, AI-built fan project provided as is, and I agree to these terms and the privacy notice.</label>
      <div class="row-btns"><button class="btn primary" id="terms-go" disabled>Accept and continue</button></div>`
    : '<div class="row-btns"><button class="btn primary" id="terms-close">Close</button></div>'}
    </div>`;
  // clicks inside must not reach the title screen (a click there starts the game)
  for (const t of ['click', 'mousedown']) el.addEventListener(t, (e) => e.stopPropagation());
  document.body.appendChild(el);
  const onKey = (e) => {
    if (e.code !== 'Escape') return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (!required) close();
  };
  addEventListener('keydown', onKey, true);
  function close() { removeEventListener('keydown', onKey, true); el.remove(); }
  if (required) {
    const ok = el.querySelector('#terms-ok'), go = el.querySelector('#terms-go');
    ok.addEventListener('change', () => { go.disabled = !ok.checked; });
    go.addEventListener('click', () => { if (!ok.checked) return; acceptTerms(); close(); onAccept?.(); });
  } else el.querySelector('#terms-close').addEventListener('click', close);
}
