// Player-facing Update Log and Roadmap on the title screen.
// RELEASES: only updates that have actually shipped, newest first.
// ROADMAP: curated teasers, not the internal plan (see docs/OVERHAUL_ROADMAP.md). No dates.

export const RELEASES = [
  {
    version: '1.5', name: 'Armor 2.0', date: '2026-10-14', accent: '#cdb6ff', glyph: '⬡',
    summary: 'Build your armor your way. Perks give way to mods: four sockets on every piece, a screen to fill them, and orbs that charge your armor.',
    notes: [
      'Mods replace armor perks. Every piece has four sockets and an energy budget set by rarity: 4 on common up to 10 on legendary and exotic',
      'The first socket takes stat mods. The other three take mods made for that piece: 57 in all, from Hands-On and Grenade Kickstart to Surges, Fonts and Ammo Scavengers',
      'A new Mods screen on the character screen: open it from the arrow at the right edge, pick a piece, hover a socket to see what fits',
      'Mods unlock at level 5. The rest arrive one by one on the reward track up to level 30',
      'Six armor stats: Mobility, Resilience, Recovery, Discipline, Intellect and Strength. Discipline, Intellect and Strength set your grenade cooldown, super gain and melee cooldown, and each class ability follows its own stat',
      'Orbs of Power drop from super kills, rapid weapon kills and ability-kill mods, and every Guardian can see them. Picking one up gives super energy and Armor Charge',
      'Armor Charge shows with your buffs and powers Fonts (extra stat) and Surges (extra weapon damage of one element)',
      'Your old saves keep every piece. Legendary perks become the matching mod when they fit the piece, and armor stats carry over to the new six',
      'Arc Soul hits far softer and no longer pours super energy into you. Jolt hits a little softer, and a crowd of jolted enemies no longer multiplies it',
    ],
    art: '<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="armBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1c1630"/><stop offset="0.55" stop-color="#0d1118"/><stop offset="1" stop-color="#1a1f2e"/></linearGradient><radialGradient id="armGlow" cx="0.7" cy="0.45" r="0.55"><stop offset="0" stop-color="#cdb6ff" stop-opacity="0.55"/><stop offset="1" stop-color="#cdb6ff" stop-opacity="0"/></radialGradient><linearGradient id="armPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9eef5"/><stop offset="1" stop-color="#6d7686"/></linearGradient></defs><rect width="320" height="180" fill="url(#armBg)"/><rect width="320" height="180" fill="url(#armGlow)"/><g stroke="#ffffff" stroke-opacity="0.06" stroke-width="1"><path d="M-20 200 200 -20M20 200 240 -20M60 200 280 -20M100 200 320 -20M140 200 360 -20"/></g><g stroke="#0a0d12" stroke-width="1.5"><path d="M92 30h60l16 14 14 6v36l-12 10v38l-20 26H94L74 134V96L62 86V50l14-6z" fill="url(#armPlate)"/><path d="M112 30h20l6 20h-32z" fill="#2a2f38"/><path d="M96 100h56v10H96z" fill="#2a2f38"/></g><g fill="#0b0e13" stroke="#cdb6ff" stroke-width="2.5" stroke-linejoin="round"><path d="M104 62l8-5 8 5v9l-8 5-8-5z"/><path d="M128 62l8-5 8 5v9l-8 5-8-5z"/><path d="M104 84l8-5 8 5v9l-8 5-8-5z" fill="#cdb6ff" fill-opacity="0.45"/><path d="M128 84l8-5 8 5v9l-8 5-8-5z" fill="#cdb6ff" fill-opacity="0.9"/></g><g stroke="#cdb6ff" stroke-width="1.5" stroke-opacity="0.55" fill="none"><path d="M168 74C196 62 214 64 236 78"/><path d="M168 96C196 112 220 108 244 92"/></g><circle cx="252" cy="82" r="24" fill="#cdb6ff" fill-opacity="0.18"/><circle cx="252" cy="82" r="14" fill="#cdb6ff" fill-opacity="0.4"/><circle cx="252" cy="82" r="7" fill="#ffffff"/><g fill="#ffffff" fill-opacity="0.8"><circle cx="214" cy="48" r="1.6"/><circle cx="280" cy="52" r="1.2"/><circle cx="272" cy="124" r="1.6"/><circle cx="226" cy="132" r="1.2"/><circle cx="296" cy="96" r="1.2"/></g></svg>',
  },
  {
    version: '1.4', name: 'Arsenal', date: '2026-10-14', accent: '#ffcf7a', glyph: '⚔',
    summary: 'Every gun has a name and a feel. Weapons now come in Destiny archetypes, Stasis and Strand arrive as weapon elements, and fireteams ready up together.',
    notes: [
      'Weapon archetypes: every weapon family has Destiny\'s frames (Adaptive, Rapid-Fire, High-Impact, Precision and more), shown on the item',
      'Stats come from the archetype: every copy of a weapon shoots the same. Named legendaries always have the same archetype and element',
      'New frames with their own behavior: Pinpoint Slug shotguns, Aggressive linear fusions (three-bolt burst), Compressed Wave grenade launchers, tracking Precision rockets, faster Lightweight frames',
      'Stasis and Strand weapons. Weapon icons are now diagonal and every element has its own symbol',
      'Tracking rounds (Swarm, Axion Bolt, Parasitic Nanites, Wolfpack Rounds) fly as particle swarms',
      'Sunbreaker, Striker, Gunslinger, Nightstalker, Voidwalker and Stormcaller each gain a subclass trait',
      'Thrown hammers explode after 7 seconds. Hammer of Sol leaves Sunspots, and every Sunspot burns enemies inside it',
      'Healing Grenade bursts in white light and leaves an orb every Guardian can pick up',
      'New death screen, and a glowing Ghost marks downed teammates for revive',
      'Fireteams ready up in the Director: the mission launches when the last Guardian is ready',
      'Click AFTERLIGHT in the top bar to return to the title screen, which now shows the current update',
    ],
    art: '<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="arsBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2433"/><stop offset="0.55" stop-color="#0d1118"/><stop offset="1" stop-color="#241826"/></linearGradient><radialGradient id="arsGlow" cx="0.62" cy="0.42" r="0.6"><stop offset="0" stop-color="#ffcf7a" stop-opacity="0.55"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient><linearGradient id="arsMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9eef5"/><stop offset="1" stop-color="#7d8794"/></linearGradient></defs><rect width="320" height="180" fill="url(#arsBg)"/><rect width="320" height="180" fill="url(#arsGlow)"/><g stroke="#ffffff" stroke-opacity="0.07" stroke-width="1"><path d="M-20 200 200 -20M20 200 240 -20M60 200 280 -20M100 200 320 -20M140 200 360 -20"/></g><g transform="translate(176 78) rotate(-30) scale(0.62)" fill="#3a4250" stroke="#0a0d12" stroke-width="1.5"><rect x="-120" y="-14" width="230" height="26" rx="5"/><rect x="-60" y="12" width="16" height="30" rx="3"/><rect x="-20" y="12" width="12" height="22" rx="3"/><rect x="104" y="-18" width="22" height="34" rx="4" fill="#2a2f38"/><rect x="-80" y="-24" width="40" height="12" rx="3" fill="#2a2f38"/><rect x="-110" y="-6" width="200" height="4" fill="#b07cff" stroke="none" opacity="0.9"/></g><g transform="translate(150 104) rotate(-30) scale(0.78)" stroke="#0a0d12" stroke-width="1.5"><path d="M-100 -6h120l10-6h60v10h18v8h-18v4h-70l-6 10h-14l2-10h-30l-12 26h-16l8-26h-52z" fill="url(#arsMetal)"/><rect x="-30" y="12" width="14" height="26" rx="3" fill="#2a2f38"/><rect x="-30" y="-16" width="44" height="8" rx="2" fill="#2a2f38"/><rect x="-90" y="-1" width="150" height="3" fill="#5fd3ff" stroke="none"/></g><g transform="translate(84 128) rotate(-30) scale(0.8)" stroke="#0a0d12" stroke-width="1.5"><path d="M-30 -8h70v12h-56l-4 6h-10l-6 26h-16l6-30z" fill="#c9a046"/><circle cx="-6" cy="2" r="9" fill="#6a5320"/><rect x="-26" y="-6" width="60" height="3" fill="#ff8b2b" stroke="none"/></g><g transform="translate(196 150)"><g fill="#dfe6ee" transform="translate(0 0) scale(0.28)"><path d="M32 6 54 28 32 58 10 28zm0 10L18 29l14 19 14-19z"/></g><g fill="#ff8b2b" transform="translate(18 0) scale(0.28)"><circle cx="32" cy="32" r="11"/><path d="M32 2l4 13h-8zM32 62l-4-13h8zM2 32l13-4v8zM62 32l-13 4v-8z"/></g><g fill="#5fd3ff" transform="translate(36 0) scale(0.28)"><path d="M38 2 12 36h16l-6 26 30-36H36z"/></g><g fill="#b07cff" transform="translate(54 0) scale(0.28)"><path d="M32 4a28 28 0 1 0 0.1 0zm0 8a20 20 0 1 1-0.1 0z"/><path d="M32 18 46 42H18z"/></g><g fill="#4d88ff" transform="translate(72 0) scale(0.28)"><path d="M32 2 40 20 32 30 24 20zM32 62 24 44 32 34 40 44zM6 17l19 3 5 11-12-1zM58 47l-19-3-5-11 12 1z"/></g><g fill="#35e366" transform="translate(90 0) scale(0.28)"><path d="M32 4c10 8 10 20 0 28-10-8-10-20 0-28z"/><path d="M8 50c3-12 14-18 24-18-2 12-12 20-24 18z"/><path d="M56 50c-12 2-22-6-24-18 10 0 21 6 24 18z"/></g></g><rect x="0.5" y="0.5" width="319" height="179" fill="none" stroke="#ffffff" stroke-opacity="0.18"/></svg>',
  },
  {
    version: '1.3.1', name: 'Hotfix', date: '2026-10-14', accent: '#9fb4ff', glyph: '✚',
    summary: 'Fixes for fireteams and a round of tuning. Fewer engrams to sort through, and no more supers in seconds.',
    notes: [
      'Areas and Horde waves no longer clear while enemies are still standing',
      'Fireteam members now see the leader\'s debuffs, staggers and every area and boss banner',
      'Downed Guardians get back up when the boss falls or the final cache appears, even with no lives left',
      'Guardians downed in the air fall to the ground, and Arc Soul stays with its caster on every screen',
      'Ionic Trace, Spark of Ions, Hands-On and Dynamo toned down. Celestial Nighthawk now hits 2.5x (4x for Golden Gun)',
      'Far fewer engrams from enemies. Bosses still drop them, and caches still pay out',
      'The top-right feed shows drops and notices only. One-off procs flash with your other buffs',
      'Barricades take your subclass color and Guardians walk through them. Rally Barricade is wider',
      'Bigger health bars, enemy plates follow HUD scale, and HUD scale goes up to 200%',
      'Thrown hammers land on top of what they hit instead of sinking into it',
    ],
  },
  {
    version: '1.3', name: 'Paths of Light', date: '2026-10-13', accent: '#ff8b2b', glyph: '❖',
    summary: 'Your Light, your way. Every subclass opens up: choose your grenade and class ability, then shape it with aspects and fragments.',
    notes: [
      'A new subclass screen: pick your grenade, class ability, two aspects and the fragments they open',
      'Grenades are shared by element: any Solar, Arc or Void subclass can throw any grenade of its element',
      'Twenty-seven aspects, each unique to its subclass, and fourteen fragments shared by element',
      'Sentinel, Arcstrider and Stormcaller earn their final aspect on the reward track, and two new fragments wait further along it',
      'Enemies now show what afflicts them: weakened, slowed, suppressed, scorched, poisoned and the new Arc debuff, jolted',
      'Hunters can jump twice in the air',
      'Dawnblade is now Sunsinger, and Phoenix Dive becomes one of its aspects',
    ],
  },
  {
    version: '1.2', name: 'Clear Sight', date: '2026-10-13', accent: '#7fd8ff', glyph: '◎',
    summary: 'Read the battlefield at a glance. Every blessing on your Light now ticks down where you can see it, every foe has a name, and every shot lands with weight.',
    notes: [
      'Your buffs and exotic effects appear above your abilities, weapon perks below, each with its own timer',
      'Aim at an enemy to see its name, faction and health above its head',
      'Damage numbers peel away to the side instead of piling up',
      'A charged super now burns gold',
      'Enemies flinch when you hit them hard',
      'Tighter aim down sights, and primaries hit harder, especially in later missions',
      'Supers charge more slowly and Song of Flame burns shorter',
      'Stormtrance now chains to four, Storm Grenade strikes everything beneath it, and Golden Gun no longer strikes its target twice',
    ],
  },
  {
    version: '1.1', name: 'First Light', date: '2026-10-13', accent: '#f4c542', glyph: '✦',
    summary: 'A new journey begins. Every Guardian starts fresh: earn your levels, climb the reward track, and reach for the Light beyond.',
    notes: [
      'Guardian levels 1 to 40, earned in every fight',
      'A level reward track: a Legendary every three levels, Exotics at 20 and 40',
      'Begin with two subclasses. The third answers your call at level 10',
      'The higher you climb, the better your drops. By level 40, Legendaries are the norm',
      'Light now climbs to 200',
      'Every Guardian begins anew. Your settings carry over',
    ],
  },
  {
    version: '1.0', name: 'Kindling', date: '2026-10-13', accent: '#7fd8ff', glyph: '◆',
    summary: 'Where it all began. Six destinations, eighteen missions, and a Guardian\'s first taste of the Light.',
    notes: [
      'Six destinations, from the Cosmodrome to Io',
      'Three classes and nine subclasses',
      'Exotic weapons and armor with signature perks',
      'Fireteams of up to three',
      'Horde and Endless',
    ],
  },
];

export const ROADMAP_STATUSES = ['In Development', 'On the Horizon', 'Future Transmission'];

export const ROADMAP = [
  {
    name: 'The Last City', status: 'Future Transmission', accent: '#e9eef5', glyph: '⌂',
    teaser: 'The lights of the Tower are coming back on. Somewhere to rest, somewhere to gather, somewhere to call home.',
    themes: ['A place between battles'],
  },
  {
    name: 'The Emperor\'s Shadow', status: 'Future Transmission', accent: '#c9a046', glyph: '♛',
    teaser: 'A golden vessel drifts at the edge of the system. Someone aboard has been watching you for a very long time.',
    themes: ['???'],
  },
];
