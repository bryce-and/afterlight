# U27 Prismatic: Gate B proposal (target: v5.3)

Requested by Bryce 2026-11-17. Roadmap row U27 ("Prismatic subclasses and features, kept out of U8"). Depends on U8 and U22, both shipped. Revised the same day: class items, exotic class items and Postmaster hover added; fragments and meter rules clarified.

## How it works in Destiny 2 (research summary)
- **A sixth subclass per class** (The Final Shape, 2024) that mixes Light and Darkness. It adds almost no new abilities: it is a curated pick list of existing ones, one super, grenade, melee and aspect per element (5 of each per class). All class abilities and jumps of the class are allowed.
- **Transcendence:** two meters under the super bar. Light damage (Solar, Arc, Void) fills the left one, Dark damage (Stasis, Strand) the right one, Kinetic fills both. When both are full you activate it (grenade + melee together). It grants faster ability regen, more weapon damage and damage resistance against combatants (community figures: about +5% weapon damage, 20% DR; not official), swaps the grenade for a class-specific Prismatic grenade, and melee hits during it charge the grenade and vice versa. It decays; kills extend it.
- **Fragments:** Prismatic has its own fragment pool (21 in D2, all named "Facet of ..."). They are ordinary fragments, slotted the same way.
- **Class items:** the fifth armor piece. Hunter cloak, Titan mark, Warlock bond. They roll stats and mods like other armor and count toward Power.
- **Exotic class items** (Essentialism cloak, Stoicism mark, Solipsism bond): only work on Prismatic. Each rolls two "Spirit of X" perks copied from other exotic armor, so you effectively wear two exotics at once. They take the one exotic armor slot.

Sources: Destinypedia (Prismatic, Prismatic Hunter, Titan, Warlock), GGRecon Prismatic guide (2024), Shacknews and GamesRadar exotic class item lists. No official Transcendence numbers were found.

## What Afterlight has today (verified by grep and scout)
- 5 subclasses per class (`CLASSES`, `js/data.js:320`), one `element` string each. **Every D2 Prismatic super and aspect already exists** (15 and 15); 12 of 15 melees exist. Melee is fixed per subclass today.
- `sanitizeLoadout` (`subclass.js:336`) requires grenade and fragment element to equal the subclass element: the main loadout blocker.
- Armor: `ARMOR_SLOTS = ['helmet','arms','chest','legs']` (`data.js:28`), iterated at 11 sites and hard-coded at about 10 more (`save.js:368, 394, 417, 445`, `style.js:163`, `characters.js:365`, `loot.js:128`, `crucible-loot.js:33`, `dungeon-loot.js:47`). The one-exotic rule (`save.js:394`) and `trimExotics` (`save.js:445`) use the hard-coded list, so a new slot would escape the limit unless fixed.
- Models: the Hunter cloak (`characters.js:194`), Titan mark sash (`:168`) and Warlock bond ring (`:234`) are fixed parts of each silhouette, not equipment. Each other slot draws from its own look (`buildCharacter`, `characters.js:361`); appearance is encoded per slot (`style.js:163-166`) for co-op.
- Armor families: `SETS` in `js/style.js:30` (earth, moon, mars, titan, tangled, io, dc, leviathan, plus dungeon and Crucible sets), `SET_PIECES = 3`, per-set `classPieces` and `look`.
- Power: `playerPower` (`save.js:378`) averages over `SLOTS` (7 today). Save is `SAVE_VERSION = 14` with a `MIGRATIONS` table (`save.js:37`).
- Exotic armor perks: `EXOTIC_ARMOR_PERKS` (`data.js:272`, about 25 across the three classes), applied by name into `Player.exo` (`player.js:140`).
- Postmaster (`tower-ui.js:28`): cards show name, type and power only. The inventory tooltip `tipHTML` (`ui.js:1058`) takes any item; `showTip` (`ui.js:1128`) only looks items up in inventory and vault.

## Objective
Add a Prismatic subclass to each class with Transcendence, a class item armor slot for every class, Prismatic-only exotic class items that carry two exotic perks, and item details on hover in the Postmaster.

## Scope
1. **Prismatic subclass** (`prismatic` per class, `element: 'prismatic'`, prism white/pink colour). **Unlocks with the Legendary campaign clear**, account-wide, the same rule as Mission Blitz (`blitzUnlocked`, `js/blitz.js:20`, shared as one helper); the full kit and all 12 fragments open at once. Locked card hint: "Clear the Legendary campaign on any Guardian to unlock". Curated lists, D2's own picks where the ability exists:
   | | Hunter | Titan | Warlock |
   |---|---|---|---|
   | Supers | Shadowshot, Golden Gun, Storm's Edge, Silence and Squall, Silkstrike | Twilight Arsenal, Hammer of Sol, Thundercrash, Glacial Quake, Bladefury | Nova Bomb, Song of Flame, Stormtrance, Winter's Wrath, Needlestorm |
   | Melees | Snare Bomb, Knife Trick, Combination Blow, Withering Blade, Threaded Spike | Shield Throw, Throwing Hammer*, Shoulder Charge*, Shiver Strike, Frenzied Blade | Energy Drain*, Incinerator Snap, Chain Lightning, Penumbral Blast, Arcane Needle |
   | Grenades | Axion Bolt*, Swarm, Flux*, Duskfield, Grapple | Suppressor, Solar*, Pulse, Glacier, Shackle | Vortex, Healing, Storm, Coldsnap, Threadling |
   | Aspects | Stylish Executioner, Gunpowder Gamble, Ascension, Winter's Shroud, Threaded Specter | Unbreakable, Consecration, Knockout, Diamond Lance, Drengr's Lash | Feed the Void, Hellion, Lightning Surge, Bleak Watcher, Weaver's Call |

   \* Stand-in for a D2 ability Afterlight doesn't have. Class abilities and jumps: all of the class's existing ones. 2 aspects, fragment cap 5 as today.
2. **Prismatic fragments:** a normal `FRAGMENTS.prismatic` pool of 12, D2 names ("Facet of ..."), effects adapted to existing systems: Balance, Courage, Devotion, Sacrifice, Dawn, Protection, Purpose, Hope, Mending, Justice, Generosity, Grace. Slotted on the subclass screen like any other fragments. Keywords count across elements (any debuff satisfies "debuffed").
3. **Transcendence** (`js/prismatic-rules.js` pure rules, `js/prismatic.js` Player wiring at single marked points, the U22 pattern):
   - Light meter fills from your Solar, Arc and Void damage (abilities and weapons), Dark meter from Stasis and Strand, Kinetic both at half rate. Super damage does not fill. Meters persist through death, reset per activity.
   - **The meters are drawn only while a Prismatic subclass is equipped**, empty or full. Every other subclass's HUD is unchanged.
   - Activate with its own bindable action `transcend`: **X** in the Keyboard preset (free today). The Magic Mouse / trackpad preset already uses X for Aim (`keybinds.js:60`), so there it defaults to **Z**. Shown in the keybinds screen; phones get a TRANSCEND tile that appears when ready.
   - While active (base 10 s, kills add 1 s, cap 20 s): ability regen x1.5 (outside `REGEN_CAP`), weapon damage +10%, 20% damage resistance against combatants (not players), melee hits refund grenade energy and vice versa. Starting numbers, tuned with playcheck.
   - Prismatic grenade per class from existing explode and status helpers: Hailfire Spike (slow field, then scorch), Electrified Snare (suspend, then jolt chain), Freezing Singularity (pull, slow, implode).
4. **Class item slot** (`classitem`): Cloak (Hunter), Mark (Titan), Bond (Warlock), labelled by class everywhere (inventory, character screen, vault, Postmaster, loot toasts).
   - Same item shape as other armor (stats, 4 mod sockets, Power, rarity, set). **Counts toward Light** (Bryce): the average becomes 8 slots, as in D2.
   - Every armor family in `SETS` gets a class item piece per class with its own look (name, colours, set bonus counts it). Drop tables (`loot.js`, `rewards.js`, `crucible-loot.js`, `dungeon-loot.js`) include it.
   - All armor slot lists go through `ARMOR_SLOTS`; the hard-coded copies are replaced, including the one-exotic rule and `trimExotics`.
   - **Model rework:** cloak, mark and bond become equipment-driven parts in `characters.js`, built from the class item's look like the other slots, with a few silhouette variants per family (for example long or split cloak, sash or tabard mark, ring or orbiting bond). An unequipped slot draws a plain default. Appearance encoding gains the slot, so co-op teammates see it.
   - **Save v15 migration:** each Guardian gets an equipped legendary class item at their current average Power (so nobody's Light drops) in a set matching their chest piece. Old saves and old co-op peers are tested.
5. **Exotic class items:** Essentialism (cloak), Stoicism (mark), Solipsism (bond).
   - Each drop rolls two different "Spirit of ..." perks from that class's exotic armor perks, limited to perks marked `spirit: true` (generic effects that work on a Prismatic kit; perks tied to an ability Prismatic can't equip are left out). Effects reuse the existing exotic perk code, so both perks apply at once through `Player.exo`.
   - Active only while Prismatic is equipped; on another subclass the item gives stats only and its tooltip says "Inactive: requires Prismatic". It is the exotic armor piece, so the one-exotic rule applies.
   - Sources (only once Prismatic is unlocked; before that they never appear):
     - One guaranteed when Prismatic unlocks, then in the class's exotic armor drop pool.
     - **Mission Blitz:** the run's exotic pick menu always includes an exotic class item option for your class, even when every other exotic is found.
     - **All Horde modes** (Horde, Endless, Roguelike Horde, Roguelike Endless): their exotic payouts (end of Horde, Endless every 10 waves past 30, `game.js:1561-1562`, and the roguelike equivalents) become the same pick menu as Blitz, and it always includes an exotic class item option.
   - Rolls are random; duplicates drop with new rolls.
6. **Postmaster hover:** hovering a Postmaster card shows the same tooltip as the inventory (stats, perks or exotic perks, mods, set, comparison with the equipped item). `showTip` also looks in `G.save.postmaster`. On phones, press and hold shows it.
7. **Loadout, UI, co-op:** `save.loadout[classId].prismatic` adds a `melee` key; `sanitizeLoadout` gets one Prismatic branch. Sixth subclass card, melee slot pickable on Prismatic, element pips on options. Co-op state adds one Transcendence flag. Effects already go through `castFx`.
8. **Release:** Update Log, Roadmap, title artwork "Prismatic", v5.3.

## Exclusions
- New abilities D2 added for Prismatic (Thruster, Acrobat's Dodge, Hammer Strike, Thunderclap, Pocket Singularity, Magnetic, Arcbolt, Thermite).
- The other 9 D2 Prismatic fragments, Bound enemies, Prismatic Wells, a Prismatic unlock quest.
- Exotic class item focusing or perk reroll vendor; legendary class item perks (D2 has none either).
- Prismatic Crucible tuning beyond "no damage resistance against players".

## Dependencies and risks
- **Size:** this is two updates' worth of work (Prismatic, class item slot and models). Planned as two build sessions on one branch (see chunks).
- **Save change (v15).** Adds a slot, grants an item, changes the Power average. Pre-update save, new save and a backup are all checked; co-op with one peer on v5.2 must not crash (unknown slot ignored).
- **Model rework** touches every class silhouette; risk of visual regressions in the character screen, third person and co-op. Checked in the preview browser per class.
- Many aspects assume their own element (Feed the Void, Consecration, Bleak Watcher). Each is tested on Prismatic with off-element abilities. Darkness hooks must key on the ability's element, not the subclass's.
- Two exotic perks at once plus Transcendence could trivialise Legendary. Playcheck compares Prismatic against a normal subclass.
- Grenade + Melee chord: activation takes the second key within 150 ms, before either ability fires.
- Count tests hard-code 5 subclasses, 7 equip slots and `SAVE_VERSION === 14` (`tools/tests.js:103, 136, 323, 328, 382`, appearance tests `:839-842`).

## Test plan
- Unit (`tools/tests.js`): curated lists reference existing ids; mixed-element Prismatic loadouts pass `sanitizeLoadout`, off-list picks fail; meter fill per element; activation, duration, extension, cap; meter visibility only on Prismatic; class item drops per class and set; one-exotic rule covers class items; exotic class item rolls two distinct `spirit` perks and is inactive off Prismatic; Prismatic locked until a Legendary campaign clear; Blitz and Horde pick menus include an exotic class item only when Prismatic is unlocked; `transcend` default binds (X, Z on trackpad) don't collide; v14 to v15 migration keeps Power; Postmaster tooltip lookup.
- `sh tools/run_tests.sh` all pass. `sh tools/playcheck.sh` on two missions per class with a Prismatic meta loadout (exotic class item equipped), plus the same missions on a normal subclass.
- Preview browser: subclass screen, Transcendence HUD (Prismatic and non-Prismatic), character screen and third person for every class and a few families, Postmaster hover (desktop and phone), title screen.

## Acceptance criteria
- Each class has Prismatic, unlocked by a Legendary campaign clear, with the curated lists and 12 Prismatic fragments; mixed loadouts save, reload and work in a mission.
- Blitz and every Horde mode exotic payout open a pick menu with an exotic class item option once Prismatic is unlocked, and never before.
- Transcendence meters show only on Prismatic, fill as specified, activate, swap the grenade and end cleanly.
- Every class has a class item slot with a per-family look on the model; old saves migrate with no Power loss.
- Exotic class items drop, roll two perks, apply both on Prismatic only, and obey the one-exotic rule.
- Postmaster items show their full tooltip on hover.
- All tests pass; playcheck clears with no console errors.

## Decisions (Bryce, 2026-11-17)
1. Prismatic unlocks with the Legendary campaign clear (not a Guardian level).
2. Class items count toward Light.
3. Transcendence has its own button: X (Z in the trackpad preset, where X is Aim).
4. Exotic class items: guaranteed one at unlock plus exotic drops; always an option in the Mission Blitz and every Horde mode exotic pick menu; never offered before Prismatic is unlocked.

## Suggested chunks (two build sessions, one branch `update/27-prismatic`)
- Session B1, class items: slot plumbing and hard-coded lists, save v15 migration, drops and sets, model rework, Postmaster hover. Tests and a visual check before moving on.
- Session B2, Prismatic: data, rules, `sanitizeLoadout`, Transcendence and HUD, Prismatic grenades, fragments, exotic class items, subclass screen, co-op flag, playcheck.
