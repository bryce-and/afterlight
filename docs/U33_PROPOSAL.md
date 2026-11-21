# U33 proposal (Gate B): "Transmissions" (v5.8)

Approved by Bryce on 2026-11-21 ("Build out everything else"). Build on `update/33-transmissions`.

## Objective
Tell the existing story as cinematic moments instead of subtitles and Tower walks, give the game a cinematic Halo / Destiny 1 style score that is often silent, give every planet its own ambiance, and voice every NPC (Ghost robotic). No new story is written; the lines in `docs/CAMPAIGN_DIALOGUE.txt` stay the source of truth.

## Scope
1. **Sound tab** in the pause menu: separate sliders for Effects, Ambiance, Music and NPC Voice (builds on `setEffectsVolume`). New settings read with `??`.
2. **Planet ambiance** (`js/ambiance.js`, new): a synthesized bed per destination, driven by a data table (Cosmodrome, Moon, Mars, Io, Titan, Tangled Shore, Dreaming City, Leviathan, Tower). Mars: dusty wind with slow gusts, low drone, grit hiss, rare distant thuds. Routes through the existing ducking and buses in `js/audio.js`.
3. **Music rework** (`js/music.js`): keep the four sections and `musicSectionFor`, replace the content. Slow pads, sub-bass swells, sparse piano and bell motifs, long reverb, minor and modal harmony. Music plays in phases with long silent gaps (exploration fades in and out on a timer), builds into combat, goes somber for loss beats and dramatic for bosses. New stingers per cutscene mood.
4. **Cutscene engine** (`js/cutscene.js`, new): data-driven scripts of shots (camera path, actors, animation, letterbox, fades), subtitle and voice cues, a music cue per shot. Skippable (Esc or hold), with a per-Guardian "seen" flag. Works in co-op (host triggers, all clients play, skip is per player).
5. **Seven cutscenes** (from Bryce's list):
   1. Ghost finds and revives the Guardian in the Cosmodrome car wreck (opens the game).
   2. Jumpship lands at the Tower, first steps, the Vanguard room.
   3. Ghost shows the Vanguard the Glimmer with the Cabal data signature (from the Devils' Lair); it leads into Ikora's existing "who is paying the Fallen" lines.
   4. Crota dies ("my father will hear of this").
   5. Post-mission Vanguard debriefs replace Tower visits where a scene reads better than a walk (list below, Bryce picks).
   6. Mara Sov in the throne room. Reference is in the conversation (pale blue skin, shaggy white hair, glowing eyes, dark leather vest, gold pauldrons, purple sleeves, fur collar, triangle pendant, dark maroon room with purple light and circle motifs). Reference image should be saved to `docs/reference/` so it is kept.
   7. Calus breaks apart into wires and servos after the Leviathan boss falls.
6. **NPC voices**: lines loaded by ID from `assets/voice/`, played on the Voice bus. Ghost goes through a ring-mod and filter chain in code. Subtitles always show, so a missing file never breaks a scene.

Candidate debrief swaps (Tower visits to cutscenes): after Cosmodrome (Zavala, Ikora, Cayde), after Mars (Zavala, Ikora), after Dreaming City (Zavala). Others stay as Tower talks. Final list at approval.

## Exclusions
New story, new missions, new bosses, the combat and loot systems, full motion-captured animation (shots use the existing low-poly rigs, posed and animated simply), Indoor Arrivals (still the in-game teaser), voices for the Guardian (stays silent).

## Dependencies and decisions needed
- **Voice source**: pre-generated files (recommended). Bryce to pick the TTS tool and supply the files (ElevenLabs free tier is a possibility; it limits characters per month and its terms ask for attribution and exclude commercial use, to be confirmed). I write `docs/U33_VOICE_SCRIPT.md` with one line per ID and voice. Estimate (unverified): the 7 cutscenes need about 6,000 characters; every existing mission and Tower line is another 15,000 or more, so a free tier likely covers the cutscenes plus Ghost's key lines first, the rest gradually. The game must work with any subset of files.
- **Mara and Calus models** need throne-room and reveal-grade detail. Mara is a new character model, Calus reuses the dungeon model's death reveal.
- **Save**: only a per-Guardian `seen` map and the new volume settings, added as optional fields read with `??`. No save version change planned. Pre-update saves must load.
- Spider, Rasputin and Eris voices: the Spider and Eris are cutscene-free, voiced only in mission lines. Rasputin's Russian lines are voiced by the TTS if it supports Russian, else subtitled only.

## Risks
- Synthesized music will not match a real orchestra. Mitigation: heavy reverb, slow pacing, silence, and tuning by ear with Bryce.
- Cutscene camera and animation work is the largest cost. Mitigation: build the engine and the Ghost revive first, then the rest reuse it. Short scenes, 20 to 40 seconds.
- Repo weight from voice files. Mitigation: mono, low-bitrate MP3, only lines that ship.
- Co-op sync for scenes. Mitigation: scenes are cosmetic and deterministic, the host sends only a start event.
- Audio autoplay rules: ambiance and music start after the first input, as now.

## Test plan
- `sh tools/run_tests.sh` passes, plus new unit tests: music phase and silence scheduler, ambiance table covers every destination, cutscene script validation (every cue references a real actor and line ID), seen-flag save round trip, volume setting defaults.
- `sh tools/playcheck.sh` on every touched mission (no console errors, meta loadout).
- Preview browser: each cutscene played and skipped, Sound tab sliders, Mara and Calus visuals, titles at 1280x720. Audio is checked by Bryce by ear, since I cannot hear it. I will say that plainly in the report.
- Old save loads, new save starts with the opening cutscene.
- Co-op: two `?localtest` tabs, one cutscene played together.

## Acceptance criteria
1. Pause menu has a Sound tab, four independent sliders that persist.
2. Every destination has its own ambiance bed, and Mars sounds dusty and windy.
3. Music is not constant: silent stretches in exploration, swells into combat, a bossy cue for bosses, a somber cue for loss scenes.
4. All seven cutscenes play, can be skipped, and are marked seen.
5. Ghost lines are robotic through the Voice bus, and missing voice files fall back to subtitles with no errors.
6. Existing Tower visits not swapped still work.
7. Tests and playcheck pass, no console errors.

## Build order (for session B)
A. Sound tab and buses. B. Ambiance. C. Music. D. Cutscene engine plus the Ghost revive. E. The other six scenes, Mara model. F. Voice loader and script file. Chunks are sized so each file is read once.

## Release notes
Title screen: new major update, so it needs its own name, "Version 5.8" and artwork. In-game Update Log and Roadmap (`js/releases.js`) updated by `docs-keeper`, and the "Indoor Arrivals" teaser stays.

## Decided: Ghost robot filter (Bryce picked "heavier", 2026-11-21)
Reference sample: `assets/voice-demo/100_robot_heavier.mp3` (dry: `100_dry.mp3`). It is an ffmpeg approximation; the in-game version is Web Audio, tuned by ear to match. Recipe, applied to Ghost's Phil voice only:
- Wet path: ring-mod with a 110 Hz sine, high-pass 350 Hz, low-pass 5 kHz, bit-crush to 8 bits (60% mix).
- Dry path: high-pass 200 Hz, low-pass 5.5 kHz, light 11-bit crush (30%).
- Mix dry 0.35 to wet 1, then a flanger (3 ms delay, depth 2, 0.4 Hz), a three-tap echo (15, 27, 41 ms at 0.35, 0.25, 0.15), makeup gain, limiter.

## Decided: Kadi and Rasputin robot filters (2026-11-21)
Samples in `assets/voice-demo/`. Same approach as Ghost (Web Audio in game, tuned by ear to the sample).
- **Kadi 55-30** (approved): `254_kadi_robot.mp3`. Wet path: 230 Hz ring-mod, high-pass 500 Hz, low-pass 7 kHz, 7-bit log crush (50%). Dry: high-pass 300 Hz, +4 dB treble. Mix dry 0.5 to wet 0.9, vibrato 6 Hz depth 0.15, very short two-tap echo (6, 11 ms), gain, limiter.
- **Rasputin** (no echo, pending Bryce's OK): `240_rasputin_robot_noecho.mp3`. Pitch down 18%, wet: 48 Hz ring-mod, high-pass 120 Hz, low-pass 3.5 kHz, 9-bit crush (40%). Dry: band 80 Hz to 4.2 kHz. Mix 1 to 0.7, gain, limiter. No echo.

## Decided: comms filter and Rasputin static (2026-11-21, samples pending Bryce's OK)
- **Comms setting:** every NPC voice (not Ghost) goes through a comms filter whenever the NPC is not in person (mission transmissions, act transitions). In person (the Tower, cutscenes) uses the dry voice. Ghost never uses comms. Sample: `assets/voice-demo/232_eris_comms.mp3` (dry: `assets/voice/232.mp3`). Recipe: high-pass 350 Hz, low-pass 3.2 kHz, compressor, light 11-bit crush, pink-noise bed (high-passed 800 Hz, 9 Hz flutter, low level), 120 ms delay on the voice so the static leads in.
- **Rasputin:** the robot chain from above (no echo) plus a white-noise static bed (high-pass 1.5 kHz, low-pass 7 kHz, 13 Hz tremolo, low level). Sample: `assets/voice-demo/240_rasputin_static.mp3`.
- Open: which NPCs are robotic besides Ghost, Rasputin and Kadi (none assumed).

## Update (2026-11-21)
- **Rasputin:** static rejected. Use the robot chain without echo and without static (`assets/voice-demo/240_rasputin_robot_noecho.mp3`) for now. Comms filter still applies when he is not in person (open: confirm).
- **Comms filter:** approved by Bryce.
- **Calus:** pitched down slightly, tempo kept (asetrate plus atempo). Candidates in `assets/voice-demo/`: `228_calus_pitch_0.92.mp3` and `228_calus_pitch_0.86.mp3`.
- **Comms filter, less low end** (Bryce, 2026-11-21): the comms high-pass moves up from 350 Hz. Candidates: 500 Hz (`232_eris_comms_hp500.mp3`) and 650 Hz (`232_eris_comms_hp650.mp3`), makeup gain raised to compensate. Final value to be picked by Bryce.
- **Comms high-pass decided: 650 Hz** (Bryce, 2026-11-21). Recipe otherwise unchanged (low-pass 3.2 kHz, compressor, light crush, makeup gain 2.0, pink-noise bed, 120 ms lead-in).
- **Calus pitch:** trying 0.80 (`228_calus_pitch_0.80.mp3`), tempo kept. Pending Bryce's OK.
- **Calus pitch decided: 0.80** (tempo kept), approved by Bryce, 2026-11-21.
- **Riven:** speaks into the player's mind, so no comms and no positional audio: an "ethereal" mind-voice, centered, with predelay. Candidates: `246_riven_ethereal.mp3` (160 ms predelay, five-tap reverb, octave-up shimmer at low level) and `246_riven_ethereal_deep.mp3` (260 ms predelay, longer reverb, quieter dry voice). Pending Bryce's pick. Note her "Knowledge perhaps?" line (247) was "in Ikora's voice" in the old script; the stage direction is not in the audio.
- **Psion Herald (line 251):** a chorus. Two source takes (`assets/voice/251_female.mp3`, `251_male.mp3`). The game layers seven copies: three of the female take at pitch 1.00, 1.06 and 0.94, four of the male take at 1.00, 0.92, 1.05 and 0.85, each time-stretched to about 10 s (tempo kept, 9.9 to 10.1 s) and started 0 to 60 ms apart, then a four-tap hall echo. Sample: `assets/voice-demo/251_psion_chorus.mp3`. Pending Bryce's OK. Playback is comms-filtered when heard over a transmission.
- Voice file naming exception: line 251 has two source files, `251_female.mp3` and `251_male.mp3`, instead of `251.mp3`.
- **Riven redo (hard "T" sounds in the echo):** the wet path is now de-essed, low-passed to about 2.8 kHz (2.2 kHz for the deep one) and smeared with a chorus before the echo, and the shimmer path is band-limited and de-essed too. Candidates: `246_riven_soft.mp3` and `246_riven_soft_deep.mp3`. Replaces the two earlier ethereal samples.
- **Psion Herald redo** (Bryce: first chorus sounded too filtered; also never over comms, so remove the comms line above): the new chorus has no low-pass and almost no echo. Seven copies, pitch 0.88 to 1.04, spread across the stereo field (each copy panned) and started 0 to 95 ms apart, so the layers don't comb-filter into each other. Samples: `251_psion_chorus_clean.mp3` (no reverb) and `251_psion_chorus_hall.mp3` (a faint two-tap hall). Pending Bryce's pick. The Psion Herald is exempt from comms.
- **Riven decided: `246_riven_soft.mp3`** (Bryce, 2026-11-21). The "soft" recipe: dry highpass 150 Hz, de-essed, volume 0.8. Wet: highpass 200 Hz, de-ess, lowpass 2.8 kHz, chorus, five-tap echo (110 to 650 ms), lowpass 3.2 kHz, 160 ms predelay. Shimmer: octave up, band-limited, de-essed, 240 ms predelay, volume 0.3. Centered, no comms. Applies to all three Riven lines (246, 247, 248).
- **Psion Herald decided: `251_psion_chorus_hall.mp3`** (Bryce, 2026-11-21). Seven stereo-panned copies, faint two-tap hall, no comms. Recipe in the "Psion Herald redo" note above.
- **Zavala:** 18 lines split into `assets/voice/` (012, 171 to 187). Pitched down slightly, tempo kept. Candidates: 0.94 and 0.90 (`171_zavala_pitch_0.94.mp3`, `171_zavala_pitch_0.90.mp3`). Pending Bryce's pick. In person in the Tower and cutscenes, comms otherwise.
- **Zavala decided: pitch 0.94** (tempo kept), Bryce, 2026-11-21.
- **Cayde-6:** 14 lines split into `assets/voice/` (014, 205 to 217). Exo: pitch up 5% (tempo kept) plus a robot layer. First tries were too subtle (Bryce: more robotic). Candidates: `206_cayde_robotic.mp3` (180 Hz ring-mod, 8-bit crush at 50%, three short metallic echoes at 4, 8 and 13 ms) and `206_cayde_robotic_plus.mp3` (210 Hz ring-mod, 6-bit crush at 70%, four echoes). Still lighter than Ghost's chain on purpose. Pending Bryce's pick.
- **Cayde-6 decided: `206_cayde_robotic.mp3`** (pitch up 5%, 180 Hz ring-mod, 8-bit crush, three short echoes), Bryce, 2026-11-21.
- Demo mixes of the decided treatments: `assets/voice-demo/convo_tower.mp3` (in person, no comms) and `convo_mission_comms.mp3` (mission transmission, Zavala over comms, Ghost never comms). Built with ffmpeg to approximate the in-game result.
- **Leveling** (Bryce: lines need leveling): after each character's treatment, every line is loudness-matched to the same target (-18 LUFS, true peak -2 dB). In the demo conversations the processed lines ranged from -20 to -39 LUFS before leveling (Ghost's lines came out the quietest, short ones worst). The build computes a per-line gain table (`assets/voice/levels.json`, measured after the character's filter) and the game applies it, so the clip files stay untouched. Rule for new voices: re-run the table after any filter change.
- **Comms redo** (Bryce: does not like the reverb on comms): the comms chain never had an echo or reverb, so the effect most likely came from the compressor release and the log bit-crush smearing each word's tail (and the leveling boost lifting each clip's quiet room tail). New chain: high-pass 650 Hz, low-pass 3.2 kHz, a noise gate to cut tails, no compressor, no crush, pink-noise bed, 120 ms lead-in. Samples: `232_eris_comms_clean.mp3` and `171_zavala_comms_clean.mp3`. Pending Bryce's OK.
- **Comms gate removed** (Bryce: Eris's lines were cutting out): the noise gate was too aggressive and clipped quiet words. Back to filters plus static only. Samples: `232_eris_comms_nogate.mp3` (no gate) and `232_eris_comms_softgate.mp3` (a very gentle gate, ratio 1.5). Pending Bryce's pick.
- **Comms decided: the soft-gate version** (Bryce, 2026-11-21): high-pass 650 Hz, low-pass 3.2 kHz, gentle gate (threshold 0.004, ratio 1.5, attack 5 ms, release 200 ms), pink-noise bed, 120 ms lead-in, makeup gain 2.0. Sample: `232_eris_comms_softgate.mp3`.
- **Crota, Petra, Mara Sov split** (2026-11-21): Crota `015`, Petra `016` and `218` to `224`, Mara `017` to `019` and `225` to `227`. Mara's ElevenLabs voice is "Elariel X". Treatments not yet chosen. Crota candidate: `015_crota_deep.mp3` (pitch down 22% with a sub-octave layer and a hall).

## Build assumptions (2026-11-21, Bryce said yes to the open questions and to building)
- Petra and Mara play plain; comms filter whenever not in person (cutscenes and the Tower are in person). Rasputin gets comms when not present. Ghost and Riven never use comms. Crota candidate pending, plain deep sample used until confirmed.
- Throne room scene (Mara, Petra): plays after the Mists mission (dc1), before the Spine climb. Debrief swaps: Cosmodrome, Mars and Dreaming City Tower visits become cutscenes; others stay as Tower talks.
- Save: only additive optional fields (`seen` cutscenes, volume settings) read with `??`, no version bump.
- Spider (`243` to `245`) and Asher Mir (`249`, `250`) split; all 176 voice files are in `assets/voice/`.
