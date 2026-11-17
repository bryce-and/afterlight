# Decision Log

Decisions through 2026-11-09 are in `archive/DECISIONS_TO_2026-11-09.md`; grep it when touching an older system.

| Date | Decision | By |
|---|---|---|
| 2026-11-10 | H23 was requested as an update-sized change; Bryce chose to ship it as a hotfix (no title art). | Bryce |
| 2026-11-10 | Freeze threshold is 4 Stasis slow stacks (was 5), and slow lasts 6s (was 4s). Boss slow cap is 3. | Bryce |
| 2026-11-10 | Only Broodweaver threadlings perch on the player (Destiny 2 Warlock trait). Perched threadlings are cleared on a new map. | Claude |
| 2026-11-10 | Weapon hits never add slow to a frozen target, so the hit shatters it. | Claude |
| 2026-11-10 | Stasis and Strand named weapons always carry one Darkness perk in their Effect column. This changed the pools of those weapons only; existing items keep their rolls. | Claude |
| 2026-11-10 | Roll Tracker drop sources come only from real loot code paths; no destination-specific weapon drops exist. | Claude |
| 2026-11-10 | H24 perched threadlings release on any direct hit dealt by the caster (`DR.releasesPerch` in `js/darkness-rules.js`, called from `dealDamage` in `js/game.js`). Excluded: companion hits, jolted chain hits, perk source, raw or zero damage, teammates' relayed hits. Released threadlings target the enemy hit first, with no range limit around the caster. | Claude |
| 2026-11-10 | H24 perched look tuned in `STRAND.threadling`: scale 1.6, perchScale 0.6, perchY 0.3, perchR 0.7. | Claude |
| 2026-11-10 | H24 reproduced in the preview: casting Rift did not release perched threadlings, and its 3 Weaver's Call threadlings spawned at chest height where perched ones sat. Fix: spawn them at the feet. | Claude |
| 2026-11-10 | H24 Penumbral Blast and Winter's Wrath shard direct hits carry the existing `freeze` hit option; bosses are immune through `canFreeze`. | Claude |
| 2026-11-10 | H24 Iceflare Bolts are hitscan with a line-of-sight check (`hasLOS`), still 2 bolts, same damage and slow. | Claude |
| 2026-11-10 | H24 Diamond Lance in hand: `Player.holdingLance` joins `thirdPerson`, `tpsProp 'lance'` (new prop in `js/characters.js`), and left-click throws via `darkBasicMelee` using `aimForward`. | Claude |
| 2026-11-10 | H24 new helper `floorBelow(x, z, fromY)` in `js/colliders.js`: highest of terrain and solid collider tops under a point. Used by barricades (cast point), `raiseCrystal` and Stasis grenade effects. Cause of "stuck in the ground": these were all placed at y = 0. | Claude |
| 2026-11-10 | H24 Glacial Quake: each light slam raises `SUPER_TUNE.glacialquake.crystals` (4) crystals in a small cluster (the tuning existed but only one was raised); during the super, any of your crystals within `walkR` 1.1 m of you shatters (walking or sprinting, no aspect needed). Bryce asked for this mid-hotfix. | Claude |
| 2026-11-10 | H25 Avalanche joins `SLAM_SUPERS` (js/combat.js) and reuses the Well/Ward hop, dive and cast-on-landing flow (`Player.castSlamSuper` calls `darkBurst` for it). Per-super leap tuning in `SUPER_TUNE.avalanche`: hop 13, hopT 0.42, slamMax 3 (Well and Ward keep `SUPER_HOVER`). It stays in `BURST_SUPERS` for its 85% burst armor but no longer hovers. | Claude |
| 2026-11-10 | H25 The Tower in a fireteam (lifts the U16 v2.7 block recorded 2026-10-21): `coop.launchTower` broadcasts a `start` message with `tower: 1`; `startTower` calls `onMissionStart` and sets fireteam, coop and remote from net; `leaveTower` calls `onAbandon` in co-op (leader: `end` for everyone; member: `leave` alone). Only the leader can launch it, like every other activity; members' Tower buttons are disabled with "The leader takes the fireteam to the Tower". Tower NPCs, kiosks, Postmaster and range dummies stay local to each player. | Claude |
| 2026-11-10 | H25 verified with a two-tab `?localtest` co-op check: launch, both see each other, member leaves alone, leader leaving returns both to Orbit. | Claude |
| 2026-11-10 | H26 Darkness exotics are data in `EXOTIC_ARMOR_PERKS` with a `sub` field (the Darkness subclass they work with) and tuning in `DARK_EXO` (js/darkness-rules.js). Each effect checks the equipped subclass, so a piece does nothing on a Light subclass. | Claude |
| 2026-11-10 | H26 Drop gate: `exoticArmorLevel(classId, name)` returns the subclass unlock level (28); `exoticArmorFor(classId, level)` and `rollItem(..., level)` leave them out below it. Random drops, activity rewards, tier exotics, level rewards, reward menus and the Exotic Kiosk all pass the player's level. The Collections view still lists them. | Claude |
| 2026-11-10 | H26 Effects: Hoarfrost-Z raises 5 crystals (size 1.15, 1.1 m apart) instead of the barricade and keeps the reload; Abeyant Leap class cooldown x0.7 and Drengr's Lash reach x1.5; Renewal Grasps Duskfield radius x1.5 and a 0.7 damage-taken multiplier for any Guardian inside (relayed with the duskfield fx, so teammates get it on their machines); Cyrtarachne's Facade Woven Mail 6s on grapple; Osmiomancy Gloves reuse the Starfire Protocol banked second charge for Coldsnap and refund 20% grenade energy on a hit (at most once a second); Swarmers +1 threadling per weave and threadling life x1.5. | Claude |
| 2026-11-10 | H26 Each class now has 10 exotic armor pieces (the slot lists hold 2 or 3). | Claude |
| 2026-11-12 | Exotic missions, dungeons and raids follow `docs/ENDGAME_RULES.md`. | Bryce |
| 2026-11-12 | Traversal gaps are measured against every class jump and glide at Mobility 50 (typical full legendary set), not 100 and not exotics; Blink and Strand grapple are exempt. | Bryce |
| 2026-11-12 | Enemies never walk off ledges by themselves; players can still knock them off. | Bryce |
| 2026-11-12 | Raid and dungeon bosses use DPS windows, not damage gates; their final bosses have a DPS-phase enrage and a final stand. Exotic missions need neither. | Bryce |
| 2026-11-12 | Lethal wrong answers are allowed as a design option, not required; The Whisper has none. | Bryce |
| 2026-11-12 | The Whisper's hidden cache drops a legendary every run it is opened (no save change). | Bryce |
| 2026-11-12 | H27 rebinds remap at the input source (js/main.js) onto the canonical codes gameplay reads (KeyQ, mouse:left, wheel:1 and so on), so gameplay, co-op relays and prompts did not change. | Claude |
| 2026-11-12 | H27 Esc, Ctrl and Cmd (and CapsLock, ContextMenu) can never be bound: Esc is Pause; Ctrl/Cmd combine with movement keys into browser shortcuts the page cannot block (Ctrl+W). On a Mac, Ctrl+click counts as the right button. | Claude |
| 2026-11-12 | H27 Magic Mouse / trackpad preset: ADS on X and secondary click, melee on G, Next weapon on T plus wheel, scroll guard on (40 px step, 220 ms quiet). | Claude |
| 2026-11-12 | H27 Three named custom keybind slots; GitHub Issues is the contact in the Terms. | Bryce |
| 2026-11-12 | H27 Terms & Privacy agreement is versioned on its own localStorage key (not the save) so it applies before a Guardian exists and survives a reset; bumping TERMS_VERSION asks everyone again. | Claude |
| 2026-11-12 | H27 docs/reference/ (183 Destiny screenshots) untracked and gitignored so GitHub Pages stops serving them; local copies kept; purging old history (force-push) not approved. | Bryce |
| 2026-11-12 | H27 also ships the Light-flow changes (engram rate, cache Light, lowest slot, weapon infusion) that were in progress on the same branch. | Bryce |
| 2026-11-15 | U23 chunk C: The Gauntlet's stairs rise 0.82 m a step (9.02 m a row) so no class jump climbs a row even from 2.2 m cover. The first layout (0.65 m a step) failed `checkShadowRoute`. | Claude (U23) |
| 2026-11-15 | U23 chunk C: Calus is a new original model `emperorCalus`. The older `calus` model stays for the campaign. | Claude (U23) |
| 2026-11-15 | U23 chunk C: The Mindscape is entered through Calus's Gaze (Favored players only; unFavored it burns). The Thought Lanterns reuse the offering rule (`offer()`), shot instead of stood on. | Claude (U23) |
| 2026-11-15 | U23 chunk C: Solo tuning is a dungeon guard. A single hit at most 40% of health plus shield solo (fireteam 55%); all damage inside 0.5 s at most 65% (fireteam 85%). Solo adds deal 0.72 damage; solo bosses carry 0.55 health. Per-boss hpMult: Vhorrak 1.3, Kathrax 1.6, Calus 1.35. | Claude (U23) |
| 2026-11-15 | U23 chunk C: Hand cannons recoil up and right (adaptive 20 degrees, aggressive 23, precision straight up), the gun model kicks with it, and the iron sights are replaced by a floating glow dot. | Bryce (U23) |
| 2026-11-15 | U23 chunk C: Perf uses per-map opt-in merge options (`mergeCell`, `mergeMin`, `mergeStatic`); collider meshes stay hidden in the scene for raycasts. | Claude (U23) |
| 2026-11-15 | U23 chunk C: The in-game Roadmap is empty after v4.7 and shows "No new transmissions yet" until Bryce curates the next teaser. | Claude (U23) |
| 2026-11-16 | H28: H28 v4.7.1 includes the GPU leak fixes alongside the freeze fix. | Bryce (H28) |
| 2026-11-16 | H28: Non-finite input to `rayGround`, `hasLOS` or `lineClear` returns at once (no ground, no sight, not clear) and logs one `console.error` per call site. A unit that goes NaN is not removed; the root cause is fixed instead. | Claude (H28) |
| 2026-11-16 | H28: GPU freeing covers geometries, textures and light shadow maps only. Materials stay, since they share shader programs and freeing the last user would cost a recompile hitch. A freed geometry or texture that is used again is re-uploaded. | Claude (H28) |
| 2026-11-16 | U28 Mission Blitz (v4.8): five different missions from the whole campaign, seeded by the host; Legendary numbers (+25 Light, density 1.25) but no Light floor (enemy Light is always combat Light + 25); lethal, any death ends the run; no saving or resuming runs. Opens account-wide after a Legendary campaign clear on any Guardian, or `ultimateAll`. | Bryce |
| 2026-11-16 | Mission Blitz reward: an exotic pick menu of every exotic not found (random-roll pools only; class armor), or 3 exotic armor pieces when all are found; one pick. Solo gets the exotic only, 2 players add 1 legendary each, 3 add 2. Every player gets their own loot. Per Guardian `s.blitz = { clears, best }` (best = missions cleared in one run, 5 = a clear), default on read, no save version bump. | Bryce |
| 2026-11-16 | Armor stat bands by the highest campaign tier this Guardian has fully cleared (not account-wide): Base band until Legendary is cleared (legendary 45-55, exotic 48-58), Legendary band until Ultimate is cleared (56-62, 59-65), then Ultimate (63-70, 66-73). Common, uncommon and rare keep their totals. Owned armor is not changed. | Bryce |
| 2026-11-16 | The Activities screen becomes ops nodes: Vanguard Ops (Mission Blitz, Horde, Endless) and Endgame Ops (Exotic Missions, Dungeons); the list is data (`OPS_NODES` in `js/ui.js`) so Crucible Ops can be added later. | Bryce |
| 2026-11-16 | Implementation choices (Claude, U28): a Blitz mission keeps tier id `legendary` and counts as a Legendary clear (`recordClear`); its own config `BLITZ_TIER` (floor false, lethal true) is passed to `startMission`; any unlock menu a Blitz clear opens is queued and shows in Orbit. | Claude (U28) |
| 2026-11-16 | U25 Crucible (v4.9): Duel uses the same special-ammo rules and map ammo crates as Control, and supers stay on and charge as usual. This replaces the earlier "no special crates, no supers". | Bryce |
| 2026-11-16 | U25 Crucible (v4.9): no Light floor change. Light is off in the Crucible: health 100 plus the existing armor shield, no weapon tier multiplier, no player damage multiplier. Exotics use their frame's PvP numbers. | Claude (U25) |
| 2026-11-16 | U25 Crucible (v4.9): AI Guardians do not jump or swap weapons yet (not done, not cheap). They keep one weapon (primary plus optional special) and have no class abilities or super. | Claude (U25) |
| 2026-11-16 | U25 Crucible (v4.9): hits are resolved by the shooter's client and relayed by the host (the same trust model as PvE hits). Lag can show hits around corners; accepted for friends, not solved. | Claude (U25) |
| 2026-11-16 | U25 Crucible (v4.9) names: Randy's Throwing Knife (scout) and Riptide (fusion) replace Mindbender's Ambition and Loaded Question, which already exist as ordinary legendaries. Randy's Throwing Knife was removed from the world pool. Bryce to confirm both names. | Claude (U25) |
| 2026-11-16 | U25 Crucible armor (v4.9): Phoenix Strife (Titan), Ankaa Seeker (Hunter) and Wing Discipline (Warlock) are Destiny Crucible armor names. The class pairing is unverified; Bryce to confirm or rename. | Claude (U25) |
| 2026-11-16 | U29 was built and shipped in one session without a Gate B proposal: Bryce asked for it to be developed, implemented and pushed while he was away, with a review to read afterwards. | Bryce |
| 2026-11-16 | AI Guardian kits are random per match and fixed for every life (not per life), so players can learn each opponent; heavy weapons start empty and fill only from the heavy crate. | Claude (from Bryce's request) |
| 2026-11-17 | Both classic and roguelike variants are kept: classic Horde (`horde`) and Endless (`endless`) are unchanged, and Roguelike Horde (`horde_rogue`) and Roguelike Endless (`endless_rogue`) sit beside them. The two roguelike modes share one roguelike gate (`act.roguelike`). | Bryce |
| 2026-11-17 | Boons and weapon swaps last only for the run; caches still pay real items into the inventory. | Claude (U24) |
| 2026-11-17 | Roguelike boss rooms are sealed for the whole run (the doors close and the room is walled in). | Claude (U24) |
| 2026-11-17 | Fair spawns: enemies spawn at least 15 m from living players (suicide units included); players respawn 15 m from suicide units and 8 m from other enemies. | Claude (U24) |
| 2026-11-17 | ENDLESS_SCALE has no cap on health, damage or boss health (only the enemy count is capped, at 3.5x). | Claude (U24) |
| 2026-11-17 | Death camera (every mode): about 3 s on the body from behind, 1.5 s in the Crucible (its 4 s respawn), then an orbitable Ghost. | Claude (U24) |
| 2026-11-17 | Mobile HUD tiles are the ability and weapon buttons: tapping the grenade, melee and class tiles uses them, and tapping a weapon row swaps to it. | Claude (U26) |
| 2026-11-17 | No crouch or slide button on mobile, because the game has no crouch or slide. | Claude (U26) |
| 2026-11-17 | The melee tile fires the V ability, so plain punch (B) has no touch button. | Claude (U26) |
| 2026-11-17 | Phone pixel ratio is capped at 2.0, with cheaper shadows on phones. | Claude (U26) |
| 2026-11-17 | H31: On phones, Aim toggles by default (tap AIM to zoom in, tap again to zoom out). Players who already set this option keep their choice; the Aim button toggle setting turns it off to hold instead. | Bryce (H31) |
