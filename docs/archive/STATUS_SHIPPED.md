# Shipped requirements (archive)

Rows moved out of `docs/OVERHAUL_STATUS.md` once their status reached "Complete and published". Same IDs and sections; read only when a shipped row matters.


## Core

| ID | Requirement | Current (code) | Update | Status |
|---|---|---|---|---|
| R08 | Player level 1 to 40 | XP curve in `progression.js`; kills shared by fireteam, mission and cache XP; HUD XP bar; Level tab | U1 | Complete and published (v1.1) |
| R09 | Third subclass drops at level 10 | `unlockLevel: 10` on Sentinel, Arcstrider, Stormcaller; unlock message mid-mission | U1 | Complete and published (v1.1) |
| R10 | Starters: Titan Sunbreaker+Fists of Havoc, Warlock Nova+Dawnblade, Hunter Golden Gun+Shadowshot | Gated in class select and the subclass panel; unit-tested | U1 | Complete and published (v1.1) |
| R11 | Drop quality scales with level; legendary rare at 15, near-exclusive at 40 | `RARITY_CURVE` by level (legendary ~5% at 15, ~90% at 40); unit-tested over 10k rolls | U1 | Complete and published (v1.1) |
| R12 | Leveling screen: reward track, legendary every 3 levels, exotic at 20 and 40 | Level tab: 40-node track, claim once, refuses when inventory is full | U1 | Complete and published (v1.1) |
| R13 | Modeled armor; unique exotic looks; destination sets that drop in all levels | Armor shows on the Guardian (Character screen, third-person body, fireteam avatars) from each piece's look (`js/style.js`, `js/characters.js`). Six destination sets drop as that destination's legendary armor. Exotics share one gold exotic look (Bryce: no per-exotic models) | U6 | Complete and published (v1.6) |
| R14 | Armor perk counts by rarity (superseded by V4: perks become mods) | Superseded: no perks. Four sockets on every piece, energy by rarity (4/6/8/10/10) | U5 | Complete and published (v1.5) |
| R15 | New destination adds new perks | Each destination's set brings its own 3-piece bonus (armor mods stay one pool) | U6 | Complete and published (v1.6) |
| R16 | Shaders recolor armor | 10 shaders, dropped from mission caches (never duplicates); one per class recolors all armor | U6 | Complete and published (v1.6) |
| R17 | Subclasses with working aspects, fragments, melee, supers, grenades | Registry `js/subclass.js`: 9 grenades shared by element, 2 class abilities per class, 36 aspects (4 per subclass), 24 fragments (8 per element), 21 supers, 11 class jumps; behaviors in `player.js` / `abilities.js`. v1.8: all 18 test loadouts (every aspect, fragment and jump) exercised in a mission with no errors | U3, U8 | Complete and published (v1.8) |
| R19 | Exotic weapons/armor: unique perk and model | Weapons: perks + models. Armor: class exotics (8 per class, two per slot, since v1.7) with Destiny perks, one shared exotic look. Exotic drops favor ones not found yet (`pickExotic` in `loot.js`, `exoticsFound` in the save) | U4/U6/U7 | Complete and published (v1.7) |
| R20 | Legendary armor: perks, matching sets, destination tie, 3-piece set bonus, character-screen icons | Destination sets with any-3-of-4 bonuses; armor icons rendered from the piece in the current shader | U6 | Complete and published (v1.6) |
| R21 | Weapon archetypes, models, diagonal D2-style icons, Arc/Solar/Void/Stasis/Strand symbols | `js/frames.js`: Destiny archetypes (frames) for all 12 families, stats fixed by archetype; 74 named legendaries with fixed archetype and element (Destinypedia-sourced); diagonal square icons; a symbol per element; Stasis and Strand weapon elements (no verbs yet). Legendary model variety not done | U4 | Complete and published (v1.4) |
| R23 | Stagger when shot | Non-boss enemies flinch 0.15 to 0.35 s on hits above a share of max HP (lower for crits, higher for captains and heavies), with a cooldown; `combat.js` `staggerFor` | U2 | Complete and published (v1.2) |
| R26 | Tight ADS spread | Primary ADS cones 40 to 50% tighter, specials tighter; aimed movement no longer widens the cone; hip fire unchanged | U2 | Complete and published (v1.2) |
| R27 | Damage numbers drift from the hit to the side | Numbers pop at the hit, drift out to alternating sides and ease down (`combat.js` `dmgDrift`) | U2 | Complete and published (v1.2) |
| R28 | Buff HUD: general effects above abilities, weapon effects below, with timers; exotic effects visible | Status registry (`js/status.js`) drives the HUD: name, timer bar, seconds, stacks; exotic effects gold-bordered. Enemy debuffs moved to the registry in v1.3 | U2 | Complete and published (v1.2) |
| R29 | Visible super-charged animation; yellow bar when charged | Charging keeps the element color; when full the bar turns gold, pops, glows and sweeps | U2 | Complete and published (v1.2) |
| R30 | Enemy health bars and names when aimed at, opacity fade | Plate above the aimed enemy's head (tracks it) with faction emblem, name, HP and shield; fades over ~1 s after looking away; bosses keep the boss bar | U2 | Complete and published (v1.2) |
| R31 | Primary weapon / enemy HP rebalance; slight ability tune-back | Weapons scale with mission tier at 75% of enemy HP growth, primaries +10%, ability power 1.4 to 1.3. Auto Rifle on a Vandal at matched Light: 7/12/18 body shots in missions 1/9/18 before, 6/7/7 after | U2 | Complete and published (v1.2) |
| R32 | Super gain and damage nerf; less super energy from kills | Passive 0.75 to 0.5%/s, kills 3 to 10% down to 2 to 6%, Hands-On 4 to 3, super damage -9% (`SUPER_POWER` 2.2 to 2.0) | U2 | Complete and published (v1.2) |
| R33 | Song of Flame uptime too high | No energy leak found (gain is blocked during supers). Duration 12 to 10 s, ability regen 8x to 4x. Modeled uptime with a kill every 2 s: 21% to 13% | U2 | Complete and published (v1.2) |
| R34 | Stormtrance initially hits up to 4 from the caster | Primary + 3 chains; verified in browser (4 of 5 clustered enemies per tick) | U2 | Complete and published (v1.2) |
| R35 | Celestial Nighthawk double-buffs Golden Gun? | Cause: the splash re-hit the shot's target. Splash now skips it; verified the 6x applies once and the target takes no splash | U2 | Complete and published (v1.2) |
| R36 | Storm Grenade hits multiple enemies; slight damage nerf OK | Every enemy under the cloud each 0.3 s tick, 40 to 30 per strike; verified 5 of 5 hit | U2 | Complete and published (v1.2) |
| R55 | Aspects and fragments | 4 aspects per subclass since v1.8 (2 slots, each opens 1 or 2 fragment slots); 8 fragments per element. Level 10 subclasses earn their third aspect at 13/16/19; Spark of Ions (22) and Echo of Instability (25) on the reward track | U3 | Complete and published (v1.3) |
| R56 | Armor mods | 57 mods (12 stat, 10 helmet, 12 gauntlet, 11 chest, 12 leg) in `js/armor.js`; Mods screen in `js/mods-ui.js`; unit-tested rules; every orb and hit mod exercised in a mission | U5 | Complete and published (v1.5) |
| R57 | Armor stats affect ability cooldowns, Destiny-style (added by Bryce, not in V3) | Discipline (grenade), Strength (melee) and each class's own stat (Titan Resilience, Hunter Mobility, Warlock Recovery) scale cooldowns 1.3x at tier 0, 1.0x at 5, 0.65x at 10; floor 0.4x. Checked in a mission: cdMax matches the formula | U5 | Complete and published (v1.5) |
| R58 | Hunter Triple Jump is the ground jump + 2 (added by Bryce) | Two air jumps, the second at 85% height. Peak 4.2 m, below Titan Catapult Lift (4.8 m) | U3 | Complete and published (v1.3) |
| R59 | Enemy debuffs on the status registry (weaken, slow, suppress, burn, poison) | `Enemy.status` with `ENEMY_STATUS`; all applied through `dealDamage` and sent to the enemy's owner; plate shows them. Jolt added for Arc | U3 | Complete and published (v1.3) |
| R18 | Super framework: animations, first vs third person check, aim check, subclass effects | Each super declares `camera` in `data.js`; all 9 checked in browser: camera matches and the enemy under the crosshair takes the damage. Super animations done in v1.9 (V67) | U3 (camera, aim), U9 (animations, hover) | Complete and published (v1.9) |
| R24 | VFX: tracking rounds are particles that track, not lightning; supers with cool factor | Swarm, Axion Bolt, Parasitic Nanites and Wolfpack Rounds are homing particle swarms (`swarm` projectile) that deal damage on arrival. Void VFX done in v1.9 (V71) | U4 (seekers), U9 (Void VFX) | Complete and published (v1.9) |

## Master-prompt requirements

| ID | Requirement | Update | Status |
|---|---|---|---|
| M1 | Title screen Update Log (released only) | U1 | Complete and published (v1.1) |
| M2 | Title screen Roadmap (curated teasers) | U1 | Complete and published (v1.1) |
| M3 | Requirement tracking, docs, decision log | U1 | Complete and published (v1.1) |
| M4 | Test and validation tooling | U1 | Complete and published (v1.1): `tools/tests.html`; 97 tests as of v1.8.2 |
| M5 | Versioned GitHub releases | U1 | Complete and published (v1.1) |

## V4 additions (2026-10-14)

| ID | Requirement | Update | Status |
|---|---|---|---|
| V01 | Ionic Trace refunds super too fast: investigate, nerf; tune super-related armor perks | H1 | Complete and published (v1.3.1): cause was a loop (uncapped Ionic Trace cooldown refunds on every Arc ability kill, jolt chains included, feeding Hands-On super per kill). Electrostatic 15 to 8%, Spark of Ions 10 to 5%, one trace per 0.5 s, none from jolt chains, Hands-On 3 to 1.5%/piece, Dynamo 12 to 8%. Scripted loop, empty to full super: Electrostatic + 3 Hands-On 5.8 s to 34.3 s; with Spark of Ions 1.1 s to 34.3 s; plain 77.8 s unchanged |
| V02 | Nerf Celestial Nighthawk (Nova Bomb, Golden Gun) | H1 | Complete and published (v1.3.1): Golden Gun 6x to 4x, other supers 4x to 2.5x (`combat.js` `NIGHTHAWK`) |
| V03 | Far fewer drops; caches give 2 to 3 items | H1 | Complete and published (v1.3.1): kill engrams grunt 2%, rusher 2%, captain 5%, heavy 8% (were 6/5/30/45%); bosses still drop 3; caches already gave 2 to 3 (unchanged) |
| V04 | Top-right feed shows item drops only | H1 | Complete and published (v1.3.1): feed keeps drops, auto-dismantle, inventory full, level up, Underpowered, arena moving, co-op notices, reinforcements, ammo. Buff duplicates removed; one-off procs are 1.5 s buff HUD entries |
| V05 | Thrown hammer clips into the ground | H1 | Complete and published (v1.3.1): rests on the surface it hits (`restHeight`); wall hits step back along the throw |
| V06 | Rally Barricade wider; players pass through, enemies don't | H1 | Complete and published (v1.3.1): Rally 2.6 to 4 m; both barricades are `pass` colliders (players and their shots pass; enemies and enemy shots blocked) and take the subclass color |
| V07 | Bigger enemy and player health bars; enemy bars follow HUD scale; HUD scale up to 200% | H1 | Complete and published (v1.3.1): plates and player bars about 1.5x; plate sizes use `--hud-scale`; slider 70 to 200% |
| V08 | Co-op: auto-revive downed players when an activity ends, even with no lives | H1 | Complete and published (v1.3.1): revived in place on boss defeat and on the final activity cache; no damage after completion; a wipe before completion still fails |
| V09 | Co-op: a player downed mid-jump drops to the ground | H1 | Complete and published (v1.3.1) |
| V33 | Co-op health check: zone/wave cleared with enemies alive; members missing host debuffs, stagger, zone and boss banners | H1 | Complete and published (v1.3.1): `waveStep` never clears on the check that spawns a wave (solo too); snapshot carries debuff bits and stagger; banners broadcast |
| V10 | Co-op: Arc Soul tracks correctly | H1 | Complete and published (v1.3.1): companion replays follow the caster's avatar (caster id on ability fx) |
| V11 | Thrown hammer glows and explodes after 7s if not picked up | U4 | Complete and published (v1.4): glows and pulses brighter, explodes (4 m Solar) at 7 s; picking it up first works as before |
| V12 | Hammer of Sol creates Sunspots; enemies inside burn | U4 | Complete and published (v1.4): every super hammer impact leaves a Sunspot. Every Sunspot (Sol Invictus too) burns enemies inside; the caster deals the damage |
| V13 | Healing Grenade places a white orb: heal + Restoration on touch | U4 | Complete and published (v1.4): white burst, then a white orb for 10 s; client-side, every Guardian can pick it up once on their own screen |
| V14 | Downed screen: skull animation, "You Died", "Reviving in X" | U4 | Complete and published (v1.4): solo and co-op |
| V15 | Co-op: Ghost glows over the downed body with "REVIVE" | U4 | Complete and published (v1.4) |
| V16 | Topbar "AFTERLIGHT" returns to the title screen | U4 | Complete and published (v1.4): in a fireteam it asks first, then leaves the fireteam |
| V17 | Title shows the current update name, "Version X.Y", and unique artwork | U4 (then every update) | Complete and published (v1.4): card from the newest `RELEASES` entry (`art` SVG); refresh every update |
| V18 | Armor mods replace perks: 4 sockets, 10 energy, slot 1 stat mods, a mod pool per armor slot, D2-style (no raid mods) | U5 | Complete and published (v1.5): energy is 4/6/8/10/10 by rarity (Bryce) |
| V19 | Mods screen with slide-in from the character screen's right-edge arrow | U5 | Complete and published (v1.5): arrow turns into a vertical tab under 900 px; locked below level 5 |
| V20 | Six armor stats (D2 new names) incl. cooldown stats | U5 | Complete and published (v1.5): the classic names (Bryce chose them over the new ones) |
| V26 | 4 aspects per subclass, 8 fragments per element | U8 | Complete and published (v1.8): D2 fourth aspects where they exist (Unbreakable, On the Prowl, Ionic Sentry, Hellion, Crackshot), D1 names for the rest (Tempered Metal, Aftershocks, Fast Twitch, Angel of Light); 10 new D2 fragments |
| V27 | Missing Destiny 2 Light supers | U8 | Complete and published (v1.8): 12 selectable supers (Burning Maul, Thundercrash, Ward of Dawn, Twilight Arsenal, Blade Barrage, Spectral Blades, Gathering Storm, Storm's Edge, Well of Radiance, Nova Warp, Chaos Reach, Daybreak), each fired in a mission with camera and damage checked; unlocked at levels 14/17/23/26 |
| V28 | More class jumps, including Blink | U8 | Complete and published (v1.8): High/Strafe Lift, High/Strafe Jump, Balanced/Strafe Glide; Blink on Arcstrider and Voidwalker only, moved in steps so it stops at walls |
| V32 | Subclass traits for the 6 subclasses without one | U4 | Complete and published (v1.4); superseded in v1.8.2: traits became aspects (V51) |
| V34 | Weapon archetypes per family (D2 frames); stats fixed by archetype; named legendaries always the same archetype and element; archetype shown on the item (added by Bryce for U4) | U4 | Complete and published (v1.4) |
| V35 | Ready Up bar in the Director for fireteams; the last Guardian to ready launches the leader's pick; solo launches directly (added by Bryce for U4) | U4 | Complete and published (v1.4) |
| V36 | Orbs of Power and armor charge (added by Bryce for U5) | U5 | Complete and published (v1.5): shared orbs claimed by the first Guardian to touch one (verified across two `?localtest` tabs); charge on the buff HUD |
| V37 | Nerf Arc Soul (too much super, too much damage) and jolt (added by Bryce for U5) | U5 | Complete and published (v1.5). Measured, 4 clustered enemies, 10 s: Arc Soul damage 3,791 to 533 (73% of the old total was jolt chains from a trait bug: companion hits counted as grenade or melee hits and jolted). An Arc Soul kill gave 7.5% super with 3 Hands-On, now 2%. Jolt chains on a jolted group 4,586 to 892 (a crowd no longer multiplies it), single target 1,147 to 892 |
| V38 | Health bar and lives stay on top (added by Bryce during U5) | U5 | Complete and published (v1.5): a v1.0 rule moved them to the bottom under 900 px wide |
| V39 | Character select screen and character switch on the Character screen (added by Bryce during U6) | U6 | Complete and published (v1.6) |
| V40 | Separate inventories per Guardian, Destiny-style: own gear, inventory and Light; vault, level, glimmer and shaders shared; armor class-bound (added by Bryce during U6) | U6 | Complete and published (v1.6) |
| V41 | Exotic armor per class with Destiny-accurate perks (added by Bryce during U6) | U6 | Complete and published (v1.6): Liar's Handshake, Raiden Flux and Starfire Protocol added; Actium War Rig, Armamentarium and Ophidian Aspect retired; Nighthawk Golden Gun only, Nezarec's and Contraverse Void only |
| V42 | Stats shown only on the Mods screen (added by Bryce during U6) | U6 | Complete and published (v1.6): the Mods screen opens at any level as a stats view |
| V43 | 4 more exotic armor pieces per class (added by Bryce, U7) | U7 | Complete and published (v1.7): Mask of the Quiet One, Ursa Furiosa, Hallowfire Heart, Peacekeepers; Graviton Forfeit, Young Ahamkara's Spine, Lucky Raspberry, Orpheus Rig; Skull of Dire Ahamkara, Sunbracers, Stormdancer's Brace, Lunafaction Boots. Each perk exercised on the live player in the preview |
| V44 | Exotic duplicate protection until all are found (weapons and armor) | U7 | Complete and published (v1.7): found exotics weigh 0.15, unfound 1, equal again once a pool is complete; unit-tested |
| V45 | Lunafaction Boots reload every Guardian in the rift | U7 | Complete and published (v1.7): the rift effect carries a flag each screen applies to its own player; verified with a replayed ally rift (one browser, not a two-tab co-op run) |
| V46 | Ability cooldowns longer: abilities strong, weapons still needed | U7 | Complete and published (v1.7): grenade and melee 1.5x, class 1.3x, kill refund 0.6 s to 0.3 s |
| V47 | Nova Bomb leaves a 6 s void field that damages, weakens and suppresses | U7 | Complete and published (v1.7) |
| V48 | Golden Gun base damage down, Nighthawk worth it, Knock 'Em Down's extra shots slightly weaker | U7 | Complete and published (v1.7): 1100 to 850 per shot (splash 350 to 270), Nighthawk 4x to 5x (one shot about the same as v1.6), Knock 'Em Down 0.85x |
| V49 | Health and shield regen a bit slower | U7 | Complete and published (v1.7): 25% slower rate, same delay |
| V50 | Sentinel Shield right-click guard visibly works, with an animation, synced in co-op (reported by Bryce) | H2 | Complete and published (v1.8.1): guard already cut damage, but its only cue was the first-person model, hidden in this third-person super. Now the body raises and twists the shield across the chest (`GUARD_POSE`, `characters.js`), the rim flashes on a blocked hit with `sfx.block`; the state packet carries `gd` (guarding) and `gh` (blocked-hit count). Guard cut 85% to 95% (`SENTINEL_GUARD`). Verified in two `?localtest` tabs |
| V51 | Subclass traits become aspects; redundant ones reworked, Destiny-inspired names (Bryce, H3) | H3 | Complete and published (v1.8.2): Explosive Pyre, Amplitude, Defender's Resolve, Chain of Woe, Abyssal Edge, Crackling Blade, Bloom (drains 8 every 0.5 s for 5 s to the caster, detonates and weakens on death), Unlimited Power, Gift of the Sun (5 s Restoration, grenades 30% faster). Each subclass's default loadout equips its own. Song of Flame's free grenades removed. Exercised in a mission |
| V52 | Remove Bastion; Towering and Rally Barricade equippable on Sentinel | H3 | Complete and published (v1.8.2): cause was Sentinel's default Bastion aspect swapping any class ability to Bastion Ward. Old saves drop Bastion (fragments past the open slots too); unit-tested and loaded from a v1.8.1-style save |
| V53 | Keys: V powered melee, B quick melee, F super; held Twilight axe throws on click | H3 | Complete and published (v1.8.2): HUD badges, controls list and README updated |
| V55 | Chaos Reach: twice as long, fires on cast, ends on F | H3 | Complete and published (v1.8.2): 4.5 to 9 s; F again ends it with the time-left refund (verified 40% at 1 s) |
| V56 | Daybreak: 2.5x jump, slow hover; wings placed properly | H3 | Complete and published (v1.8.2): measured peak 1.65 to 4.05 m (2.46x), sinks at 1.2 m/s (3.9 s in the air); wings fan from the shoulder blades |
| V57 | Well of Radiance 25 s, much stronger Restoration, burns enemies, timer buff | H3 | Complete and published (v1.8.2): heals 30/s plus Restoration that lingers 2.5 s; 30 burn damage per second (caster's copy); the Well buff counts down the well's time and clears on leaving |
| V58 | Nova Warp warps spawn weakening Void seekers | H3 | Complete and published (v1.8.2): 3 seekers to enemies within 15 m, verified all 3 weakened |
| V59 | Gathering Storm and Spectral Blades nerf | H3 | Complete and published (v1.8.2): about 20% less damage, still inside the U8 bands |
| V60 | Weaken: +30% from every source; yellow hit markers | H3 | Complete and published (v1.8.2): the +30% already applied to every source; hitmarker and damage numbers turn yellow |
| V61 | Rift and barricade timer above the ability bar | H3 | Complete and published (v1.8.2): Rift / Barricade buffs with the cast's duration |
| V62 | Firing breaks invisibility; sprinting 0.5 s cancels reload | H3 | Complete and published (v1.8.2): On the Prowl still weakens with the breaking shot; a cancelled reload keeps the magazine as it was |
| V63 | Thralls bigger; Thorn kill burst | H3 | Complete and published (v1.8.2): Hive rushers 1.15x (model and hitbox) |
| V64 | Weapons: Fusion and Auto RPM up, Shotgun close damage down and falloff sooner, SMG falloff sooner, heavy +10% | H3 | Complete and published (v1.8.2): Auto 600 to 650, Fusion 70 to 80, Shotgun 23 to 22 with point-blank 1.3 to 1.15 and range 12 to 9 m, SMG range 20 to 15 m |
| V65 | Incandescent, Voltshot and Destabilizing Rounds only on Solar, Arc and Void weapons | H3 | Complete and published (v1.8.2): new drops only; unit-tested over 4,000 rolls |
| V66 | Warlock robe redesign (less dress, more coat) | H3 | Complete and published (v1.8.2): straight coat tails open at the front, short back vent, shorter sash |
| V76 | Gift of the Sun distinct from Ember of Benevolence (Bryce, H4) | H4 | Complete and published (v1.8.3): no Restoration; Solar grenade and melee kills leave a Firesprite (caster only, 10 s, at most 3) worth 15% grenade energy; grenades 30% faster kept. Spawn cap and pickup refund exercised in a mission |
| V77 | Weaker aspects open 2 fragment slots (Bryce, H4) | H4 | Complete and published (v1.8.3): Amplitude, Defender's Resolve, Juggernaut, On Your Mark, Chain of Woe, Ascension, Icarus Dash. Unit-tested |
| V78 | Song of Flame: near-instant grenade and melee uptime (Bryce, H4) | H4 | Complete and published (v1.8.3): ability regen 25x during the super (grenade about 1.5 s, melee about 0.7 s at base cooldowns). Measured by stepping the game loop |
| V54 | Roaming supers 70% damage reduction (burst supers 85% during the U9 hover) | H3 (roaming), U9 (burst) | Complete and published (v1.9): roaming 70% from v1.8.2; burst supers 85% during the hover, unit-tested (100 damage lands as 15) |
| V67 | All supers third person with animations, hover hold on burst supers, Well/Ward ground slam, co-op VFX test | U9 | Complete and published (v1.9): all supers third person except Golden Gun and Song of Flame; poses are data-driven (`SUPER_POSES` in `js/characters.js`); burst supers hover; Well and Ward hop and slam; co-op syncs pose (`po`) and hover (`hv`); aim checked in browser for the 7 converted supers |
| V68 | Sentinel Shield barrier that blocks shots and blinds: projected by the shield while guarding, moves with the player | U9 | Complete and published (v1.9): projected while guarding, moves with the player, 6 m wide; blocks enemy shots for teammates behind it (`remoteBarrierBlocks`); player shots pass through; blinds on touch with the new `blind` enemy debuff (3 s); co-op: a member sees the host's barrier |
| V69 | Twilight Arsenal axe model and third-person hold | U9 | Complete and published (v1.9): shared `buildVoidAxe` model in `js/models.js`; held in third person by the caster and when picked up; no weapon fire until thrown |
| V70 | Hellion follows the player, lobs burning bolts, procs on any class ability; Phoenix Dive a Dawnblade class ability; Icarus Dash aspect | U9 (Phoenix Dive and Icarus Dash shipped early in H4) | Complete and published (v1.9): Hellion follows and lobs bolts: 30 direct hit, 15 splash (radius 2), burn 4 s (was 1.5), procs on any class ability. Phoenix Dive and Icarus Dash shipped in v1.8.3 |
| V71 | Void VFX rework | U9 | Complete and published (v1.9): `voidBurst`, `voidRing` and `voidMote` in `js/effects.js`; every Void explosion implodes with a dark core and purple shell |
| V72 | Slower leveling; rarity gates for use and drops | U10 | Complete and published (v2.0) |
| V73 | Orbs: armor charge only with charge mods, own counter; missing Font mods | U9 | Complete and published (v1.9): armor charge only with a charge-using mod (`usesCharge` in `js/armor.js`); every orb heals 15; armor charge counter above the ability bar; Fonts for all six stats |
| V74 | UI pass: Modify screen, more fragment slots, weapon silhouettes, wider character layout | U9 | Complete and published (v1.9): D2-style Modify screen from the subclass panel; aspects +1 fragment slot, cap 5; generic white weapon-family silhouettes in the mission HUD; character columns spaced at 50% minus 400px |
| V79 | Warlock rifts take the subclass element color, with white particles | U9 | Complete and published (v1.9): rifts take the subclass element color, with white motes |

## Future Update Implementation (Bryce, 2026-10-15)

| ID | Requirement | Update | Status |
|---|---|---|---|
| F01 | Destination exotics replaced by level-appropriate drops (today each destination's third mission guarantees an exotic on first clear, `openChest` in `game.js`); the base-clear menu is the campaign's exotic reward | U10 | Complete and published (v2.0) |
| F15 | Collection screen for every exotic weapon found | U10 | Complete and published (v2.0) |
| F19 | Legendary perk columns: Magazine or Reload, Damage, Effect (enemy effects, explosions and kill payoffs); a 9-perk pool per named weapon, 3 per column; uncommon rolls column 1, rare adds one Damage or Effect perk, legendary all three; new Destiny 2 perks (today one pool per ammo slot, `PERK_POOL`) | U10 | Complete and published (v2.0) |
| F20 | Reward-track engram rarity matches what is usable at that level (today a legendary every 3 levels, below U9's level 10 legendary gate) | U10 | Complete and published (v2.0) |
| F21 | Named weapons at every rarity, not only legendary (today commons to rares get generated names) | U10 | Complete and published (v2.0) |
| F22 | D2-style weapon inspect screen on right-click: the model behind, the perks that dropped | U10 | Complete and published (v2.0) |
| F26 | Split Loot 2.0 out of Arsenal II; U9's leveling, rarity gate and reward-track work moves into it | U10 | Complete and published (v2.0) |
| F27 | Steady Hands and Snapshot Sights leave the random rolls (no column fits them); Vampire Touch, Demolitionist and Killing Wind join the Effect column | U10 | Complete and published (v2.0) |
| F11 | Swords, Sidearms, special Grenade Launchers, Glaives (shield; glaive melee replaces B while equipped, with its own behavior), Trace Rifles, each with distinct behavior | U11 | Complete and published (v2.1): Sword, Sidearm, Glaive and Trace Rifle archetypes in `ARCHETYPES`, light Grenade Launcher frames; behaviors in `Player` (`updateSword`, `glaiveMelee`, `fireBeam`, `rocketRound`); named weapons at every rarity |
| F12 | Role balance pass before adding them; ammo type by archetype (Rocket-Assisted Sidearms and Rocket-Assisted Pulse Rifles special) | U11 | Complete and published (v2.1): `slot` on a `FRAMES` entry sets ammo per archetype (Rocket-Assisted Sidearm and Pulse Rifle, Light and Double-Fire Grenade Launchers are Special); per-slot damage band test; role check table in DECISIONS |
| F13 | More exotic weapons with unique perks and models (24 today) | U11 | Complete and published (v2.1): 14 real Destiny 2 exotics (24 to 38), each with its own perk, model and Collection entry |
| F28 | Remove "Exotic on first clear" from the destination menu (Bryce, 2026-10-19) | U11 | Complete and published (v2.1) |
| F29 | Heavy ammo: smaller reserves, more damage, slightly more drops (Rocket 6, Linear 13, Grenade Launcher 11, Machine Gun 180; damage about +22%; heavy bricks 7% and 35%) (Bryce, 2026-10-19) | U11 | Complete and published (v2.1) |
| F30 | New exotics must match real Destiny 1 or 2 exotics, with true-to-Destiny functionality (Bryce, 2026-10-19) | U11 | Complete and published (v2.1): cross-checked on Destinypedia, all 14 are Destiny 2 (none of the new families existed in Destiny 1) |
| F31 | Bait and Switch did not trigger with explosive weapons (Bryce, 2026-10-19) | U11 | Complete and published (v2.1): reproduced in the preview, `weaponExplosion` now reports its hit to `lootPerksOnHit` |
