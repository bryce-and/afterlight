# Decision Log

| Date | Decision | By |
|---|---|---|
| 2026-10-13 | `Afterlight Update V3` is the overhaul spec (the master prompt's "Overhaul V2" refers to it). | Bryce |
| 2026-10-13 | Pushing to `main` (live on GitHub Pages) is the release flow. No beta channel for now; revisit around U5. | Bryce |
| 2026-10-13 | Overhaul is a new experience: every player is fully reset at U1 (gear, vault, glimmer, progress, subclasses). The old save is kept in `afterlight_backup_v1`; settings carry over. | Bryce |
| 2026-10-13 | Versioning: live game tagged `v1.0` as the baseline; each update bumps the minor version (U1 = `v1.1`). | Bryce |
| 2026-10-13 | Keep Destiny names (exotics, bosses, Calus, the Leviathan, places). | Bryce |
| 2026-10-13 | Unit tests run in the browser (`tools/tests.html`); no Node install. | Bryce |
| 2026-10-13 | Guardian level is account-wide, shared by all three classes (matching the shared inventory). | Claude (U1) |
| 2026-10-13 | Reward-track items are claimed manually on the Level tab, so a full inventory never destroys a reward. The level 10 subclass unlocks automatically. | Claude (U1) |
| 2026-10-13 | Kill XP is shared by the whole fireteam; mission and cache XP go to whoever opens the cache. | Claude (U1) |
| 2026-10-13 | Mission recommended Light = 10 × mission number (10 to 180) under the base cap of 200. | Claude (U1) |
| 2026-10-13 | Public update names: v1.0 "Kindling" (the pre-overhaul baseline), v1.1 "First Light". | Claude (U1) |
| 2026-10-13 | U2 public name: "Clear Sight". | Bryce |
| 2026-10-13 | Primaries were weak because weapon damage never scaled with mission tier while enemy health grows 10% per tier. Weapons (and their perks) now scale at 75% of that pace, plus +10% for primaries; ability power 1.4 to 1.3. Enemy health unchanged. | Bryce (U2) |
| 2026-10-13 | Enemy debuffs (weaken, slow, suppress, burn, poison) stay on their own fields in U2 and move to the status registry in U3. | Bryce (U2) |
| 2026-10-13 | Status effects are runtime only (no save change). Weapon effects are scoped to the weapon slot and cleared when that slot's weapon is swapped. A re-applied effect keeps the longer timer unless the caller sets it. | Claude (U2) |
| 2026-10-13 | Stagger is decided by the enemy's owner (host), never applies to bosses, and has a cooldown so it can't chain. Fireteam members see the enemy stop but not the tilt. | Claude (U2) |
| 2026-10-13 | Add armor stats that affect ability cooldowns (Destiny-style) to U5 scope. Details are settled in the U5 proposal. | Bryce |
| 2026-10-13 | U3 public name: "Paths of Light". Shipped as one update (not split). Additive save v3 for per-subclass loadouts approved. | Bryce |
| 2026-10-13 | Gate the level 10 subclasses' aspects on the reward track: two aspects come with the subclass, the third at 13 (Sentinel), 16 (Arcstrider), 19 (Stormcaller). Fragments are shared by element, so instead of locking existing ones (which starters use), two new fragments sit on the track: Spark of Ions (22) and Echo of Instability (25). Unlocks are automatic; no save change. | Bryce (gating), Claude (levels, fragment approach) |
| 2026-10-13 | Hunter Triple Jump is the ground jump plus two air jumps (was one). The second air jump is 85% height so Hunters stay below Titan lift height. | Bryce (rule), Claude (height) |
| 2026-10-13 | Dawnblade is shown as Sunsinger. The internal id stays `dawnblade` so saves and fireteam messages keep working. | Bryce (name), Claude (id) |
| 2026-10-13 | Default loadouts reproduce v1.2 except where an ability became an aspect: Sunsinger's C on the ground is now Healing Rift and Phoenix Dive is an aspect on its own 16 s timer in the air; Gambler's Dodge recharges the melee but no longer reloads (Marksman's Dodge reloads). Sentinel's overshield moved from the Suppressor Grenade to the Sentinel trait (any grenade or class ability). | Claude (U3) |
| 2026-10-13 | Aspect and fragment recharge boosts multiply but are capped at 2x per ability (`REGEN_CAP`); Song of Flame and exotic armor sit outside the cap as before. | Claude (U3) |
| 2026-10-13 | Debuffs all go through `dealDamage` (so fireteam hits carry them). Burn and poison ticks still come from the attacker; the debuff marks the enemy. Jolt: 45 arc damage to the target and up to 3 enemies within 8 m, once per enemy every 0.6 s. | Claude (U3) |
| 2026-10-14 | V4 spec added alongside V3. Armor perks are replaced by mods (V3's "Legendary 2 perks" is superseded). Armor split into U5 Armor 2.0 and U6 Style; new updates Light Ascendant, Resonance, New Factions, Mobile (optional); later updates renumbered. | Bryce (V4) |
| 2026-10-14 | V4 quick fixes ship early as hotfixes H1 (v1.3.1: bugs and tuning, with the pending co-op fixes) and H2 (v1.3.2: small features and polish). | Claude (V4 triage) |
| 2026-10-14 | Interpretation to confirm in the U7 proposal: "8 fragments and 4 aspects" means 4 aspects per subclass and 8 fragments per element. | Claude (V4 triage) |
| 2026-10-14 | Every update session ends with a co-op connection check; a full co-op QA only when Bryce asks. | Bryce (V4) |
| 2026-10-14 | At the start of a session, ask whether several updates are being applied. If so, title-screen artwork is made only for the last one, and handoff prompts are written to chain the updates. | Bryce (V4) |
| 2026-10-14 | Mobile work (U20) applies only on phones. The desktop HUD, menus, AI and hitboxes stay as they are. | Bryce |
| 2026-10-14 | H1 single update this session (no chaining). Public name "Hotfix", v1.3.1. | Bryce |
| 2026-10-14 | Top-right feed: drops, level up, Underpowered, arena moving, co-op notices, reinforcements and ammo stay. Effects already on the buff HUD lose their feed line; one-off procs become 1.5 s buff HUD entries (general above the abilities, weapon below). The gold super bar stays; only the "Super ready" feed line went. | Bryce |
| 2026-10-14 | A co-op wipe with no lives fails the activity only before it is complete. On boss defeat or the final activity cache, everyone downed is revived in place, and players take no more damage. | Bryce (rule), Claude (no damage after completion) |
| 2026-10-14 | Bosses keep their engrams. Kill engrams: captain 5%, heavy 8% (Bryce); grunt and rusher 2% (Claude, accepted). | Bryce |
| 2026-10-14 | Both barricades: Guardians and their shots pass through; enemies and enemy shots don't. Both take the subclass color. | Bryce |
| 2026-10-14 | Celestial Nighthawk: Golden Gun 4x, other supers 2.5x. Ionic Trace: Electrostatic 8%, Spark of Ions 5%, one trace per 0.5 s, none from jolt chains. Hands-On 1.5%/piece, Dynamo 8%. | Bryce (Nighthawk), Claude (Ionic, perks) |
| 2026-10-14 | Members now see the leader's stagger tilt (reverses the U2 note). The snapshot carries a debuff bitmask and stagger time per enemy. | Claude (H1) |
| 2026-10-14 | No separate H2 hotfix. Its items move into U4 Arsenal (v1.4). | Bryce |
