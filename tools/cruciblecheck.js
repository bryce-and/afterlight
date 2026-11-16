// U25 Crucible headless check. Run by tools/cruciblecheck.sh, or in the browser console on the running game:
//   const C = await import('/tools/cruciblecheck.js');  await C.cruciblecheck('control')   (or 'duel')
// Plays an AI vs AI match (spectated: no human) to its end, then checks the networked-PvP rules on the live match: a pvh message from an
// opposite-team shooter hurts the local player, one from a teammate does not, and no pvh message ever hurts a player in a PvE mission.
// Reports the winner, both scores, kills, simulated seconds, the cost of a step, and every page error. Headless stepping must call
// scene.updateMatrixWorld() every step (hit boxes are read from world matrices).
const map = JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
const mod = (name) => import(new URL(map[`./js/${name}.js`], document.baseURI).href);

export async function cruciblecheck(modeId = 'control', { cap = 900 } = {}) {
  const [{ G }, S, g, Cr, Net] = await Promise.all([mod('state'), mod('save'), mod('game'), mod('crucible'), mod('net')]);
  const errs = [];
  const onErr = (e) => errs.push(e.message || String(e.reason));
  window.addEventListener('error', onErr);
  window.addEventListener('unhandledrejection', onErr);
  const cerr = console.error;
  console.error = (...a) => { errs.push(a.map(String).join(' ').slice(0, 200)); cerr.apply(console, a); };
  const lines = [];
  try {
    G.save = S.createSave('vanguard');
    const step = (n) => { for (let i = 0; i < n; i++) { G.scene.updateMatrixWorld(); g.updateGame(1 / 60); } };
    Cr.startCrucible(modeId, { spectate: true });
    const M = G.mission, C = M.crucible;
    const t0 = performance.now();
    let f = 0;
    while (!C.over && f < cap * 60) { step(1); f++; }
    const ms = (performance.now() - t0) / f;
    lines.push(`${modeId}: ${C.over ? `finished, winner ${C.winner}` : 'DID NOT FINISH'}  blue ${C.score.blue} : red ${C.score.red}  in ${(f / 60).toFixed(0)} s simulated, ${ms.toFixed(2)} ms per step, ${C.guardians.length} Guardians, ${G.colliders.length} colliders${C.duel ? `, ${C.duel.round} rounds` : ''}`);
    if (!C.over) lines.push('  ERROR the match did not end');
    if (C.score.blue + C.score.red === 0) lines.push('  ERROR nobody scored');
    if (!C.duel && (C.score.blue === 0 || C.score.red === 0)) lines.push(`  note: only one team scored (blue ${C.score.blue}, red ${C.score.red})`);

    // networked rules, on a fresh Control match with a human in it (host role, as in a lobby)
    g.cleanupMission?.();
    G.save = S.createSave('vanguard');
    Net.net.role = 'host'; Net.net.myId = 'me'; Net.net.members = [{ id: 'me', name: 'Me', cls: 'vanguard', team: 'blue' }];
    Cr.startCrucible('control');
    const C2 = G.mission.crucible, P = G.player;
    step(30);
    const red = C2.guardians.find((x) => x.team === 'red'), blue = C2.guardians.find((x) => x.team === 'blue');
    const hit = (by, d = 20, oh = 0) => { const before = P.health + P.shield; Net.net.handlers.pvh({ v: 'me', d, oh, by }, by); return before - (P.health + P.shield); };
    const a = hit(red.gid), b = hit(blue.gid);
    lines.push(`  pvh from a foe: ${a > 0 ? 'hurt' : 'NO DAMAGE'} (${a.toFixed(0)}), from a teammate: ${b === 0 ? 'safe' : 'HURT'}`);
    if (!(a > 0) || b !== 0) lines.push('  ERROR pvh rules wrong');
    const spoof = (() => { const before = P.health + P.shield; Net.net.handlers.pvh({ v: 'me', d: 20, oh: 0, by: red.gid }, 'someone-else'); return before - (P.health + P.shield); })();
    lines.push(`  pvh reported by a different sender: ${spoof === 0 ? 'ignored' : 'ACCEPTED'}`);
    if (spoof !== 0) lines.push('  ERROR spoofed pvh accepted');
    // a PvE mission: no pvh ever hurts
    g.cleanupMission?.();
    G.save = S.createSave('vanguard');
    g.startMission(0, 0, 'base');
    step(30);
    const Pe = G.player, h0 = Pe.health + Pe.shield;
    for (const by of ['g0', 'g7', 'me', 'x']) Net.net.handlers.pvh({ v: 'me', d: 50, oh: 1, by }, by);
    const dmg = h0 - (Pe.health + Pe.shield);
    lines.push(`  PvE mission (${G.mission.pvp ? 'pvp flag SET' : 'pvp off'}): pvh damage ${dmg} ${dmg === 0 ? '(none, as required)' : '(PLAYER HURT)'}`);
    if (dmg !== 0 || G.mission.pvp) lines.push('  ERROR player damage outside pvp');
    // U25 chunk C: a finished match pays exactly one Crucible item, even when the end is reported twice
    g.cleanupMission?.();
    G.save = S.createSave('vanguard');
    const count = () => [...G.save.inventory, ...(G.save.vault || []), ...(G.save.postmaster || [])].filter((i) => i.crucible || i.set === 'crucible').length;
    const before = count();
    Cr.startCrucible('control');
    step(30);
    Cr.endMatch('blue'); Cr.endMatch('blue'); Cr.endMatch('red');
    const got = count() - before;
    lines.push(`  match reward: ${got} Crucible item after endMatch called three times ${got === 1 ? '(once, as required)' : '(WRONG)'}`);
    if (got !== 1) lines.push('  ERROR the reward did not fire exactly once');
    g.cleanupMission?.();
    G.save = S.createSave('vanguard');
    const b2 = count();
    Cr.startCrucible('control', { spectate: true }); step(30); Cr.endMatch('blue');
    if (count() !== b2) lines.push('  ERROR a spectated match paid a reward');
  } catch (e) {
    lines.push(`RUN ERROR ${e.message} | ${String(e.stack).split('\n').slice(1, 3).join(' | ')}`);
  } finally {
    Object.assign((await mod('net')).net, { role: 'solo', myId: null, members: [] });
    window.removeEventListener('error', onErr);
    window.removeEventListener('unhandledrejection', onErr);
    console.error = cerr;
  }
  if (errs.length) lines.push(`  ERRORS ${[...new Set(errs)].join('; ')}`); else lines.push('  no page errors');
  return lines.join('\n');
}
