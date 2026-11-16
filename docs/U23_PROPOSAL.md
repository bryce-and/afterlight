# U23 v4.7 "The Emperor's Shadow": approved scope and build contract

Gate B approved by Bryce on 2026-11-15, built in three chunks over several sessions on `update/23-emperors-shadow`, released once (v4.7) after chunk C. Title artwork only in chunk C. References: `docs/reference/emperors-shadow/` (gitignored): Calus (`calus-*`), the bather boss (`gulrot-*`, used only for build, palette and mood), the Castellum, the Pools hall, the Pleasure Gardens, the Underbelly map and corridor, and the four sigils (`sigils-axes-chalice-sun-hound.webp`).

## Design rules (Bryce, 2026-11-15)
- A dungeon, not an exotic mission: its own runtime (`js/dungeon.js`, `js/dungeon-rules.js`, `js/dungeon-mech.js`). The Whisper and `js/exotic-missions.js` stay as they are.
- The raid's shape (Pools, Underbelly, Pleasure Gardens, Gauntlet, Throne) with our own layouts, mechanics and names. Boss models are our own low-poly designs; the references set build, palette and mood only.
- The hardest activity in the game for a solo player; doable with a fireteam of 2 or 3.
- Traversal follows `docs/ENDGAME_RULES.md` (long, needs the mechanic, measured against every class jump and glide at Mobility 50, enemies throughout, telegraphed movers, a secret chest).
- Dungeon bosses use DPS windows, never damage gates. The final boss has an enrage counted in DPS phases (warning first) and a final stand.
- No timer. Unlocks for a Guardian who has cleared the Leviathan campaign mission (`lev1`), at any level.

## The mechanic: Imperial Favor
- Killing a Royal Taster (Psion) drops a gilded chalice. Picking it up gives **Favor** (status `favor`), counting down from x50 (one per second).
- While Favored you see the four sigils on the plates: **Axes, Chalice, Sun, Hound** (vector shapes, gold on a purple gem disc, silhouettes clearly different). You are safe in the bath water, which burns anyone without Favor.
- Offerings: a Favored player on a sigil plate presses Interact. Right: gold flare, chime, the board lights the step. Wrong: red flare, buzz, "1 of 3" / "2 of 3" over the plate and an add wave; the third wrong offering kills that player. The count is per player and resets when the round succeeds.
- Steps per round scale with the fireteam: 3 solo, 4 for two, 5 for three.

## Segments
| # | id | Segment | Kind | Chunk |
|---|---|---|---|---|
| 1 | baths | The Imperial Baths (boss: Vhorrak, the Anointed) | boss encounter | A |
| 2 | underbelly | The Underbelly | traversal (Watcher sentries, gold grates, secret chest) | B |
| 3 | gardens | The Pleasure Gardens | encounter (Royal Beasts, stealth, prism and spores) | B |
| 4 | gauntlet | The Gauntlet | traversal (carriers, sigil rows, shield walls) | C |
| 5 | throne | The Throne (final boss: Emperor Calus) | boss (Mindscape, dais DPS, enrage after 3 DPS phases, final stand "The Emperor's Feast") | C |

### The Imperial Baths (chunk A)
Four corner pools, each with a sigil plate; a raised center dais with the sigil board above it and three censers on chains. Vhorrak wades the baths, immune, cleaving and slamming. Ceremonial Bathers in a pool corrupt it after a while (its plate goes dark until they die). A full round lowers the censers; shooting all three breaks Vhorrak's ward and opens a DPS window. After a window the plates shuffle their sigils (from round 2 on), so you need Favor to read them.

## Difficulty
Enemy Light = your combat Light + 20. Solo: a death restarts the encounter. Fireteam: revives only (no lives, no down timer); a wipe restarts the encounter. Health scales 1.3 / 1.55 (existing `fireteamScale`).

## Exclusive loot (never in a random pool, a reward menu or a kiosk roll)
- Six legendary weapons with the Imperial look (white marble, gold filigree, purple glow), each rolling normal perks plus one exclusive perk: Gilded Decree (hand cannon, Kinetic), Royal Pardon (pulse rifle, Void), Feastbreaker (shotgun, Solar), The Taster's Due (SMG, Arc), Throneward (sniper rifle, Kinetic), Last Course (rocket launcher, Solar).
- Exclusive perks: Gilded Tithe, Taster's Instinct, Emperor's Feast, Royal Guard, Psionic Echo, Banquet Rush.
- Armor set "Imperial" for every class (Titan: Imperial Shadow, Hunter: Imperial Envoy, Warlock: Imperial Vizier), all four slots.
- Shader "Emperor's Shadow" (guaranteed on the first full clear).
- Exotic: a 5% chance per player per boss and encounter clear.
- Each boss and encounter clear drops one item from the pool for each player.

## Save
v14, additive: per Guardian `dungeons: { shadow: { clears, bestTime } }`. Nothing resets.

## Chunks
- **A:** dungeon runtime and pure rules (several bosses, DPS windows, enrage and final stand), Favor, offerings and sigils, the exclusive loot (weapons, perks, armor, shader, exotic), save v14, unlock and the Activities entry, the Imperial Baths and Vhorrak.
- **B:** the Underbelly and the Pleasure Gardens.
- **C:** the Gauntlet, the Throne and Calus, solo tuning, perf pass, title artwork, release.

## Status
- **Chunk A (2026-11-15): built, uncommitted on `update/23-emperors-shadow`.** New: `js/dungeon.js`, `js/dungeon-rules.js`, `js/dungeon-mech.js`, `js/dungeon-loot.js`, `js/dungeon-perks.js`, `js/level-shadow.js` (entrance and Baths only; bounds end at z -40, the north gate at z -36 leads on). Vhorrak (`anointedBather`, bosses.js) is a melee boss (Bryce): scale 0.8 (about 3.7 m body), the enemies.js melee lunge plus a telegraphed cleave and slam, no ranged fire. Units `lg_bather`, `lg_taster` (factions.js, `dungeon: 'shadow'`). `DpsBossFsm` already has the enrage and final stand for Calus (chunk C). Dev console: `shadowStart()`, `shadowFavor()`, `shadowWindow()`, `shadowCheckSigils()`.
- Not yet: solo DPS tuning (Vhorrak has about 43k health at Light 200; one window took about 1.6k from a test hit), a co-op run, Taster's Instinct gives damage instead of the range first proposed, the Roll Tracker does not list the dungeon legendaries.
- **Chunk B (2026-11-15): built, uncommitted on `update/23-emperors-shadow`.** New: `js/dungeon-b.js` (Underbelly and Gardens runtime, bound to the `js/dungeon.js` shell through `bindB`), `js/dungeon-mech-b.js` (grates, pistons, vents, levers, plaque, hatch, Watcher cones, flowers, prism, Gardens gate), `js/shadow-route.js` (`checkShadowRoute`). Pure rules in `js/dungeon-rules.js`: `watchYaw`, `inCone`, `awareStep`, `sectionOutcome`, `hurtAlarm`, `beastAt`, `flowerCount`, `bloomMult`, `newLevers` / `pullLever`, `downStep`. Units `lg_watcher`, `lg_royalbeast` (factions.js, `dungeon: 'shadow'`); models `watcher`, `royalBeast` (models-cabal.js), `huntmaster` (bosses.js). Status `bloom` (weapon damage, `imperialDmg`). Level bounds now reach z -302.
  - **The Underbelly** (traversal, z -38 to -207): decks A (y 2), B (y 2) and C (y 11) over a void pit (`seg.pit`: ground under 1 m has no floor). G1 is a 44 m gold-grate bridge, G2 a 12-step grate climb of 9 m; grates are solid only for a player holding Favor. Three 9 m pistons and two furnace vents run on the shared clock (`moverState` imported from exotic-rules.js, never edited). Royal Tasters appear on the deck you stand on. Each deck has Imperial Watchers (sweeping cones, line of sight); being seen for about half a second, or wounding one without killing it, calls reinforcements once per deck, unless all of a deck's Watchers die unseen. The lever puzzle: a plaque on deck B shows a 3-sigil order only under Favor; four sigil levers on deck C (right lights gold, wrong flashes red and resets, plus adds); solved opens a hatch to a hidden chest with one guaranteed dungeon item. The checkpoint moves to each deck you reach; a solo death restarts from that deck. Per-segment fog makes it dark purple. `checkShadowRoute`: no class jump or glide at Mobility 50 (taking off from deck cover too) skips G1 or G2, and every mover has a safe window.
  - **The Pleasure Gardens** (boss encounter, floor y 11): three Royal Beasts (immune) walk patrol loops between hedges; an awareness eye fills while one sees you (1.5 s or more at range), then it howls and the fireteam falls 5 s later. Favor holders carry a prism; standing 1.4 s at a bud lights it (+1 Bloom, 12% weapon damage per stack). 4, 5 or 6 flowers by fireteam size open a 16 s DPS window on Kathrax, the Royal Huntmaster (ranged harpoon cannon, a stomp up close; every hit capped by `cappedHit`; leashed to his pavilion outside the window and only shooting players within 18 m of it; model 4.3 m at scale 0.75). Beasts sit during the window. Fireteam: a player down 30 s without a revive wipes the team. Clear: chest, the north gate opens.
- Chunk B checks: 379 tests (7 new for chunk B). A stepped preview run covered every mechanic above solo; screenshots of the Underbelly, the Gardens, a beast and Kathrax. Not checked: co-op (snapshot fields `ck`, levers, alarms, flowers, beast positions, howl, down timer), the down timer in a real fireteam, a full manual play-through with mouse and keys. Known: adds at +20 Light hit hard (a Loyalist Psion snipe takes about 60% of a 215 pool; two shots in one frame can kill from full): this is chunk C's solo tuning. Leftover deck C enemies stay in the Underbelly after you cross. U20b (the reward-menu odds test) fails about 3 runs in 4 on HEAD as well: it predates chunk B.

