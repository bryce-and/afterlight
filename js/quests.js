// U16 "The Last City": quests, per Guardian. Pure data and lookups (no scene) so tools/tests.js can check them.
// The campaign is quest #1 on every Guardian and cannot be abandoned. The framework supports other quests
// (an abandonable quest is dropped to the Quest Kiosk in the Tower and picked up again there).
// State lives in `s.quests` (swapped per Guardian in save.js): { active: [ids], dropped: [ids], talked: { stopId: [npcIds] }, done: [ids] }.
import { LOCATIONS } from './data.js';

/** Who can give a Tower talk, and where they stand (the Tower map's TOWER_SPOTS has the coordinates). */
export const TOWER_NPCS = ['zavala', 'ikora', 'cayde'];

/**
 * Tower stops (D1 style: you report to the Vanguard between acts). Stop `id` is due once destination `after` is
 * finished; it is done when every listed NPC has been spoken to. The destination after `after` stays closed until then.
 */
export const TOWER_STOPS = [
  { id: 'earth',   after: 'earth',   npcs: ['zavala', 'ikora', 'cayde'], text: 'Report to the Vanguard in the Tower' },
  { id: 'moon',    after: 'moon',    npcs: ['ikora'],                    text: 'Speak to Ikora Rey in the Tower' },
  { id: 'mars',    after: 'mars',    npcs: ['zavala', 'ikora'],          text: 'Speak to Zavala and Ikora in the Tower' },
  { id: 'io',      after: 'io',      npcs: ['zavala'],                   text: 'Speak to Zavala in the Tower' },
  { id: 'titan',   after: 'titan',   npcs: ['cayde'],                    text: 'Speak to Cayde-6 in the Tower' },
  { id: 'tangled', after: 'tangled', npcs: ['ikora'],                    text: 'Speak to Ikora Rey in the Tower' },
  { id: 'dc',      after: 'dc',      npcs: ['zavala', 'ikora', 'cayde'], text: 'Report to the Vanguard before the Leviathan' },
];

/** Quest definitions. `abandonable: false` quests can never be dropped. Future quests (exotic missions) add entries here. */
export const QUESTS = {
  campaign: { id: 'campaign', name: 'The Ghost\'s Story', desc: 'Follow the Ghost from the Cosmodrome to the Emperor\'s Throne.', abandonable: false },
};

const locIndex = (id) => LOCATIONS.findIndex((l) => l.id === id);
const lastMission = (li) => LOCATIONS[li].missions[LOCATIONS[li].missions.length - 1];

export function newQuests() {
  return { active: ['campaign'], dropped: [], talked: {}, done: [] };
}

/** Makes sure a save (or a bare test object) has the quest state; every Guardian carries the campaign. */
export function ensureQuests(s) {
  const q = s.quests && typeof s.quests === 'object' ? s.quests : (s.quests = newQuests());
  if (!Array.isArray(q.active)) q.active = [];
  if (!Array.isArray(q.dropped)) q.dropped = [];
  if (!q.talked || typeof q.talked !== 'object') q.talked = {};
  if (!Array.isArray(q.done)) q.done = [];
  if (!q.active.includes('campaign') && !q.done.includes('campaign')) { q.dropped = q.dropped.filter((id) => id !== 'campaign'); q.active.unshift('campaign'); }
  return q;
}

/** The destination is finished when its last mission is cleared. */
export function destFinished(s, destId) {
  const li = locIndex(destId);
  return li >= 0 && !!(s.cleared || {})[lastMission(li).id];
}

/** A stop is done when every NPC has been spoken to, or when the Guardian already moved past it (a save from before the Tower). */
export function stopDone(s, stop) {
  const q = ensureQuests(s), li = locIndex(stop.after);
  const next = LOCATIONS[li + 1];
  if (next && next.missions.some((m) => (s.cleared || {})[m.id])) return true;
  const talked = q.talked[stop.id] || [];
  return stop.npcs.every((n) => talked.includes(n));
}

/** The stop the Guardian owes a visit to right now (destination finished, not yet debriefed), or null. */
export function dueStop(s) {
  for (const st of TOWER_STOPS) if (destFinished(s, st.after) && !stopDone(s, st)) return st;
  return null;
}

/** NPCs still to see at a stop. */
export function stopRemaining(s, stop) {
  const talked = ensureQuests(s).talked[stop.id] || [];
  return stop.npcs.filter((n) => !talked.includes(n));
}

/** True when the destination at index li may be started (the Tower stop before it is done). Index 0 is always open. */
export function actOpen(s, li) {
  if (li <= 0) return true;
  const stop = TOWER_STOPS.find((st) => st.after === LOCATIONS[li - 1].id);
  return !stop || !destFinished(s, stop.after) || stopDone(s, stop);
}

/** Why a destination's first mission is locked by the Tower, or '' when the Tower is not the reason. */
export function towerLockReason(s, li) {
  const stop = li > 0 ? TOWER_STOPS.find((st) => st.after === LOCATIONS[li - 1].id) : null;
  if (!stop || actOpen(s, li) || !destFinished(s, stop.after)) return '';
  return `${stop.text}. The Tower is open from Orbit.`;
}

/** Speaking to an NPC. Returns { lines, first, stopDone } where lines come from the caller's script; records the talk when it counts. */
export function talkTo(s, npcId) {
  const q = ensureQuests(s), stop = dueStop(s);
  if (!stop || !stop.npcs.includes(npcId)) return { counted: false, stop: null, finished: false };
  const talked = q.talked[stop.id] || (q.talked[stop.id] = []);
  if (talked.includes(npcId)) return { counted: false, stop, finished: false };
  talked.push(npcId);
  return { counted: true, stop, finished: stopDone(s, stop) };
}

/** Does this NPC have something to say that counts (a quest marker over their head)? */
export function npcHasQuest(s, npcId) {
  const st = dueStop(s);
  return !!st && stopRemaining(s, st).includes(npcId);
}

/** The next campaign mission to play (first uncleared, in order), or null at the end. */
export function nextCampaignMission(s) {
  for (let li = 0; li < LOCATIONS.length; li++) for (const m of LOCATIONS[li].missions) if (!(s.cleared || {})[m.id]) return { li, m, loc: LOCATIONS[li] };
  return null;
}

/** Rows for the Quests tab: { quest, state: 'active'|'dropped'|'done', step, place, log[] }. */
export function questList(s) {
  const q = ensureQuests(s);
  const rows = [];
  for (const id of [...q.active, ...q.dropped, ...q.done]) {
    const def = QUESTS[id];
    if (!def) continue;
    const state = q.active.includes(id) ? 'active' : q.dropped.includes(id) ? 'dropped' : 'done';
    rows.push({ quest: def, state, ...(id === 'campaign' ? campaignView(s) : { step: '', place: '', log: [] }) });
  }
  return rows;
}

function campaignView(s) {
  const stop = dueStop(s), next = nextCampaignMission(s);
  const log = [];
  for (let li = 0; li < LOCATIONS.length; li++) {
    const loc = LOCATIONS[li];
    for (const m of loc.missions) if ((s.cleared || {})[m.id]) log.push(`Cleared ${m.name} (${loc.planetName})`);
    const st = TOWER_STOPS.find((x) => x.after === loc.id);
    if (st && destFinished(s, loc.id) && stopDone(s, st)) log.push(`Reported to the Tower after ${loc.planetName}`);
  }
  if (stop) return { step: stop.text, place: 'The Tower', npcs: stopRemaining(s, stop), log };
  if (next) return { step: `${next.m.name}: ${next.m.desc}`, place: `${next.loc.planetName}, from the Director`, npcs: [], log };
  return { step: 'The campaign is complete.', place: '', npcs: [], log };
}

/** Drops a quest to the kiosk. Refuses a quest that cannot be abandoned (the campaign). Returns an error string or null. */
export function abandonQuest(s, id) {
  const q = ensureQuests(s), def = QUESTS[id];
  if (!def) return 'No such quest.';
  if (!def.abandonable) return 'This quest cannot be abandoned.';
  if (!q.active.includes(id)) return 'That quest is not active.';
  q.active = q.active.filter((x) => x !== id);
  q.dropped.push(id);
  return null;
}

/** Picks a dropped quest back up at the Quest Kiosk. Returns an error string or null. */
export function pickUpQuest(s, id) {
  const q = ensureQuests(s);
  if (!q.dropped.includes(id)) return 'That quest is not available here.';
  q.dropped = q.dropped.filter((x) => x !== id);
  q.active.push(id);
  return null;
}
