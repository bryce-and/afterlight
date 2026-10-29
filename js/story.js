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
  ana:     { name: 'Ana Bray', color: '#7fd0e8' },
  sloane:  { name: 'Sloane', color: '#9fc4d8' },
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
  earth: [['eris', 'Guardian, I request your presence on the moon. Come to me and we will speak.']],
  moon: [['rasputin', 'Внимание! На поверхности Марса зафиксирована активность 9-го класса. Сигнал бедствия 322. Призываем на помощь Стражей со всей Солнечной системы.']],
  mars: [['psion', 'The Emperor in Exile salutes the one who ended Ghaul. Come and worship the God-Emperor and you will be at his right hand.'], ['ikora', 'Do not answer this invitation. We have to get the whole picture.']],
  io: [['zavala', 'Titan is under siege. My home. I need you there.'], ['ghost', 'You can count on us commander!']],
  titan: [['spider', 'Fallen Barons are strangling my trade on the Reef. Do a Spider a favor, Guardian.']],
  tangled: [['cayde', 'The Awoken Queen requested you? They typically aren\'t the friendliest people.']],
  dc: [['ghost', 'Enough waiting. It\'s time to find this Emperor.']],
  leviathan: [],
};

const L = (at, who, text) => ({ at, who, text });

export const MISSIONS = {
  // ---- Act I: Earth ----
  e1: {
    lines: [
      L('start', 'ghost', 'I\'m your Ghost. I know this must be confusing - but trust me, we need to move.'),
      L('start', 'ghost', 'This is the Cosmodrome. There\'s Fallen everywhere, stay low.'),
      L('z0', 'ghost', 'The House of Devils! Watch out!'),
      L('c0', 'zavala', 'Unknown Guardian, this is Zavala. Your Ghost sent a distress signal. Get to the wall and we will transmat you out.'),
      L('boss', 'ghost', 'Uh oh... this isn\'t good.'),
      L('end', 'ghost', 'That was enough action for today. Let\'s go home.'),
    ],
    obj: {},
  },
  e2: {
    lines: [
      L('start', 'ghost', 'Rasputin\'s old array. This will help boost our communications with other planets.'),
      L('z1', 'ghost', 'Three relay consoles. Get me close and I can get them online.'),
      L('c1', 'rasputin', 'Обнаружен Страж. Предупреждение: флот Кабал стягивается к Марсу.'),
      L('boss', 'ghost', 'It\'s a servitor! And a big one too. It must be jamming the array. We need to take it down!'),
      L('end', 'cayde', 'I brushed up on my Russian and it sounds like we need to see what the Cabal are up to on Mars. See you there kid.'),
    ],
    obj: { 1: { t: 'activate', n: 3, label: 'Bring the relay consoles online' } },
  },
  e3: {
    lines: [
      L('start', 'cayde', 'We need to break the House of Devil\'s hold on the Cosmodrome. Their Kell falls today. You got this.'),
      L('z1', 'ghost', 'The Glimmer they\'re dropping, it has a data signature. I\'m looking into this now.'),
      L('c1', 'ghost', 'It\'s Cabal in origin. I don\'t know what\'s going on, but I don\'t like it.'),
      L('boss', 'ghost', 'This is their Kell! It\'s time for him to fall.'),
      L('end', 'ghost', 'Great job Guardian. Cabal and Fallen working together cannot be good news. We need to tell the Vanguard.'),
    ],
    obj: { 1: { t: 'retrieve', label: 'Collect the Cabal glimmer cache' } },
  },

  // ---- Act II: Moon ----
  m1: {
    lines: [
      L('start', 'eris', 'A great darkness is stirring on the moon. A Guardian recently went dark closeby. Investigate it.'),
      L('z1', 'ghost', 'A Ghost shell. it\'s... broken. We need to pick it up.'),
      L('c1', 'eris', 'Eriana. She fought well. Bring her Ghost back to me.'),
      L('boss', 'ghost', 'These Hive are not normal. They have royal crests in their Chitin.'),
      L('end', 'eris', 'Thank you Guardian. We honor the lost today through combat.'),
    ],
    obj: { 1: { t: 'retrieve', label: 'Recover the broken Ghost shell' } },
  },
  m2: {
    lines: [
      L('start', 'eris', 'The Chamber of Night. This is where my fireteam fell.'),
      L('z1', 'ghost', 'Rite totems. They are feeding Omnigul. Break them.'),
      L('c1', 'eris', 'The wailing of a Deathsinger. Silencing her will break their ranks.'),
      L('boss', 'ghost', 'It\'s Omnigul. She must fall Guardian!'),
      L('end', 'eris', 'This ritual nears its end. But there\'s a greater evil than Omnigul.'),
    ],
    obj: { 1: { t: 'destroy', n: 3, label: 'Break the rite totems', what: 'Rite Totem' } },
  },
  m3: {
    lines: [
      L('start', 'eris', 'The Hellmouth. Descend and bring light to the darkness.'),
      L('z1', 'ghost', 'They know we are coming. We killed their commander. I don\'t think they\'re happy about that.'),
      L('boss', 'ghost', 'That\'s a big sword. Don\'t let him get close!'),
      L('end', 'ghost', 'I think he said "my father will hear of this". I don\'t know who his father is, but that cannot be good.'),
    ],
    obj: { 1: { t: 'survive', secs: 40, label: 'Hold out on the descent' } },
  },

  // ---- Act III: Mars ----
  r1: {
    lines: [
      L('start', 'rasputin', 'Наконец-то ты прибыл. Красный Легион должен быть остановлен.'),
      L('z1', 'ghost', 'We need to translate what he said. Stand by that terminal while I figure out what\'s going on.'),
      L('c1', 'ghost', 'The Red Legion are sieging one of Rasputin\'s bunkers. He asked us to wipe them out.'),
      L('boss', 'ghost', 'Valus Ta\'aurc. Maybe he\'s connected to the Fallen we faced.'),
      L('end', 'ikora', 'The Red Legion are not a raiding party. It\'s a full blown invasion of Mars.'),
    ],
    obj: { 1: { t: 'hold', secs: 45, label: 'Hold the terminal while Ghost translates', defend: true } },
  },
  r2: {
    lines: [
      L('start', 'ikora', 'This command post is key to their weapons distribution. We need to take it out.'),
      L('z2', 'ghost', 'Two consoles control the inner doors. Defend me while I get them open!'),
      L('boss', 'ghost', 'Bracus Zahn, the Arms Dealer! Show him your power, Guardian!'),
      L('end', 'cayde', 'The Red Legion is losing this war on Mars. We go for their leader next.'),
    ],
    obj: { 2: { t: 'activate', n: 2, label: 'Open the inner door consoles' } },
  },
  r3: {
    lines: [
      L('start', 'zavala', 'The Primus of the Red Legion is here on Mars. His name is Ghaul, take him out.'),
      L('z1', 'ghost', 'Siege emitters. If those fire, Rasputin\'s bunker is compromised.'),
      L('boss', 'ghost', 'Ghaul. The Primus of the Red Legion.'),
      L('end', 'ghost', 'Hopefully that\'s the last of our Cabal troubles.'),
    ],
    obj: { 1: { t: 'destroy', n: 3, label: 'Destroy the siege emitters', what: 'Siege Emitter' } },
  },

  // ---- Act IV: Io ----
  io2: {
    lines: [
      L('start', 'ikora', 'Red Legion survivors fled to Io. But who\'s command do they listen to now?'),
      L('z1', 'ghost', 'Drill supports. Take them out and the whole thing comes down.'),
      L('boss', 'ghost', 'Psion Flayers! Three of them. You got this Guardian!'),
      L('end', 'ghost', 'That\'s the end of the Red Legion. Let\'s follow up with Asher Mir.'),
    ],
    obj: { 1: { t: 'destroy', n: 3, label: 'Wreck the drill supports', what: 'Drill Support' } },
  },
  io1: {
    lines: [
      L('start', 'asher', 'Assistant! This is where the Traveler last touched. Do not let them taint the data I need.'),
      L('z1', 'ghost', 'The Taken? No! That can\'t be...'),
      L('boss', 'ghost', 'That\'s a big captain. Watch out!'),
      L('end', 'asher', 'The Rupture holds. Thank you, my assistant.'),
    ],
    obj: { 1: { t: 'hold', secs: 50, label: 'Defend the Rupture', defend: true } },
  },
  io3: {
    lines: [
      L('start', 'ghost', 'The Pyramidion. The Vex have a strong presence here.'),
      L('start', 'ghost', 'Their Mind controls the local forces on IO. We need to find it.'),
      L('z1', 'ghost', 'That data carries valuable information. We need to take it to the City.'),
      L('boss', 'ghost', 'It\'s the Vex mind! Take it out!'),
      L('end', 'ghost', 'Great work. We\'re a good team me and you!'),
    ],
    obj: { 1: { t: 'retrieve', label: 'Recover the Vex data core' } },
  },

  // ---- Act V: Titan ----
  t1: {
    lines: [
      L('start', 'zavala', 'Titan was my home. The Hive are tearing through our Rigs.'),
      L('z1', 'ghost', 'Hold the gate. The survivors are coming through.'),
      L('boss', 'ghost', 'Kathok. Swordbearer. His blade is faster than it looks.'),
      L('end', 'zavala', 'Thank you. Titan will not fall.'),
    ],
    obj: { 1: { t: 'hold', secs: 45, label: 'Hold the gate for the survivors', defend: true } },
  },
  t2: {
    lines: [
      L('start', 'ghost', 'The Hive aren\'t destroying these labs like the others... but why?'),
      L('z1', 'ghost', 'Brood sacs. Three of them. They\'re growing an army!'),
      L('boss', 'ghost', 'That has to be the Brood Mother. Take her down!'),
      L('end', 'zavala', 'The labs are clear. You prevented another war today. Thank you.'),
    ],
    obj: { 1: { t: 'destroy', n: 3, label: 'Burn out the brood sacs', what: 'Brood Sac' } },
  },
  t3: {
    lines: [
      L('start', 'ghost', 'The Hive here are being strengthened by a ritual. Let\'s stop it.'),
      L('z2', 'ghost', 'The ritual is being Amplified by these totems. Break them all!'),
      L('boss', 'ghost', 'This death-song sings of one name: Savathun. We need to silence her.'),
      L('end', 'ghost', 'Great work. I\'m sure Zavala will be happy.'),
    ],
    obj: { 2: { t: 'destroy', n: 3, label: 'Break the ritual amplifier totems', what: 'Choir Amplifier' } },
  },

  // ---- Act VI: The Tangled Shore ----
  ts1: {
    lines: [
      L('start', 'spider', 'A little favor, Guardian. A Baron called Araskes has been bleeding my market. Mind the mines.'),
      L('z1', 'ghost', 'I need to locate this Baron. Defend me while I track down his signal.'),
      L('boss', 'ghost', 'Araskes. The Trickster. That\'s him!'),
      L('end', 'spider', 'Lovely. One down. Two to go.'),
    ],
    obj: { 1: { t: 'hold', secs: 25, label: 'Hold while Ghost tracks Araskes' } },
  },
  ts2: {
    lines: [
      L('start', 'petra', 'Guardian, my name is Petra. My Queen has tasked me with taking down Reksis Vahn, the Mindbender. Help me track him down.'),
      L('z1', 'ghost', 'Chains bind the ritual. Cut all three.'),
      L('boss', 'ghost', 'There he is, the Mindbender. Take him down!'),
      L('end', 'petra', 'The Queen watches. She is pleased.'),
    ],
    obj: { 1: { t: 'destroy', n: 3, label: 'Cut the ritual chains', what: 'Ritual Chain' } },
  },
  ts3: {
    lines: [
      L('start', 'petra', 'Fikrul is the leader of them all. If he falls, his army goes with him.'),
      L('z1', 'ghost', 'A salvage beacon. Hold it while the camp gathers.'),
      L('z2', 'ghost', 'Ether totems. Break them and the Scorn stop rising.'),
      L('boss', 'ghost', 'There\'s so many of them, be careful Guardian!'),
      L('end', 'petra', 'I owe you, Guardian. Thank you for assisting the Awoken of the Reef. The Queen requests your presence.'),
    ],
    obj: { 1: { t: 'hold', secs: 40, label: 'Hold the salvage beacon', defend: true }, 2: { t: 'destroy', n: 2, label: 'Break the ether totems', what: 'Ether Totem' } },
  },

  // ---- Act VII: The Dreaming City ----
  dc1: {
    lines: [
      L('start', 'petra', 'Here we are, home. To reach the Queen we must fight through the Taken.'),
      L('z0', 'ghost', 'The Divalian Mists... the stories are true. You really can\'t see much here.'),
      L('z1', 'petra', 'Three beacons light the way. Wake each, then hold the line!'),
      L('boss', 'ghost', 'Was that one of the Queen\'s people? It looks like an Awoken.'),
      L('end', 'petra', 'The Mists are held. The Queen is on the Spine, we must go there at once.'),
    ],
    obj: { 0: { t: 'activate', n: 3, label: 'Light the Awoken beacons' }, 1: { t: 'hold', secs: 40, label: 'Hold the Mists', defend: true } },
  },
  dc2: {
    lines: [
      L('start', 'mara', 'Climb the Spine, Guardian. Meet me at the top.'),
      L('z1', 'ghost', 'I don\'t know what will be waiting for us up there... keep an eye out.'),
      L('c1', 'mara', 'An Emperor awaits you. He\'s a formidable foe. Or ally perhaps?'),
      L('boss', 'ghost', 'I knew this was a test. She wants us to prove ourselves.'),
      L('end', 'mara', 'Thank you for playing my little game. The answers you need lie in the wish-magic of an Ahamkara.'),
    ],
    obj: { 1: { t: 'activate', n: 1, label: 'Wake the Oracle' }, 2: { t: 'hold', secs: 30, label: 'Hold the Spine', defend: true } },
  },
  dc3: {
    lines: [
      L('start', 'riven', 'Welcome, little light. I have many voices. Which one do you want?'),
      L('z1', 'riven', '(in Ikora\'s voice) Knowledge perhaps?'),
      L('z2', 'ghost', 'Blight growths. It seems to be an energy source for something.'),
      L('boss', 'ghost', 'That\'s a real Ahamkara! We need to kill it, it\'s too dangerous to be left alive!'),
      L('end', 'riven', 'A throne that cannot be defeated. This wish was granted... you\'ll find out how.'),
      L('end', 'ghost', 'A throne that cannot be defeated. The Emperor?'),
    ],
    obj: { 1: { t: 'survive', secs: 40, label: 'Survive the Taken court' }, 2: { t: 'destroy', n: 2, label: 'Destroy the Blight growths', what: 'Blight Growth' } },
  },

  // ---- Finale: The Leviathan ----
  lev1: {
    lines: [
      L('start', 'calus', 'Welcome, Guardian. I am Calus. I have been waiting for you.'),
      L('start', 'ghost', 'I have a bad feeling about this.'),
      L('z1', 'calus', 'The gardens are lovely this time of year. Pity about the beasts running amuck.'),
      L('z2', 'ghost', 'Break those seals, it\'ll seal the doors behind us.'),
      L('z3', 'ghost', 'Rip through them Guardian!'),
      L('boss', 'calus', 'Join me Guardian. The end awaits us all!'),
      L('bd', 'ghost', 'Wires? Servos? He wasn\'t real... just a robot?'),
      L('end', 'calus', 'Well played, my Shadow. Seek me further. You\'ve proven yourself worthy.'),
      L('end', 'ghost', 'Let\'s get out of here.'),
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
/** U17a: talks held in patrol zones, by meeting id (quests.js PATROL_MEETINGS). */
export const PATROL_TALKS = {
  eris_moon: [
    ['eris', 'You walk like someone who has not been here long. Good. The ones who know the Moon walk quietly.'],
    ['eris', 'The Hive still sing in the dark below the Hellmouth. I listen, so that you do not have to.'],
    ['ghost', 'She makes me nervous.'],
    ['eris', 'It is a sensible reaction. Take this. It is what the dark gave me to share.'],
  ],
  ana_mars: [
    ['ana', 'Careful where you point that. The Red Legion left more than wreckage out here, and the sand hides all of it.'],
    ['ana', 'I come out to the Buried City to remember what we built before the Collapse. The towers outlasted the people who raised them.'],
    ['ghost', 'Some of those people are still around.'],
    ['ana', 'Some of us. Here, a little something for the road, Guardian.'],
  ],
  sloane_titan: [
    ['sloane', 'You are the Guardian I asked for? Good. I do not have time for a speech, so here is the short version.'],
    ['sloane', 'The rigs keep the lights on in the dome. The Hive moved into the Solarium and one of the tower wings, and they are still moving in.'],
    ['ghost', 'And the rest of the arcology?'],
    ['sloane', 'Empty, and growing wild. Walk it carefully, Guardian. Take this, and clear me a path.'],
  ],
  cayde_earth: [
    ['cayde', 'There you are! Do not look at me. Look at the car. The very rusty car. Good.'],
    ['cayde', 'Back when the Cosmodrome was a parking lot, I hid something here. A snack, or a weapon. Honestly, I forget which.'],
    ['ghost', 'He forgets a lot.'],
    ['cayde', 'Rude. Take this for the trouble, and if anyone asks, we never met. Rule two!'],
  ],
};

export const TOWER_TALKS = {
  earth: {
    zavala: [
      ['zavala', 'A Guardian, walking out of the Cosmodrome. It has been ages. We are happy you found your way home.'],
      ['zavala', 'This is the Last City. It holds, but we need help securing our place in the solar system.'],
      ['ghost', 'You can count on us, commander.'],
    ],
    ikora: [
      ['ikora', 'Your Ghost told us the glimmer found in the Devil\'s Lair had a Cabal data signature. Peculiar.'],
      ['ikora', 'Somebody is paying them. I would like to know who is paying the Fallen, and why.'],
    ],
    cayde: [
      ['cayde', 'Fresh Guardian! Let me guess: the Ghost does all the talking. They always do.'],
      ['cayde', 'Rule one: never trust anyone who says "trust me." Except me. I am extremely trustworthy.'],
      ['ghost', 'He is not.'],
    ],
  },
  moon: {
    ikora: [
      ['ikora', 'Eris Morn is a powerful ally. Thank you for securing the Hellmouth, it\'s where she lost her Fireteam.'],
      ['ikora', 'Today we remember the Guardians that fell on the moon. You did well avenging them, Guardian.'],
      ['ikora', 'Back in the Cosmodrome, Rasputin warned about the Cabal on Mars. When you\'re ready, go investigate the distress call.'],
    ],
  },
  mars: {
    zavala: [
      ['zavala', 'Ghaul is dead. The Red Legion has lost its head, but it isn\'t gone yet.'],
      ['zavala', 'Rest now, but IO awaits. The rest of the Red Legion is gathering there now, although we don\'t know by who\'s authority.'],
    ],
    ikora: [
      ['ikora', 'This Emperor seems to be watching you closely.'],
      ['ikora', 'Remember what you\'re fighting for. The Light, the hope of humanity. Don\'t answer this invitation unless it is with a fight.'],
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
      ['cayde', 'The Spider says the Fallen Barons are strangling his trade on the Reef. Barons! Loud, greedy, and very very dangerous.'],
      ['cayde', 'I would go myself, but somebody has to stay here and look important. Hit them hard, Guardian.'],
      ['ghost', 'He has never once looked important.'],
    ],
  },
  tangled: {
    ikora: [
      ['ikora', 'A second invitation. The Awoken Queen does nothing without a reason, and she does nothing for free.'],
      ['ikora', 'The Dreaming City has been closed for a very long time. If they open it to you, you should proceed carefully.'],
    ],
  },
  dc: {
    zavala: [
      ['zavala', 'Guardian, you\'ve stabilized the system. But you\'re not done yet.'],
      ['zavala', 'This God-Emperor waits at the end of this. He must fall.'],
    ],
    ikora: [
      ['ikora', 'Whatever this Emperor has to offer or say, don\'t trust him.'],
    ],
    cayde: [
      ['cayde', 'Big ship, fancy throne, a God Emperor. Classic. Shoot first, questions later.'],
      ['cayde', 'Come back in one piece. I have a bet on you.'],
    ],
  },
};

/** Said when you speak to someone with nothing new for you. */
export const TOWER_IDLE = {
  zavala: ['The City is safe tonight because of Guardians like you.', 'Keep your Light bright, Guardian.', 'Stay vigilant. The Darkness does not rest.'],
  ikora: ['Hone your abilities. You must stay sharp.', 'Knowledge is a weapon. Use it.', 'I hope your mind is as sharp as your light is.'],
  cayde: ['Got any spare glimmer? Asking for a friend. The friend is me.', 'I would tell you a joke, but not with Ikora present.', 'Nice gear. Really nice gear...'],
  kadi: ['Mail for you? Always!', 'Plenty more next time!'],
};

/** The first time the Postmaster is met, and the Quest Kiosk. */
export const KADI_LINES = [['kadi', 'Hello Guardian! Missing your engrams?']];
