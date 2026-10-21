// U15 "The Ghost's Story": the campaign's script and objective plan. Pure data and lookups (no scene), so tools/tests.js can check it.
// The Guardian never speaks. The Ghost narrates; the Vanguard and others arrive as comms. Lines are plain text on a subtitle bar.
// Each mission lists `lines` (what is said when) and `obj` (which zones carry an objective besides clearing).
//   at: 'start' | 'z<i>' (zone i activates) | 'c<i>' (zone i cleared) | 'boss' (boss zone activates) | 'bd' (the boss falls) | 'end' (the cache is opened)

export const SPEAKERS = {
  ghost:   { name: 'Ghost',    color: '#9fe8ff' },
  zavala:  { name: 'Zavala',   color: '#7fb3ff' },
  ikora:   { name: 'Ikora Rey', color: '#c79bff' },
  cayde:   { name: 'Cayde-6',  color: '#ffb26b' },
  eris:    { name: 'Eris Morn', color: '#b5e6ff' },
  rasputin:{ name: 'Rasputin', color: '#ff8b6b' },
  asher:   { name: 'Asher Mir', color: '#ffe08a' },
  spider:  { name: 'The Spider', color: '#d8a8ff' },
  petra:   { name: 'Petra Venj', color: '#a8ffe0' },
  kadi:    { name: 'Kadi 55-30', color: '#ffe08a' },
  mara:    { name: 'Mara Sov', color: '#f4e3a8' },
  riven:   { name: 'Riven',    color: '#ff9a3c' },
  calus:   { name: 'Emperor Calus', color: '#ffd24d' },
  psion:   { name: 'Psion Herald', color: '#ffd24d' },
};

/** Acts: one destination each, opened by the previous destination's last boss. `title` is the chapter card. */
export const CHAPTERS = {
  earth:    { title: 'Act I: Reborn', locked: '' },
  moon:     { title: 'Act II: The Dark Below', locked: 'Eris Morn has not called yet.' },
  mars:     { title: 'Act III: The Red War', locked: 'The Cabal have not moved.' },
  io:       { title: 'Act IV: Last Touch', locked: 'Nobody has found Io yet.' },
  titan:    { title: "Act V: Zavala's Home", locked: 'Titan is still quiet.' },
  tangled:  { title: 'Act VI: Thieves and Scorn', locked: 'The Reef has not called.' },
  dc:       { title: 'Act VII: The Dreaming City', locked: "The Queen's veil is closed." },
  leviathan:{ title: "Finale: The Emperor's Throne", locked: 'The Emperor is waiting. Finish the Dreaming City first.' },
};

/** Said when the last boss of a destination falls and the next one opens. Keyed by the destination just finished. */
export const UNLOCKS = {
  earth:   [['eris', 'Guardian. The Moon has swallowed a fireteam before yours. Come find what is left.']],
  moon:    [['rasputin', 'The Cabal I warned you of have landed on Mars. They are digging for me.']],
  mars:    [['psion', 'The Emperor in Exile salutes the one who ended Ghaul. A gift, and an invitation, are on their way.'], ['ikora', 'Do not answer him yet. Io is calling.']],
  io:      [['zavala', 'Titan is under siege. My home. I need you there.'], ['ghost', 'He sent another gift. I am throwing this one out.']],
  titan:   [['spider', 'Fallen Barons are strangling my trade on the Reef. Do a Spider a favor, Guardian.']],
  tangled: [['cayde', 'The Awoken Queen sent a personal invitation. That makes two. Pick the nicer one.']],
  dc:      [['ghost', 'Enough waiting. We answer the invitation.']],
  leviathan: [],
};

const L = (at, who, text) => ({ at, who, text });

export const MISSIONS = {
  // ---- Act I: Earth ----
  e1: {
    lines: [
      L('start', 'ghost', 'There you are. I dug you out of a pile of bones, you know. You are welcome.'),
      L('start', 'ghost', 'The Cosmodrome. Fallen everywhere. Stay low, stay moving.'),
      L('z0', 'ghost', 'Devils. They are stripping everything that is not bolted down.'),
      L('c0', 'zavala', 'Unknown Guardian, this is Zavala. We did not know anyone was still up. Reach the Wall.'),
      L('boss', 'ghost', 'Riksis. An Archon. Be careful with his arc blade.'),
      L('end', 'ghost', 'The Wall is open. Whatever we are, we are not alone.'),
    ],
    obj: {},
  },
  e2: {
    lines: [
      L('start', 'ghost', 'Rasputin\'s old array. If we can wake it, we get a voice that is not ours.'),
      L('z1', 'ghost', 'Three relay consoles. Stand at each and hold E while I wake it.'),
      L('c1', 'rasputin', 'Guardian detected. Signal restored. Warning: Cabal fleet massing at Mars.'),
      L('boss', 'ghost', 'A Servitor. It is jamming the array. Break it.'),
      L('end', 'cayde', 'Cabal at Mars. Fun. Keep the Fallen busy, kid.'),
    ],
    obj: { 1: { t: 'activate', n: 3, label: 'Restore the array relays' } },
  },
  e3: {
    lines: [
      L('start', 'cayde', 'The House of Devils. Their Kell is paying for something. Find out what.'),
      L('z1', 'ghost', 'Cabal coin. Real gold. That is a lot of money for a Fallen with no ship.'),
      L('c1', 'ghost', 'Take the coin cache. Whoever is buying the Fallen has a seal on every piece.'),
      L('boss', 'ghost', 'Draksis. Winter Kell. Do not let him get his shields back.'),
      L('end', 'ghost', 'Someone out there is buying everyone. I do not like it.'),
    ],
    obj: { 1: { t: 'retrieve', label: 'Take the coin cache' } },
  },

  // ---- Act II: Moon ----
  m1: {
    lines: [
      L('start', 'eris', 'My fireteam went into the tunnels. There was one Ghost still lit when I left.'),
      L('z1', 'ghost', 'A shell. Still warm. Pick it up.'),
      L('c1', 'eris', 'Bring it to me. Some of us should be remembered.'),
      L('boss', 'ghost', 'Sardok. The Eye of Oryx. He knows we are here.'),
      L('end', 'eris', 'Thank you. You are quieter than the last ones.'),
    ],
    obj: { 1: { t: 'retrieve', label: 'Recover the lost Ghost shell' } },
  },
  m2: {
    lines: [
      L('start', 'eris', 'The Chamber of Night. This is where I lost them.'),
      L('z1', 'ghost', 'Rite totems. They are feeding Omnigul. Break them.'),
      L('c1', 'eris', 'Her screams carry. Silence her and the Hive will be blind.'),
      L('boss', 'ghost', 'Omnigul. Stay out of her cloud.'),
      L('end', 'eris', 'She is gone. The dark is quieter. Not gone.'),
    ],
    obj: { 1: { t: 'destroy', n: 3, label: 'Break the rite totems', what: 'Rite Totem' } },
  },
  m3: {
    lines: [
      L('start', 'eris', 'The Hellmouth. Crota sits at the bottom. Go down.'),
      L('z1', 'ghost', 'They know we are coming. Survive the descent.'),
      L('boss', 'ghost', 'Crota. Son of Oryx. Ready?'),
      L('end', 'ghost', 'Crota said "my father will hear of this." I hope that was bluster.'),
    ],
    obj: { 1: { t: 'survive', secs: 40, label: 'Hold out on the descent' } },
  },

  // ---- Act III: Mars ----
  r1: {
    lines: [
      L('start', 'rasputin', 'The Red Legion are digging toward my bunkers. Stop them.'),
      L('z1', 'ghost', 'A buried terminal. Stay inside the ring while it decodes.'),
      L('c1', 'ghost', 'A Psion ledger. Calus walked away from his own throne. Interesting.'),
      L('boss', 'ghost', 'Valus Ta\'aurc. Big and angry. Do not fight him in the open.'),
      L('end', 'ikora', 'The Red Legion are not a raiding party. They are an invasion.'),
    ],
    obj: { 1: { t: 'hold', secs: 45, label: 'Hold the dig terminal', defend: true } },
  },
  r2: {
    lines: [
      L('start', 'ikora', 'A command post feeds their war. Infiltrate it.'),
      L('z2', 'ghost', 'Two consoles control the inner doors. Stand at each.'),
      L('boss', 'ghost', 'Bracus Zahn. His shield is the problem.'),
      L('end', 'cayde', 'That is the Legion on the back foot. Ghaul is next.'),
    ],
    obj: { 2: { t: 'activate', n: 2, label: 'Breach the command consoles' } },
  },
  r3: {
    lines: [
      L('start', 'zavala', 'Ghaul himself is on Mars. This ends here.'),
      L('z1', 'ghost', 'Siege emitters. If those fire, Rasputin is lost. Destroy them.'),
      L('boss', 'ghost', 'Ghaul. The Primus of the Red Legion.'),
      L('end', 'ghost', 'He said "the old man knew." Calus? What does he know?'),
    ],
    obj: { 1: { t: 'destroy', n: 3, label: 'Destroy the siege emitters', what: 'Siege Emitter' } },
  },

  // ---- Act IV: Io ----
  io2: {
    lines: [
      L('start', 'ikora', 'Red Legion survivors fled to Io. They are drilling at the great mesa.'),
      L('z1', 'ghost', 'Drill supports. Take them out and the whole thing comes down.'),
      L('boss', 'ghost', 'Psion Flayers. Three of them. Watch your minds.'),
      L('end', 'ghost', 'That is the Legion done. Asher Mir is waiting at the Rupture.'),
    ],
    obj: { 1: { t: 'destroy', n: 3, label: 'Wreck the drill supports', what: 'Drill Support' } },
  },
  io1: {
    lines: [
      L('start', 'asher', 'Guardian. This ground is the Traveler\'s last touch. Do not let them have it.'),
      L('z1', 'ghost', 'The Taken are coming for the Rupture. Hold it.'),
      L('boss', 'ghost', 'Malok-Ra. A Taken Captain. He is twice as fast as he looks.'),
      L('end', 'asher', 'The Rupture holds. The Vex still have something to say.'),
    ],
    obj: { 1: { t: 'hold', secs: 50, label: 'Defend the Rupture', defend: true } },
  },
  io3: {
    lines: [
      L('start', 'ghost', 'The Pyramidion. The Vex have listened to the Light for a very long time.'),
      L('start', 'ghost', 'I want to ask them why I chose you. I do not think they will tell me.'),
      L('z1', 'ghost', 'The Mind has a core. Take it before it takes us.'),
      L('boss', 'ghost', 'Protheon. Modular Mind. It does not want to be taken apart.'),
      L('end', 'ghost', 'Nothing. Not one answer. Typical.'),
    ],
    obj: { 1: { t: 'retrieve', label: 'Take the Vex core' } },
  },

  // ---- Act V: Titan ----
  t1: {
    lines: [
      L('start', 'zavala', 'Titan was my home. The Hive are drowning the rigs. Get to the survivors.'),
      L('z1', 'ghost', 'Hold the gate. The survivors are coming through.'),
      L('boss', 'ghost', 'Kathok. Swordbearer. His blade is faster than it looks.'),
      L('end', 'zavala', 'Thank you. Titan will not fall.'),
    ],
    obj: { 1: { t: 'hold', secs: 45, label: 'Defend the Arcology gate', defend: true } },
  },
  t2: {
    lines: [
      L('start', 'ghost', 'The Hive are growing something in the labs. Burn it.'),
      L('z1', 'ghost', 'Brood sacs. Three of them. Pop them all.'),
      L('boss', 'ghost', 'Ir Halak. Brood Wizard. Keep moving.'),
      L('end', 'zavala', 'The labs are clear. I owe you.'),
    ],
    obj: { 1: { t: 'destroy', n: 3, label: 'Burn out the brood sacs', what: 'Brood Sac' } },
  },
  t3: {
    lines: [
      L('start', 'ghost', 'A choir. Singing Savathûn\'s song. It is calling something.'),
      L('z2', 'ghost', 'Amplifiers. Break all three and the song falters.'),
      L('boss', 'ghost', 'Sedrak. The loudest voice in the choir.'),
      L('end', 'ghost', 'She said "ask who lent it." Ask who lent what? The Light?'),
    ],
    obj: { 2: { t: 'destroy', n: 3, label: 'Destroy the choir amplifiers', what: 'Choir Amplifier' } },
  },

  // ---- Act VI: The Tangled Shore ----
  ts1: {
    lines: [
      L('start', 'spider', 'A little favor, Guardian. A Baron called Araskes has been bleeding my market. Mind the mines.'),
      L('z1', 'ghost', 'Hold the alley door while the mechanism cycles.'),
      L('boss', 'ghost', 'Araskes. The Trickster. He teleports. Watch your back.'),
      L('end', 'spider', 'Lovely. One down. Two to go.'),
    ],
    obj: { 1: { t: 'hold', secs: 25, label: 'Hold the alley door' } },
  },
  ts2: {
    lines: [
      L('start', 'petra', 'Guardian. Petra Venj of the Awoken. The Mindbender runs a Hive ritual in the Rift.'),
      L('z1', 'ghost', 'Chains bind the ritual. Cut all three.'),
      L('boss', 'ghost', 'Reksis Vahn. Hive-tainted and proud of it.'),
      L('end', 'petra', 'The Queen watches. She is pleased.'),
    ],
    obj: { 1: { t: 'destroy', n: 3, label: 'Cut the ritual chains', what: 'Ritual Chain' } },
  },
  ts3: {
    lines: [
      L('start', 'petra', 'Fikrul raises the Scorn from the wrecks. Break his army.'),
      L('z1', 'ghost', 'A salvage beacon. Hold it while the camp gathers.'),
      L('z2', 'ghost', 'Ether totems. Break them and the Scorn stop rising.'),
      L('boss', 'ghost', 'Fikrul. The Fanatic. Everything he kills, he raises.'),
      L('end', 'petra', 'The Reef is quiet. The Queen asks for you in the Dreaming City.'),
    ],
    obj: { 1: { t: 'hold', secs: 40, label: 'Hold the salvage beacon', defend: true }, 2: { t: 'destroy', n: 2, label: 'Break the ether totems', what: 'Ether Totem' } },
  },

  // ---- Act VII: The Dreaming City ----
  dc1: {
    lines: [
      L('start', 'petra', 'The Taken have broken the veil. I will meet you at the gate.'),
      L('z0', 'ghost', 'The Divalian Mists. We cannot see ten metres.'),
      L('z1', 'petra', 'Three beacons light the way. Wake each, then hold the line.'),
      L('boss', 'ghost', 'A Taken champion. It was Awoken once, I think.'),
      L('end', 'petra', 'The Mists are held. The Queen is on the Spine.'),
    ],
    obj: { 0: { t: 'activate', n: 3, label: 'Light the Awoken beacons' }, 1: { t: 'hold', secs: 40, label: 'Hold the Mists', defend: true } },
  },
  dc2: {
    lines: [
      L('start', 'mara', 'Climb the Spine, Guardian. The Oracle needs to hear you.'),
      L('z1', 'ghost', 'The Oracle. Wake it before the Taken reach it.'),
      L('c1', 'mara', 'The Emperor who invites you is not the Emperor you will find. What sits on his throne is a puppet.'),
      L('boss', 'ghost', 'Morgeth. The Spirekeeper. He is built like a wall.'),
      L('end', 'mara', 'Go to the Wishing Chamber. The wish-dragon\'s child waits.'),
    ],
    obj: { 1: { t: 'activate', n: 1, label: 'Wake the Oracle' }, 2: { t: 'hold', secs: 30, label: 'Hold the Spine', defend: true } },
  },
  dc3: {
    lines: [
      L('start', 'riven', 'Welcome, little light. I have many voices. Which one do you want?'),
      L('z1', 'riven', '(in Ikora\'s voice) Come closer, Guardian.'),
      L('z2', 'ghost', 'Blight growths. They are feeding her child. Destroy them.'),
      L('boss', 'ghost', 'Veshra. One of her brood. Break the plates, then burn the heart.'),
      L('end', 'riven', 'Mine was not the first wish. An Emperor asked me for a throne that cannot be defeated. I gave it to him. Look at what sits on it.'),
      L('end', 'ghost', 'A throne that cannot be defeated. Calus.'),
    ],
    obj: { 1: { t: 'survive', secs: 40, label: 'Survive the Taken court' }, 2: { t: 'destroy', n: 2, label: 'Destroy the Blight growths', what: 'Blight Growth' } },
  },

  // ---- Finale: The Leviathan ----
  lev1: {
    lines: [
      L('start', 'calus', 'Welcome, Guardian. Take off your coat. I have prepared a feast.'),
      L('start', 'ghost', 'This is a trap with candles.'),
      L('z1', 'calus', 'The gardens are lovely this time of year. Pity about the beasts.'),
      L('z2', 'ghost', 'Three seals hold the pools. Break each.'),
      L('z3', 'ghost', 'The Gauntlet. Doors open only when they are cleared. Do not stop.'),
      L('boss', 'calus', 'Behold. The Emperor, in the flesh.'),
      L('bd', 'ghost', 'That was never him. Wires. Servos. An automaton.'),
      L('end', 'calus', 'Well played, little Shadow. Come find the rest of me. I can tell you why the Light chose you.'),
      L('end', 'ghost', 'I do not need him to tell me why I chose you. I remember.'),
    ],
    obj: { 2: { t: 'activate', n: 3, label: 'Break the pool seals' }, 3: { t: 'survive', secs: 40, label: 'Cross the Gauntlet' } },
  },
};

/** Lines for a trigger in a mission, in script order. */
export function linesFor(missionId, at) {
  return (MISSIONS[missionId]?.lines || []).filter((l) => l.at === at);
}

/** The objective spec for a zone, or null (the default is clear). */
export function objectiveFor(missionId, zoneIdx) {
  return MISSIONS[missionId]?.obj?.[zoneIdx] || null;
}

/** Subtitle display time in seconds for a line: reading speed plus a pause. */
export function lineDuration(text) {
  return Math.min(8, Math.max(2.6, text.length / 16 + 1.2));
}

// ---------------------------------------------------------------------------
// U16 "The Last City": what the Vanguard say in the Tower. Keyed by Tower stop (quests.js TOWER_STOPS), then NPC.
// Each entry is a list of [speaker, text]. The Guardian never speaks; the Ghost may answer.
// ---------------------------------------------------------------------------
export const TOWER_TALKS = {
  earth: {
    zavala: [
      ['zavala', 'A Guardian, walking out of the Cosmodrome. We stopped believing in that years ago. Welcome to the Tower.'],
      ['zavala', 'The Last City holds, but only just. I will need every Guardian I can find.'],
      ['ghost', 'He does that. Say "thank you" and look sturdy.'],
    ],
    ikora: [
      ['ikora', 'You took a coin from the Winter Kell. Gold, stamped with a seal I do not know. Fallen do not buy things.'],
      ['ikora', 'Somebody is paying them. I would like to know who before they pay anyone else.'],
    ],
    cayde: [
      ['cayde', 'Fresh Guardian! Let me guess: the Ghost does all the talking. They always do.'],
      ['cayde', 'Rule one: never trust anyone who says "trust me." Except me. I am extremely trustworthy.'],
      ['ghost', 'He is not.'],
    ],
  },
  moon: {
    ikora: [
      ['ikora', 'Eris Morn walked out of the Hellmouth alone. I have never seen anyone carry that much quiet.'],
      ['ikora', 'You brought back what the Hive left of her fireteam. Thank you. The Traveler remembers you for it.'],
      ['ikora', 'Rasputin is warning of Cabal on Mars. When Rasputin is afraid, so am I.'],
    ],
  },
  mars: {
    zavala: [
      ['zavala', 'Ghaul is dead. The Red Legion has lost its head, and a wounded army is the most dangerous kind.'],
      ['zavala', 'You did what the whole City could not. I will not forget it.'],
    ],
    ikora: [
      ['ikora', 'Calus has sent a gift to a Tower he cannot see, and an invitation to a Guardian he has never met.'],
      ['ikora', 'He is not a man who gives. Keep the invitation. Do not answer it. Not yet.'],
    ],
  },
  io: {
    zavala: [
      ['zavala', 'Titan. My home. The Hive have climbed out of the methane, and the arcology is the next to fall.'],
      ['zavala', 'I cannot leave the City. You can. Go, and tell them the Vanguard has not forgotten Titan.'],
    ],
  },
  titan: {
    cayde: [
      ['cayde', 'The Spider says the Fallen Barons are strangling his trade on the Reef. Barons! Loud, greedy, terrible at hiding.'],
      ['cayde', 'I would go myself, but somebody has to stay here and look important. Hit them hard, Guardian.'],
      ['ghost', 'He has never once looked important.'],
    ],
  },
  tangled: {
    ikora: [
      ['ikora', 'A second invitation. The Awoken Queen does nothing without a reason, and she does nothing for free.'],
      ['ikora', 'The Dreaming City has been closed for a very long time. If its veil opens for you, go carefully.'],
    ],
  },
  dc: {
    zavala: [
      ['zavala', 'The Taken are quiet. That frightens me more than if they were not.'],
      ['zavala', 'Calus waits at the end of this. Whatever he tells you, remember what the Light is for.'],
    ],
    ikora: [
      ['ikora', 'He will say he knows why the Light chose you. He will say it kindly. That is how it begins.'],
    ],
    cayde: [
      ['cayde', 'Big ship, fancy throne, a sulking Emperor. Classic. Shoot first, banter second.'],
      ['cayde', 'Come back in one piece. I have a bet with Zavala and I am winning.'],
    ],
  },
};

/** Said when you speak to someone with nothing new for you. */
export const TOWER_IDLE = {
  zavala: ['The City is safe tonight because of Guardians like you.', 'Keep your Light bright, Guardian.', 'Stay vigilant. The Darkness does not rest.'],
  ikora: ['The Traveler has been quiet. I choose to find that hopeful.', 'Knowledge is a weapon too. Use it.', 'If you find something strange out there, tell me first.'],
  cayde: ['Got any spare glimmer? Asking for a friend. The friend is me.', 'I would tell you a joke, but the Ghost has banned them.', 'Nice gear. Mine is better.'],
  kadi: ['Mail for you? Always. It is never the good kind.', 'Everything the field could not carry is right here.'],
};

/** The first time the Postmaster is met, and the Quest Kiosk. */
export const KADI_LINES = [['kadi', 'Postmaster Kadi 55-30. When your pack is full, what you could not carry waits here for you. Take what you need.']];
