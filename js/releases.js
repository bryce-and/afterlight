// Player-facing Update Log and Roadmap on the title screen.
// RELEASES: only updates that have actually shipped, newest first.
// ROADMAP: curated teasers, not the internal plan (see docs/OVERHAUL_ROADMAP.md). No dates.

export const RELEASES = [
  {
    version: '1.8.3', name: 'Hotfix', date: '2026-10-15', accent: '#ffb547', glyph: '✚',
    summary: 'Sunsingers get Phoenix Dive as a class ability and a new Icarus Dash aspect, Song of Flame burns hot again, Gift of the Sun gets its own identity, and the quieter aspects open more fragment slots.',
    notes: [
      'Gift of the Sun no longer grants Restoration (Ember of Benevolence covers that). Solar grenade and melee kills now leave a Firesprite: walk over it for 15% grenade energy. Grenades still recharge 30% faster',
      'Phoenix Dive is now a Sunsinger class ability: dive from the air, or burst where you stand on the ground. It always heals you and grants Restoration',
      'New Sunsinger aspect, Icarus Dash: press Shift in the air to dash. 2 charges',
      'Song of Flame: grenades and melees recharge almost instantly again',
      'Amplitude, Defender\'s Resolve, Juggernaut, On Your Mark, Chain of Woe, Ascension and Icarus Dash open 2 fragment slots',
    ],
  },
  {
    version: '1.8.2', name: 'Hotfix', date: '2026-10-15', accent: '#ffb547', glyph: '✚',
    summary: 'Subclass traits become aspects you choose, the newest supers get tuned, and a long list of fixes, from weapon balance to a Warlock coat that no longer looks like a dress.',
    notes: [
      'New controls: V is your powered melee, B your quick melee and F your super. A held Twilight Arsenal axe now throws with a click',
      'Subclass traits are now aspects: Explosive Pyre, Amplitude, Defender\'s Resolve, Chain of Woe, Abyssal Edge, Crackling Blade, Bloom, Unlimited Power and Gift of the Sun. Each subclass starts with its own equipped',
      'Bastion is gone, so Sentinels can use Towering and Rally Barricade again',
      'Roaming supers take 70% less damage. Chaos Reach fires the moment you cast it, lasts twice as long, and ends when you press F again',
      'Daybreak jumps far higher and lets you hover down slowly, with wings on your back. Well of Radiance lasts 25 seconds, restores much faster and burns enemies inside. Nova Warp releases Void seekers that weaken',
      'Gathering Storm and Spectral Blades deal less damage',
      'Hits on weakened enemies show yellow. Your rift and barricade show a timer above your abilities',
      'Firing breaks invisibility. Holding sprint for half a second cancels a reload. Thralls are a little bigger. Thorn kills burst with poison',
      'Auto Rifles and Fusion Rifles fire faster. Shotguns hit softer up close and fall off sooner, and SMGs fall off sooner. Heavy weapons hit 10% harder',
      'Incandescent, Voltshot and Destabilizing Rounds only roll on Solar, Arc and Void weapons',
      'The Warlock coat hangs straight and opens at the front, more trench coat than robe',
    ],
  },
  {
    version: '1.8.1', name: 'Hotfix', date: '2026-10-15', accent: '#b07cff', glyph: '✚',
    summary: 'Sentinel Shield finally guards like it should. Hold right-click to raise your shield and let the fire break against it.',
    notes: [
      'Sentinel Shield: holding right-click now raises the shield in front of you, and it flashes when it takes a hit',
      'Guarding blocks 95% of incoming damage, up from 85%. Ursa Furiosa counts the extra',
      'Your fireteam sees you raise the shield and sees every blocked hit',
    ],
    art: '<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="sgBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0a18"/><stop offset="0.65" stop-color="#1a1330"/><stop offset="1" stop-color="#2b2140"/></linearGradient><radialGradient id="sgGlow" cx="0.5" cy="0.47" r="0.42"><stop offset="0" stop-color="#e6d0ff" stop-opacity="0.55"/><stop offset="0.45" stop-color="#b07cff" stop-opacity="0.28"/><stop offset="1" stop-color="#b07cff" stop-opacity="0"/></radialGradient></defs><rect width="320" height="180" fill="url(#sgBg)"/><g stroke="#ff7a6b" stroke-width="2" stroke-linecap="round" stroke-opacity="0.8"><path d="M8 52L96 72"/><path d="M4 98L94 94"/><path d="M12 140L98 114"/><path d="M312 60L226 76"/><path d="M316 118L228 104"/></g><g fill="#ffd0c8"><circle cx="96" cy="72" r="2.5"/><circle cx="94" cy="94" r="2.5"/><circle cx="98" cy="114" r="2.5"/><circle cx="226" cy="76" r="2.5"/><circle cx="228" cy="104" r="2.5"/></g><rect width="320" height="180" fill="url(#sgGlow)"/><g stroke="#0a0d12" stroke-width="1.5"><path d="M150 132l-6 32h10l4-30zM170 132l6 32h-10l-4-30z" fill="#6c727b"/><path d="M146 90h28l5 44h-38z" fill="#5a6070"/><path d="M151 70h18v18h-18z" fill="#7a808b"/></g><path d="M155 77h10" stroke="#b07cff" stroke-width="2.5"/><ellipse cx="160" cy="98" rx="52" ry="56" fill="#3a3048" fill-opacity="0.82" stroke="#b07cff" stroke-width="6"/><ellipse cx="160" cy="98" rx="52" ry="56" fill="none" stroke="#e6d0ff" stroke-width="1.5" stroke-opacity="0.9"/><path d="M160 82l10 16-10 16-10-16z" fill="#e6d0ff" stroke="#b07cff" stroke-width="1.5"/><g stroke="#e6d0ff" stroke-width="2" stroke-linecap="round" stroke-opacity="0.85"><path d="M104 70l-10-6"/><path d="M102 98h-12"/><path d="M106 122l-10 6"/><path d="M216 74l10-6"/><path d="M218 102h12"/></g><ellipse cx="160" cy="166" rx="64" ry="6" fill="#b07cff" fill-opacity="0.22" stroke="#b07cff" stroke-opacity="0.55"/><rect x="0.5" y="0.5" width="319" height="179" fill="none" stroke="#ffffff" stroke-opacity="0.18"/></svg>',
  },
  {
    version: '1.8', name: 'Light Ascendant', date: '2026-10-15', accent: '#ffd27a', glyph: '✧',
    summary: 'Every Light subclass grows up. Twelve new supers to choose from, a fourth aspect for every subclass, eight fragments per element, and new ways to jump, including Blink.',
    notes: [
      'Choose your super on the subclass screen. Titan: Burning Maul, Thundercrash, Ward of Dawn and Twilight Arsenal. Hunter: Blade Barrage, Spectral Blades, Gathering Storm and Storm\'s Edge. Warlock: Well of Radiance, Nova Warp, Chaos Reach and Daybreak',
      'New supers unlock on the reward track at levels 14, 17, 23 and 26. Your original supers stay available',
      'Ward of Dawn and Well of Radiance protect the whole fireteam, and anyone can pick up a Twilight Arsenal axe and throw it',
      'A fourth aspect for every subclass: Tempered Metal, Aftershocks, Unbreakable, Crackshot, On the Prowl, Fast Twitch, Angel of Light, Ionic Sentry and Hellion',
      'Ten new fragments, eight per element. Solar: Searing, Combustion, Benevolence, Tempering. Arc: Resistance, Discharge, Magnitude. Void: Remnants, Obscurity, Leeching',
      'New class jumps: High Lift and Strafe Lift for Titans, High Jump and Strafe Jump for Hunters, Balanced Glide and Strafe Glide for Warlocks. Arcstriders and Voidwalkers can Blink',
      'Your loadouts carry over: every subclass keeps its super and jump until you change them',
    ],
    art: '<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="laBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1020"/><stop offset="0.6" stop-color="#121a2c"/><stop offset="1" stop-color="#2a1d14"/></linearGradient><radialGradient id="laSun" cx="0.5" cy="0.42" r="0.5"><stop offset="0" stop-color="#fff4d6" stop-opacity="0.95"/><stop offset="0.25" stop-color="#ffd27a" stop-opacity="0.55"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs><rect width="320" height="180" fill="url(#laBg)"/><g stroke-linecap="round" stroke-width="2" fill="none" stroke-opacity="0.55"><path d="M160 76L40 4" stroke="#ff8b2b"/><path d="M160 76L100 -6" stroke="#ffb547"/><path d="M160 76L220 -6" stroke="#5fd3ff"/><path d="M160 76L280 4" stroke="#b07cff"/><path d="M160 76L10 70" stroke="#ff8b2b"/><path d="M160 76L310 70" stroke="#b07cff"/></g><rect width="320" height="180" fill="url(#laSun)"/><g fill="none" stroke-width="3" stroke-linecap="round"><path d="M76 96C96 54 132 40 160 40" stroke="#ff8b2b"/><path d="M244 96C224 54 188 40 160 40" stroke="#b07cff"/><path d="M110 112C126 82 142 72 160 72C178 72 194 82 210 112" stroke="#5fd3ff"/></g><g stroke="#0a0d12" stroke-width="1.5"><path d="M160 58l9 12-4 10h-10l-4-10z" fill="#e9eef5"/><path d="M151 82h18l6 30-6 22h-18l-6-22z" fill="#cfd6e2"/><path d="M151 86l-26-10 6 14 20 8zM169 86l26-10-6 14-20 8z" fill="#ffd27a"/><path d="M154 134l-4 26h8l2-24zM166 134l4 26h-8l-2-24z" fill="#9aa3b2"/></g><path d="M156 67h8" stroke="#ffb547" stroke-width="2.5"/><ellipse cx="160" cy="166" rx="70" ry="7" fill="#ffd27a" fill-opacity="0.25" stroke="#ffd27a" stroke-opacity="0.6"/><g fill="#ffffff" fill-opacity="0.85"><circle cx="30" cy="30" r="1.4"/><circle cx="292" cy="40" r="1.2"/><circle cx="270" cy="140" r="1.4"/><circle cx="46" cy="132" r="1.2"/><circle cx="210" cy="24" r="1"/></g><rect x="0.5" y="0.5" width="319" height="179" fill="none" stroke="#ffffff" stroke-opacity="0.18"/></svg>',
  },
  {
    version: '1.7', name: 'Exotic Hunt', date: '2026-10-14', accent: '#f4c542', glyph: '⬢',
    summary: 'Twelve new exotics, and no more chasing the same drop twice. Abilities hit hard and come back slower, so your guns matter again.',
    notes: [
      'Four new exotic armor pieces for every class, eight each. Titan: Mask of the Quiet One, Ursa Furiosa, Hallowfire Heart, Peacekeepers',
      'Hunter: Graviton Forfeit, Young Ahamkara\'s Spine, Lucky Raspberry, Orpheus Rig. Warlock: Skull of Dire Ahamkara, Sunbracers, Stormdancer\'s Brace, Lunafaction Boots',
      'Lunafaction Boots turn your rifts into a reload station for the whole fireteam',
      'Exotic drops now favor exotics you haven\'t found yet, for weapons and armor alike. Once you have them all, every exotic is fair game again. Exotics you already own count as found',
      'Grenades, melees and class abilities take longer to recharge, and kills shave off less. Health and shields regenerate a little slower',
      'Nova Bomb leaves a void field for 6 seconds that damages, weakens and suppresses anything inside',
      'Golden Gun hits softer, which makes Celestial Nighthawk\'s single shot stand out. Knock \'Em Down\'s two extra shots deal slightly less damage each',
    ],
    art: '<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="exhBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#231a0c"/><stop offset="0.55" stop-color="#0d1118"/><stop offset="1" stop-color="#1d1430"/></linearGradient><radialGradient id="exhGlow" cx="0.5" cy="0.46" r="0.5"><stop offset="0" stop-color="#f4c542" stop-opacity="0.6"/><stop offset="1" stop-color="#f4c542" stop-opacity="0"/></radialGradient><linearGradient id="exhFace" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2c2"/><stop offset="0.5" stop-color="#f4c542"/><stop offset="1" stop-color="#9a6b12"/></linearGradient></defs><rect width="320" height="180" fill="url(#exhBg)"/><rect width="320" height="180" fill="url(#exhGlow)"/><g stroke="#ffffff" stroke-opacity="0.06"><path d="M-20 200 200 -20M20 200 240 -20M60 200 280 -20M100 200 320 -20M140 200 360 -20"/></g><ellipse cx="160" cy="150" rx="78" ry="12" fill="#b07cff" fill-opacity="0.22" stroke="#b07cff" stroke-opacity="0.7"/><ellipse cx="160" cy="150" rx="50" ry="7" fill="none" stroke="#e6d0ff" stroke-opacity="0.5"/><g stroke="#f4c542" stroke-opacity="0.45" fill="none"><ellipse cx="160" cy="82" rx="104" ry="34"/><ellipse cx="160" cy="82" rx="74" ry="56" transform="rotate(-24 160 82)"/></g><g stroke="#0a0d12" stroke-width="1.5"><path d="M160 34l34 20v40l-34 20-34-20V54z" fill="url(#exhFace)"/><path d="M160 34v40l34-20M160 74l-34-20M160 74v40" fill="none" stroke="#7a5310" stroke-opacity="0.7"/></g><path d="M160 58l10 6v12l-10 6-10-6V64z" fill="#ffffff" fill-opacity="0.85"/><g fill="#f4c542" stroke="#0a0d12"><path d="M56 82l7-7 7 7-7 7z"/><path d="M250 82l7-7 7 7-7 7z"/><path d="M110 34l6-6 6 6-6 6z"/><path d="M206 132l6-6 6 6-6 6z"/></g><g fill="#9aa3b2" fill-opacity="0.75"><path d="M92 120l6-6 6 6-6 6z"/><path d="M222 40l6-6 6 6-6 6z"/></g><path d="M10 22L120 70" stroke="#ffb547" stroke-width="3" stroke-linecap="round" stroke-opacity="0.85"/><circle cx="10" cy="22" r="5" fill="#ffd27a"/><g fill="#ffffff" fill-opacity="0.8"><circle cx="280" cy="24" r="1.4"/><circle cx="300" cy="120" r="1.2"/><circle cx="30" cy="150" r="1.4"/><circle cx="262" cy="160" r="1.2"/></g><rect x="0.5" y="0.5" width="319" height="179" fill="none" stroke="#ffffff" stroke-opacity="0.18"/></svg>',
  },
  {
    version: '1.6', name: 'Fashion Is Endgame', date: '2026-10-14', accent: '#f4c542', glyph: '◆',
    summary: 'Look the part. Your armor now shows on your Guardian, every destination has its own armor set, shaders recolor your whole look, and you can play a Titan, a Hunter and a Warlock side by side.',
    notes: [
      'Your armor is visible: every piece changes your Guardian on the character screen, in third-person supers and on your fireteam\'s screens. Titans, Hunters and Warlocks each keep their own silhouette',
      'Six destination armor sets: Skywatch, Hellmouth Vigil, Meridian Legion, Arcology, Reef Outlaw and Sacred Ground. Legendary armor from a mission is that destination\'s set',
      'Wear any 3 pieces of a set for its bonus, from faster reloads to orb charge to extra super energy. The fourth slot is free for an exotic',
      'Shaders: 10 to find, dropped from mission caches (a destination\'s final mission always gives one the first time). One shader recolors all of your armor',
      'Armor icons now show the actual piece, in your shader',
      'Three Guardians: pick your character after the title screen, or switch from the Characters button. Each has its own gear, inventory and Light. Your level, glimmer, shaders and vault are shared',
      'Move gear between Guardians through the vault. Armor belongs to one class and drops for the class you play',
      'Exotic armor belongs to its class, like Destiny: four per class. New: Liar\'s Handshake and Raiden Flux for Hunters, Starfire Protocol for Warlocks. Actium War Rig, Armamentarium and Ophidian Aspect are retired',
      'Celestial Nighthawk now works with Golden Gun only and refunds super on a kill. Nezarec\'s Sin and Contraverse Hold now work with Void abilities',
      'Your stats moved to the Mods screen, which opens at any level',
      'Your saves keep everything: your current gear becomes your current class\'s, and retired exotics become that class\'s exotic for the slot',
    ],
    art: '<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="fieBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1a33"/><stop offset="0.55" stop-color="#0d1118"/><stop offset="1" stop-color="#1c2a2e"/></linearGradient><radialGradient id="fieSpot" cx="0.5" cy="0.95" r="0.6"><stop offset="0" stop-color="#f4c542" stop-opacity="0.35"/><stop offset="1" stop-color="#f4c542" stop-opacity="0"/></radialGradient></defs><rect width="320" height="180" fill="url(#fieBg)"/><rect width="320" height="180" fill="url(#fieSpot)"/><ellipse cx="160" cy="166" rx="120" ry="9" fill="#000" fill-opacity="0.45"/><g stroke="#0a0d12" stroke-width="1.5"><path d="M58 70h44l10 6v30l-8 8v44H62v-44l-8-8V76z" fill="#b0703a"/><path d="M50 72l14-6v20l-14 2zM110 72l-14-6v20l14 2z" fill="#4a3a2a"/><rect x="68" y="44" width="24" height="24" fill="#b0703a"/><rect x="72" y="52" width="16" height="4" fill="#ff8b2b"/><path d="M70 120h20v30h-20z" fill="#8a4a24"/></g><g stroke="#0a0d12" stroke-width="1.5"><path d="M138 62h44l10 54-12 46h-40l-12-46z" fill="#6b2c8c"/><path d="M146 72h28l6 8v34l-6 6v42h-28v-42l-6-6V80z" fill="#c9a23f"/><path d="M144 30h32v30h-32z" fill="#6b2c8c"/><rect x="150" y="38" width="20" height="18" fill="#c9a23f"/><rect x="153" y="45" width="14" height="3" fill="#5fd3ff"/><path d="M144 30l-6-10 10 8zM176 30l6-10-10 8z" fill="#5a2a7a"/></g><g stroke="#0a0d12" stroke-width="1.5"><path d="M222 70h40l6 8v30l-6 6-0 2 18 46h-76l18-46v-2l-6-6V78z" fill="#8cbfd9"/><path d="M228 70h28v44h-28z" fill="#cfe6f2"/><rect x="231" y="44" width="22" height="24" fill="#cfe6f2"/><rect x="235" y="53" width="14" height="3" fill="#b07cff"/><path d="M234 44l2-10 3 10M240 44l2-13 3 13M246 44l2-10 3 10" fill="#5c8fb0"/></g><g transform="rotate(45 160 104)" stroke="#0a0d12" stroke-width="1"><rect x="152" y="96" width="16" height="16" fill="#f4c542"/></g><g fill-opacity="0.9"><path d="M30 28l7-7 7 7-7 7z" fill="#f4c542"/><path d="M276 30l6-6 6 6-6 6z" fill="#b9bccc"/><path d="M290 140l5-5 5 5-5 5z" fill="#3e8a7d"/><path d="M22 130l5-5 5 5-5 5z" fill="#9c2a2a"/></g></svg>',
  },
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

/** The title screen shows the newest major update (hotfixes like 1.8.2 keep the card as it is). */
export const titleRelease = () => RELEASES.find((r) => r.version.split('.').length === 2);

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
