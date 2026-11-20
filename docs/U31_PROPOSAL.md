# U31 Proposal (Gate B): Exotic Armor Expansion, Sights, and the Great Loot Reshuffle

Proposed version: v5.6. Branch: `update/31-exotics-sights-loot`. Status: **approved by Bryce ("let's also..."), ready for build session** (scope updated after Bryce's answers, 2026-11-20). One release, v5.6.

## Objective
More exotic armor per class (each piece a real build-changer), rework weak existing exotics, give shotguns/sidearms/hand cannons red-dot sights, fix fusion sights, retune three exotics, add weapons and many perks (Stasis and Strand first), and redistribute perks across the whole loot pool.

## Scope

**A. Exotic armor.** Add 4 to 6 pieces per class (about 15 total) from Destiny 2, tuned to Afterlight's abilities and the Darkness subclasses. Each gets an `EXOTIC_ARMOR_PERKS` entry (and `spirit: true` where it should feed exotic class items). Lead candidates: Titan (Doom Fang Pauldron, Ashen Wake, Actium War Rig, Path of Burning Steps, Point-Contact Cannon Brace); Hunter (Mask of Bakris, Assassin's Cowl, Wormhusk Crown, Gyrfalcon's Hauberk, Dragon's Shadow); Warlock (Verity's Brow, Phoenix Cradle, Crown of Tempests, Eye of Another World, Karnstein Armlets). Final list is part of the Gate A review below.
**B. Exotic rework.** Per Bryce: armor that only grants a % of ability energy/cooldown feels weakest (Heart of Inmost Light, Hallowfire Heart, Ahamkara's Spine, Lucky Raspberry, Contraverse Hold, Starfire Protocol, Nezarec's Sin, Quiet One, Skullfort and similar). Each gets a distinct behavior change instead of a % (e.g. a new on-use effect, a changed ability, or a unique mechanic). Before/after list goes in the build notes. New armor avoids the plain "% recharge" pattern too.
**G. Crucible supers and Needlestorm.** In Crucible (PvP numbers, `pvp.js` super scale `{scale 0.08, min 12, max 60}`), most supers become a one-shot kill on a direct hit/within their core radius; roaming supers keep tick damage but kill fast, and I will list each super's new PvP value. PvE super damage is unchanged. Needlestorm radius grows from `r: 7` in `js/combat.js:110` (and its Darkness cast in `js/darkness.js`) to about 11, with matching visual size; damage per hit stays the same.
**C. Sights.** Add a `sight` field to weapons: Red Dot (small dot, faster ADS), Holo Ring, Micro Reflex, plus iron. Shotguns, sidearms and hand cannons roll one (shown on inspect, drawn as a reticle in the ADS view). Rolled per drop from a small pool, fixed on named weapons. Fusion rifles revert to normal (iron) sights. **Linear fusions:** zoom 2.6 down to about 1.6 with a normal sight, and the heavy-charge shake scaled down while ADS so shots are accurate.
**D. Exotic weapon fixes.**
- Arbalest: moves to the **special** slot, damage retuned to match special-slot linear output (about 0.55 of heavy), `mods` in `EXOTIC_WEAPONS`. Heavy-only `HEAVY_VERSION` no longer applies.
- Lord of Wolves: ammo bricks for it refill in proportion to shots fired (burst of 5 per trigger pull), so a brick gives a similar number of trigger pulls as other specials. Done by an ammo-per-brick override in `brick`/`reserve`, not a new pickup system.
- Dead Messenger: root cause found. In `EXOTIC_WEAPONS` numeric `mods` multiply the archetype stat, so `mag: 1` x the grenade launcher's 4 gives 4. Fix: `mag: 0.25` (1 round), with a test. Same check for Lord of Wolves (`mag: 4` multiplies the shotgun's 5).
**E. New weapons and perks.** About 24 new named legendary weapons (about 10 Stasis, 8 Strand, rest mixed) and about 30 new perks, weighted to Stasis and Strand (freeze/shatter, slow stacks, suspend, unravel, tangle, threadling and crystal synergies). All plug into `PERKS`, `PERK_COLUMNS`, `PERK_ELEMENT`, `frames.js` and `perkPoolFor`; no new systems unless a perk needs one.
**F. Loot reshuffle.** Rebuild perk pools so every existing perk appears across more weapon families and rarities, and rebalance per-archetype pools (shotguns, sidearms, hand cannons, snipers all get a distinct feel). Named legendaries are re-pooled; the same weapon keeps its archetype and element (Destinypedia rule). Needs a full pass through `PERK_COLUMNS`, `PERK_ARCH`, `PERK_SLOTS`, and the 91 named weapons.

**H. Boon drops as a percentage.** Today `rollDropBudget` in `js/boons.js:192` picks a fixed 2 to 5 orbs per round, nudged up a little by enemy count. Change it to a per-round drop **rate** (a % of that round's enemies) that rises with the wave and enemy count, so later waves with more adds drop more orbs. Initial tuning: about 6% of kills at wave 1 up to about 15% by wave 25 or so, with a cap (to confirm in playcheck) so Beacon still adds its +1 to +3 and `shouldDropBoon` still guarantees the budget lands before the round ends. Pure-function change plus tests; co-op carries the same budget through the host's drop plan, no message change.

## Exclusions
No new activities, enemies, or missions. No change to armor stat bands, mods, or Light math. No change to crucible-only weapon pool beyond perk redistribution. No new exotic weapons (only the three fixes).

## Dependencies
U28 armor bands, H23 Darkness perks, U22 Stasis/Strand (`darkness.js`), U27 prismatic (new armor must be checked against Prismatic), U23 exotic class items (new `spirit` perks join its pool).

## Risks
- **Saves:** Arbalest moving slot, perk renames/moves and re-pooling can invalidate rolled weapons. Plan: old rolls keep their perks and slot (`frames.js` lookups by name); no destructive migration. Needs your OK if any item must convert.
- Size: this is 3 to 4 sessions' worth. Recommend splitting into chunks (below).
- Balance: ~30 new perks and 15 armor pieces will need playcheck passes; numbers will be rough first pass.
- Sights add a rendering path in `player.js`/`ui.js` (both large); I would use `scout` to locate before touching.

## Suggested chunks (one build session each, release together or as v5.6 and v5.7)
1. Fixes and sights: D (Arbalest, Lord of Wolves, Dead Messenger), C (sights, fusion, linear).
2. Exotic armor: A and B.
3. Weapons and perks: E.
4. Loot reshuffle: F, then tests and release.

## Test plan
`sh tools/run_tests.sh` with new tests: every new perk is in a column and has text; every new weapon has valid arch/frame/element; Arbalest slot and damage; Lord of Wolves brick math; sight rolls only on allowed families; fusion has no scope overlay; every exotic armor name resolves in `EXOTIC_ARMOR` and `EXOTIC_ARMOR_PERKS`. `sh tools/playcheck.sh` on a touched mission per chunk. Preview-browser checks (screenshots): shotgun, sidearm and hand cannon red dots in ADS, linear fusion ADS, inspect screen with new perks, new armor on the character screen.

## Acceptance criteria
- At least 4 new exotic armor pieces per class, each with working behavior in-game.
- Every reworked exotic has a stronger described effect and a test.
- Fusion and linear fusion ADS is playable with no scope overlay and less shake.
- Arbalest drops as special ammo; Lord of Wolves brick yields comparable pulls; Dead Messenger mag is 1.
- New perks are all reachable in drops; Stasis and Strand weapons always have at least one on-element perk.
- Tests pass; no console errors in playcheck; pre-update save loads.

## Decided (Bryce, 2026-11-20)
One release; I pick the armor list; one update this session (title art for U31); Dead Messenger bug is the mag multiplier; weak armor = ability-% perks.

## Old questions (answered)
1. Which existing exotic armor feels weakest? (My guesses are in B; tell me yours.)
2. Dead Messenger already shows `mag: 1` in `js/data.js`. What do you see in play (two rounds, or a reload that adds one)?
3. Ship as one update (v5.6) or split into two releases?
4. OK for me to pick the new armor list from the candidates above, or do you want to veto names first?
5. Are you applying several updates this session? (If yes, only the last gets title art.)
