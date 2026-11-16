# U25 v4.9 "Crucible": approved scope and build contract

Gate B approved by Bryce on 2026-11-16 with these answers: 6v6 Control, 1v1 Duel, real PvP between players is the goal, one map (Bannerfall). Branch: `update/25-crucible`. Built in three chunks (A, B, C; chunk C, the Crucible loot pool, added by Bryce 2026-11-16), released once as v4.9 after C in its own release session. Title artwork only in chunk C. Tracker: O2 (maps, one of 3 to 5 for now), O3 (Control and Duel), O4 (AI Guardians).

References (gitignored, this machine only): `docs/reference/bannerfall/` (callout map, Courtyard wall, Market alley, Depot street).

## Rules (Bryce, 2026-11-16)
- **Player vs player damage exists only in Crucible.** One switch decides it: the activity's `pvp: true` flag. Everything else (campaign, strikes, Blitz, dungeons, co-op) can never hurt a teammate. A later Gambit or campaign invasion mode would set the same flag; not built now.
- **PvP numbers are fully separate from PvE.** PvE numbers do not change. Time to kill is the main target; primaries land close together.
- Light off: health 100 plus the existing `shieldMax(resilience)`. No `weaponTierMult`, no Light, no `playerDmgMult`. Exotics use their frame's PvP numbers.
- One-hit rules: sniper on a headshot only; shotgun inside a set range; fusion only with the full volley inside a set range. Abilities and supers have their own PvP numbers (a throwing knife precision hit still one-shots).
- Spawn ammo, always the start amount (anything above it is lost on death): sniper, fusion, shotgun, grenade launcher 2; trace rifle 40; glaive 2; special sidearm 6; Forerunner 6. Heavy (swords included) always starts empty. Heavy crates on a timer give 25% of the magazine, rounded up, at least 1 (a sword pickup is about 10 swings). Small special ammo crates around the map. `AMMO_METER` off.
- AI Guardians use the same PvP numbers and ammo rules as players, and are deliberately "not too strong" (reaction delay, aim error, headshot cap, all data).

## Modes
- **Control, 6v6.** Three capture zones (A, B, C). A kill scores points; the more zones your team holds, the more each kill is worth (default 1 point plus 1 per zone held; numbers in data). First to the score limit, or the higher score when the timer ends. Humans fill teams first, AI Guardians fill the rest.
- **Duel, 1v1.** Rounds, first to 5. Human vs human, or human vs AI Guardian. (Bryce, 2026-11-16, during chunk B: Duel uses the same special-ammo rules and crates as Control, and supers stay on and charge as usual. This replaces the earlier "no special crates, no supers".)

## Map: Bannerfall (The Last City, Earth)
Our own low-poly layout following the callout map: mirrored west (Market) and east (Depot) halves around a central Plaza with the dead tree stump (Stump) on the south edge. Zones: **A Assembly Hall** (west), **B Courtyard** (north centre, under the big buttressed wall with the vertical patterned pillars), **C Depot Bay** (east). Callouts to build: Market, Top Market, Market Balcony, Depot, Top Depot, Depot Balcony, Passage (north), Plaza, Stump. Initial spawns west by Market and east by Depot. Look: sun-bleached cream plaster and concrete, arched doorways, red City banners and awnings, overhead cables, moss and grass, green-trimmed crates. Sized for 6v6 at our movement speed (scale lanes to sprint time, not to Destiny's metres). Heavy crate spot at Plaza; special crate spots in each half.

## Networking
- Crucible lobbies take up to 12 players (`MAX_CRUCIBLE`); the PvE fireteam cap stays 3.
- A `pvphit` message: the shooter's client resolves the hit (the same trust model as the existing `hit`), the host relays it to the victim, who applies damage and reports a kill. The host owns AI Guardians, zone capture, score, spawns and the timer. Same star topology over PeerJS.

## Exclusions
Other maps, a Crucible exotic or shader, exclusive perks, ranks (Glory, Valor), Trials, Iron Banner, other modes, matchmaking with strangers (room code only), per-exotic PvP tuning, any PvE balance change, Gambit or invasions. No save change. Reward per match completed: XP and one item from the Crucible pool (chunk C).

## Crucible loot (chunk C, Bryce 2026-11-16)
Its own pool, on the same pattern as `js/dungeon-loot.js`: a new `js/crucible-loot.js`; the weapons stay out of `LEGENDARY_WEAPONS`, the set out of `SET_IDS` (flag `crucible`, like `dungeon`), so nothing drops anywhere else (no random pool, reward menu, Blitz menu or kiosk roll). Only a finished Crucible match hands them out: one item per player per match (Control or Duel), win or lose.
- **Weapons (legendary, normal perk rolls):** Trust (hand cannon), Redrix's Broadsword (pulse rifle), Recluse (submachine gun), Randy's Throwing Knife (scout rifle), Revoker (sniper rifle), Cartesian Coordinate (fusion rifle), The Mountaintop (grenade launcher). Elements: one per weapon, chosen in the build so the pool covers Kinetic, Arc, Solar and Void.
- **Armor:** a Crucible set for every class, all four slots. Names proposed: Titan "Phoenix Strife", Hunter "Ankaa Seeker", Warlock "Wing Discipline" (Destiny Crucible armor names; the class pairing is unverified, Bryce to confirm or rename).
- **The look (unique, nothing else in the game uses it):** blackened gunmetal with Crucible crimson panels, worn bronze trim, a battle-scarred finish (chipped edges, scorch marks), red cloth strips on armor, and our own emblem (crossed blades over a horned shield, vector) on stocks and chest plates. Weapons and armor are recognisable as one family at a glance, in the inventory icon and in first person.
- PvP numbers: these weapons use their frame's PvP numbers like every other weapon.
- Show the pool in the Roll Tracker under its own "Crucible" heading.

## Chunks
- **A:** `js/pvp.js` (pure rules: PvP damage per frame, one-hit rules, ability and super PvP numbers, TTK, ammo rules, Control scoring), the PvP lookup in `dealDamage`, `damagePlayer` and the ability damage sites behind `pvp: true`, AI Guardians (`js/guardian-ai.js` on `buildCharacter`), Control 6v6 vs AI on Bannerfall (`js/level-bannerfall.js`), ammo crates, the Crucible Ops node, match HUD (score, zones, timer, kill feed) and end screen.
- **B:** networked PvP (`pvphit`, 12-player Crucible lobby, team pick, host-synced score, zones, spawns and timer), Duel.
- **C:** the Crucible loot pool and look (section above), the match reward hooked to it, title artwork for v4.9, docs ready for release.

## Risks
- Client-resolved hits: lag can show as hits around corners. Acceptable for friends; flagged, not solved.
- 12 player bodies plus a full map: frame-rate check at 6v6.
- A 12-peer star: the host relays every player's 20 Hz state; measure bandwidth with 4+ tabs.
- Ability numbers are inline in `js/abilities.js` and `js/darkness.js`; each damage site needs the PvP hook.

## Test plan
- Unit tests: primaries' optimal-range TTK within a set band; each one-hit rule only inside its constraint; spawn ammo, loss above the start amount, heavy rounding; Control kill points by zones held; **PvE damage for sample weapons and abilities identical to before**; no player damage when `pvp` is false.
- Headless: an AI vs AI Control match on Bannerfall finishes, no console errors, both teams score.
- Preview browser: Ops node, match HUD, end screen, and the map at 1280x720 and phone width.
- Co-op: two `?localtest` tabs on opposite teams (Control and Duel): hits, kills, score and zones agree on both screens; then one tab per team plus AI fill.

## Acceptance
Control (6v6) and Duel launch from the Crucible node solo and with friends and finish with a winner; players on opposite teams can kill each other only in Crucible; all tests pass; PvE numbers unchanged; AI Guardians fight, capture and use abilities without dominating a meta-loadout player (Bryce's call on feel).

## Chunk A status note (branch `update/25-crucible`)

Built: `js/pvp.js` (rules, TTK/one-hit/ammo/Control scoring, gamer-tag generator), PvP hooks in `dealDamage` / `explode` / `damagePlayer` / player hit and death (all behind `mission.pvp`), `js/guardian-ai.js`, `js/crucible.js`, `js/crucible-hud.js`, `js/level-bannerfall.js`, Crucible Ops node.
Evidence: `sh tools/run_tests.sh` 413 passed, 0 failed (includes PvE golden numbers and a source guard on the untouched PvE `dealDamage` lines). `sh tools/playcheck.sh earth 0` no errors. A spectate AI-vs-AI Control match in the preview ran to the score limit (101 to 57 in 275 s), no errors, about 0.7 ms per step, 235 colliders. Screenshots of the map overview and match HUD taken at 1280x720.
Changes from feedback: AI names are randomly generated gamer tags (no NPC names); Bannerfall was re-cut into walled courts, roofed passages, a kiosk, terrace, pergola and pens (Tower-like) and the AI paths around them.
Notes and gaps:
- Headless stepping must call `G.scene.updateMatrixWorld()` every step (hit boxes are read from world matrices). Do this in the chunk B check script.
- Not verified: render frame rate at 6v6, phone-width screenshots, Ops node and end-screen screenshots at the final map, crate pickups in play, no `tools/cruciblecheck` script yet.
- Ability and super PvP numbers: fallback table by source; only knife, golden gun and rocket are keyed; most ability sites carry no `kind` tag.
- `enemiesNear` chain perks do not chain to guardians.
- Special-slot default ammo is 6 and a sword crate gives 10 (my choices).
- AI guardians do not jump, have no class abilities or super, and keep one weapon (primary plus optional special).
- Fireteam Crucible is disabled until chunk B. Aim error was lowered to 0.02 rad and AI now paths in to trading range.

## Chunk B status note (branch `update/25-crucible`)

Built: `js/crucible-net.js` (networked PvP: `pp` own state 20 Hz, host `cs` snapshot 15 Hz with every body, zones, score, crates, Duel round and clock; `pvh` shooter-resolved hit, host relays to the victim; `pvd` death report; host `pvk` kill, `pve` end, `pvl` leave, `pvc` crate request), a 12-player Crucible lobby (`MAX_CRUCIBLE`, `net.cap` follows the host's selection `li -5`; the PvE cap stays 3), team pick (Blue/Red buttons, joiners go to the smaller team), host-synced score, zones, spawns, crates and timer, Duel (rounds, first to 5, 120 s round clock won by the higher health pool, 4 s break with everyone immune, the host AI or a second human, base spawns), `buildRoster` / `launchCheck` / `acceptPvpHit` in `js/pvp.js`, `launchCrucible` in `js/coop.js`, AI Guardians and humans as `Guardian` puppets on clients, `tools/cruciblecheck.sh`, title artwork and a draft v4.9 Update Log entry in `js/releases.js` (docs-keeper rewrites the notes at release).
Decisions: Duel has crates and supers (see Modes). Supers: the existing passive charge (0.5 %/s) plus kills; no Duel-specific regen was added. A client's AI Guardians are bodies the host drives; a human who leaves removes their body (Duel: the other Duelist wins). Humans are not replaced by AI mid-match. Duel auto-assigns sides (first Blue, second Red); Control uses the picked team.
Evidence: `sh tools/run_tests.sh` 420 passed, 0 failed (7 new: caps, team balance, rosters, Duel roster, launch rules, `acceptPvpHit` incl. PvE and spoof cases, handler source guard). `sh tools/cruciblecheck.sh control` and `duel`: AI vs AI matches finish (Control 102:70 and 101:38 in about 230 s simulated; Duel 5:0), a `pvh` from a foe hurts, from a teammate does not, from a different sender is ignored, and in a PvE mission no `pvh` ever hurts the player. `sh tools/playcheck.sh earth 0` no errors. Two `?localtest` tabs in the preview browser: Control (red guest, blue host, 10 AI): score, zones, crates and clock identical on both screens, a human standing in a zone is counted on the host, a client took a crate through the host; kills in both directions (guest to host direct, host to guest relayed) scored on both screens with the right killer; Duel: round end, 4 s break, reset to base spawns, score 5:1 ended the match with VICTORY and DEFEAT screens and the reward on each; PvE fireteam launch still shows both avatars. Ready Up from the real lobby UI launched Control on both tabs. Frame rate at 6v6 (host tab, 10 AI plus 2 humans, 1002x809): 120 fps (the display cap), worst frame 9 ms. Snapshot: 14 per second, about 520 bytes, 7 KB/s per client.
Not verified: a lobby with more than 2 real humans (only two tabs), real WebRTC (only `?localtest`), a full 12-human frame rate and bandwidth (extrapolated: about 0.8 KB per snapshot, about 12 KB/s per client, about 130 KB/s host upload), phone-width screenshots, the Duel clock-expiry round, a leaver mid-match, kills crediting with abilities and supers across the network, `Play Again` for a lobby.
Gaps: AI Guardians still do not jump or swap weapons (not done, not cheap); the shooter sees no hit confirmation from a human victim except through the kill line; the shooter-resolved hit model means lag can show hits around corners (flagged in Risks).

## Chunk B prompt
Afterlight U25 "Crucible" chunk B on `update/25-crucible`. Read `docs/U25_PROPOSAL.md` (incl. the chunk A note). Build: networked PvP (`pvphit` messages), 12-player lobby with team pick, host-synced score, zones, spawns and timer, Duel mode, AI jump and weapon swaps if cheap, a `tools/cruciblecheck` headless script. No title artwork and no release docs: chunk C (Crucible loot) comes next. Commit, add a chunk B status note, then stop and give Bryce the chunk C prompt.

## Chunk C status note (branch `update/25-crucible`)

Built: `js/crucible-loot.js` (7 legendaries: Trust hand cannon Arc, Redrix's Broadsword pulse Kinetic, Recluse SMG Solar, Randy's Throwing Knife scout Kinetic, Revoker sniper Void, Cartesian Coordinate fusion Arc, The Mountaintop grenade launcher Solar; item flag `crucible`; `makeCrucibleDrop` is a weapon or armor piece, even odds), `SETS.crucible` in `js/style.js` (flag `crucible`, out of `SET_IDS`; Titan "Phoenix Strife", Hunter "Ankaa Seeker", Warlock "Wing Discipline"; no set bonus, worn for the look), the look: `CRUCIBLE_LOOK` and a `crucible` part in `js/models.js` (crimson panels, bronze trim, scorch and chips, crossed-blades-over-horned-shield emblem on both sides), armor plate `crucible` in `js/characters.js` (emblem, red cloth strips, scorch), weapon icon cache key now splits dungeon/Crucible looks, match reward in `endMatch` (`makeCrucibleDrop`, behind the existing `C.over` guard, none when spectating), Roll Tracker "Crucible" heading with 7 entries and a Crucible source line, final v4.9 title artwork (crimson emblem, replaces the chunk B draft art), `crucible-loot.js` added to the import map (`tools/stamp_version.py dev25l`).
Evidence: `sh tools/run_tests.sh` 423 passed, 0 failed (2 new U25c tests: pool and names, never from any other source over 6000 random rolls plus menus, Blitz, starter gear and legacy sets; reward guard source test; H23 count updated by 7). `sh tools/cruciblecheck.sh control` and `duel`: one Crucible item after `endMatch` called three times, none for a spectated match, no page errors. Preview screenshots: all 7 weapon icons, all 12 armor icons, Roll Tracker heading, title screen v4.9.
Decisions to confirm: (1) Names: Mindbender's Ambition and Loaded Question already existed as ordinary legendaries, so the Crucible scout rifle and fusion are now Randy's Throwing Knife (retired from the world pool in frames.js) and Cartesian Coordinate (no name is shared with another weapon; Bryce to confirm they are the Crucible weapons he wants). (2) Armor class pairing (Phoenix Strife to Titan etc.) is still unverified. (3) The reward is a weapon or armor piece at even odds.
Not verified: first-person view in a live match (icons only), the Crucible armor on the in-game character in the Orbit screen, Roll Tracker detail card for a Crucible weapon, a networked second player receiving their own reward, phone-width screens. Weapon perks are normal legendary rolls (no exclusive perk).
