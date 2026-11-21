// U33 Transmissions: the cutscenes. Each scene is a list of steps played in order on the sets in js/cutscene-sets.js:
//   set      switch to that stage            line     [speaker key, text] spoken with its subtitle (the step lasts as long as the voice)
//   dur      seconds, for a step with no line cam     a camera move: {a:[px,py,pz,lx,ly,lz], b:[...]} eased, or a set camera name, or (k, set) => [...]
//   name     tells the set what to animate   fn       runs once when the step starts
// Lines must exist in js/voice-data.js (a test checks it). The Tower debriefs are built from TOWER_TALKS so the story stays in one place.
import { TOWER_TALKS } from './story.js';
import { TOWER_STOPS } from './quests.js';

const lerp = (a, b, k) => a + (b - a) * k;
const L = (who, text) => [who, text];

const GL = L('ghost', "Look at this Glimmer from the Devils' Lair. The data signature is Cabal.");

/** The Ghost's arrival at the Tower and the walk to the Vanguard (the first time the Guardian comes home). */
const arrival = () => [
  { set: 'sky', name: 'fly', line: L('ghost', 'There it is. The Last City. And the Traveler, right where we left it.'), cam: (k, S) => [-4, 4.5, 24, S.ship.position.x, S.ship.position.y + 1, S.ship.position.z] },
  { name: 'land', line: L('ghost', 'Take your time. Look around. Everything is going to feel new.'), cam: { a: [0.4, 1.75, 8, 2.2, 1.5, -6], b: [6.8, 1.9, 5.5, 1, 2.2, -14] }, min: 5 },
  { name: 'walk', line: L('ghost', 'The Vanguard are waiting. Come on.'), cam: { a: [0, 1.5, -6, 1.6, 1.6, 0], b: [1, 1.7, -5, 1, 1.6, 1] } },
];

const talk = (stop, npc) => (TOWER_TALKS[stop]?.[npc] || []).map(([who, text]) => ({ line: L(who, text), cam: who === 'ghost' ? 'ghost' : who }));
const room = (steps) => [{ set: 'room', name: 'wide', dur: 2.2, cam: 'wide' }, ...steps];

/** A debrief for one Tower stop: everyone at the stop speaks their lines in order. */
function debrief(stopId, lead = []) {
  const stop = TOWER_STOPS.find((s) => s.id === stopId);
  return { music: 'tower', steps: [...lead, ...room(stop.npcs.flatMap((n) => talk(stopId, n)))] };
}

export const SCENES = {
  /** 1. Ghost finds the Guardian in a Cosmodrome car wreck and brings them back (the game's opening). */
  opening: () => ({
    music: 'earth',
    steps: [
      { set: 'wreck', name: 'enter', line: L('ghost', 'Come on. Come on. Where are you?'), cam: { a: [-8, 4.4, 10, 0, 0.8, 0], b: [-6, 3.2, 8, 0, 0.7, 0] }, ghost: (k) => [lerp(-9, -2.5, k), lerp(6, 2.4, k), lerp(7, 2.8, k)], min: 4 },
      { name: 'scan', line: L('ghost', 'There. The signal is faint, but it is there.'), beam: true, cam: { a: [3.5, 1.2, 3.4, 0, 0.4, -0.2], b: [2.2, 1.0, 2.4, 0, 0.4, -0.3] }, ghost: (k) => [lerp(-2.5, 1.2, k), lerp(2.4, 1.7, k), lerp(2.8, 0.9, k)] },
      { name: 'find', line: L('ghost', 'Found you. You have been out here a very long time.'), ghostLook: [0, 0.35, -0.85], cam: { a: [0.9, 0.7, -2.6, 0, 0.35, -0.7], b: [0.6, 0.6, -2.0, 0, 0.35, -0.8] }, ghost: (k) => [lerp(0.9, 0.45, k), lerp(1.2, 1.05, k), lerp(-0.4, -1.1, k)], glow: 1.6 },
      { name: 'close', line: L('ghost', 'I do not know if this will work. I just know I am not leaving you.'), ghostLook: [0, 0.35, -0.85], glow: 2.4, cam: (k, S) => [S.gh.position.x + 0.5, S.gh.position.y + 0.1, S.gh.position.z + 1.5 - k * 0.3, S.gh.position.x, S.gh.position.y, S.gh.position.z], ghost: () => [0.45, 1.05, -1.1] },
      { name: 'rise', line: L('ghost', 'Wake up, Guardian. Wake up.'), glow: 4, ghostLook: [0, 0.6, -0.5], min: 5, cam: { a: [-2.6, 1.0, 2.4, 0, 0.5, -0.2], b: [-1.9, 1.7, 3.2, 0, 1.0, -0.4] }, ghost: (k) => [lerp(0.45, 0.6, k), lerp(1.05, 1.9, k), lerp(-1.1, -0.3, k)] },
      { name: 'stand', dur: 3.2, glow: 1.2, ghostLook: [0, 1.6, 0], cam: { a: [1.6, 0.9, 3.2, 0, 1.2, 0], b: [1.2, 1.3, 3.8, 0, 1.5, 0] }, ghost: () => [0.7, 1.95, 0.4] },
    ],
  }),

  /** 2 and 3. The jumpship arrives, the Guardian meets the Vanguard, and the Ghost shows them the Cabal Glimmer. */
  debrief_earth: () => {
    const z = talk('earth', 'zavala'), i = talk('earth', 'ikora'), c = talk('earth', 'cayde');
    return {
      music: 'tower',
      steps: [
        ...arrival(),
        ...room([
          ...z,
          { line: GL, cam: 'glimmer', glimmer: 'move', name: 'show' },
          { line: L('zavala', 'Cabal Glimmer, in Fallen hands.'), cam: 'zavala', glimmer: true },
          { line: L('ikora', 'Let me see that.'), cam: 'ikora', glimmer: true },
          { ...i[1], glimmer: true }, // "Somebody is paying them..." (her first line is what the Ghost just showed)
          { line: L('cayde', 'Cabal money in Fallen pockets. That is never good news.'), cam: 'cayde' },
          ...c,
        ]),
      ],
    };
  },
  debrief_mars: () => debrief('mars'),
  debrief_dc: () => debrief('dc'),

  /** 6. Mara Sov receives the Guardian before the Spine of Keres. */
  throne: () => ({
    music: 'dc',
    steps: [
      { set: 'throne', name: 'approach', dur: 4.5, cam: 'approach' },
      { line: L('petra', 'My Queen. The Guardian you asked for.'), cam: 'petra' },
      { line: L('mara', 'So this is the one the Light chose. Welcome to the Dreaming City, Guardian.'), cam: 'mara' },
      { line: L('mara', "The Taken have broken through the Mists. Oryx's children nest where they should never be."), cam: 'maraWide' },
      { line: L('mara', 'Climb the Spine of Keres and prove yourself. Then we will speak of the Emperor.'), cam: 'mara' },
      { line: L('ghost', 'She knows more than she is saying.'), cam: 'ghost' },
    ],
  }),

  /** 4. Crota dies. */
  crota: () => ({
    steps: [
      { set: 'crota', name: 'kneel', dur: 3.2, cam: (k, S) => [lerp(6, 3.2, k), 3.2, lerp(12, 9.5, k), 0, S.H * 0.55, 0] },
      { name: 'kneel', line: L('crota', 'My father will hear of this.'), cam: (k, S) => [lerp(1.8, 1.2, k), S.H * 0.7, lerp(6.2, 4.6, k), 0, S.H * 0.74, 0] },
      { name: 'die', dur: 4.4, cam: (k, S) => [lerp(1.2, 5, k), lerp(S.H * 0.7, 2.6, k), lerp(4.6, 10.5, k), 0, lerp(S.H * 0.6, 1.2, k), 0] },
    ],
  }),

  /** 7. Calus comes apart into wires. */
  calus: () => ({
    steps: [
      { set: 'calus', name: 'stand', dur: 2.8, cam: (k, S) => [lerp(5, 3, k), 2.4, lerp(11, 8.2, k), 0, S.H * 0.55, 0] },
      { name: 'shake', line: L('calus', 'Impressive. But do not mourn the shell.'), min: 4.5, cam: (k, S) => [lerp(1.6, 1.2, k), S.H * 0.72, lerp(7, 5.6, k), 0, S.H * 0.7, 0] },
      { name: 'fall', dur: 3.4, cam: (k, S) => [lerp(1.2, 3.6, k), lerp(S.H * 0.72, 2.2, k), lerp(5.6, 8, k), 0, lerp(S.H * 0.6, 0.9, k), 0] },
      { name: 'pile', line: L('ghost', 'Sparks. Wires. There is nothing inside.'), cam: (k) => [lerp(1.8, 0.9, k), 1.5, lerp(4.4, 3.4, k), 0, 0.5, 0] },
    ],
  }),
};

/** Every [speaker, text] line a scene speaks (for preloading and tests). */
export function sceneLines(id) {
  const def = typeof SCENES[id] === 'function' ? SCENES[id]() : SCENES[id];
  return def.steps.filter((s) => s.line).map((s) => s.line);
}
