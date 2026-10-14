// Player-facing Update Log and Roadmap on the title screen.
// RELEASES: only updates that have actually shipped, newest first.
// ROADMAP: curated teasers, not the internal plan (see docs/OVERHAUL_ROADMAP.md). No dates.

export const RELEASES = [
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
