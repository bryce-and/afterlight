# Architecture notes

The module map is in the README. These notes cover systems added during the overhaul and the rules for extending them.

## Save (`js/save.js`)
- Key `afterlight_save_v2`, `version: SAVE_VERSION` (currently 2).
- Changing the save shape means: add `MIGRATIONS[n]` (upgrades version n to n + 1 in place), bump `SAVE_VERSION`, and add a fixture test in `tools/tests.js`. `loadSave` runs the steps in order and refuses saves from a newer version without touching them.
- Pre-overhaul saves (`afterlight_save_v1`) are copied once to `afterlight_backup_v1`, then removed. A new Guardian takes only its settings.
- Storage is swappable (`useStorage`) so tests never touch the real save.

## Progression (`js/progression.js`)
- Pure data and functions: `XP` values, `xpToNext` curve, `levelInfo`, `rewardAt`, `RARITY_CURVE` + `rollRarity`, `LIGHT_CAP`.
- Level is derived from total XP (`save.progression.xp`) and never stored, so it can't drift. Claimed rewards are `save.progression.claimed` (level numbers).
- Level is account-wide (shared by every class, like the shared inventory). Subclass gating reads `unlockLevel` on the subclass in `data.js`; `activeKit` falls back to a starter if the stored choice is locked.
- XP is awarded through `gainXp` in `game.js`. Kills award it on every fireteam member's machine (host via `killEnemy`, members via the `kill` message in `coop.js`). Mission and cache XP go to whoever opens the cache.
- Drop rarity reads the player's level. Boss caches read a few levels higher (`bonus`), and the first item keeps its rare floor.

## Update Log / Roadmap (`js/releases.js`)
- `RELEASES` holds shipped updates only, newest first. `ROADMAP` holds curated teasers with a status from `ROADMAP_STATUSES` and no dates. The title screen renders both; adding an entry needs no UI change. Tests check ordering, statuses and the absence of dates.

## Known limitations
- `afterlight.html` (an older single-file entry) is stale and not maintained. `index.html` is the game.
- After a deploy, a browser can briefly pair a cached `index.html` with new modules. `tools/stamp_version.py` cache-busts every release; run it before each push.
