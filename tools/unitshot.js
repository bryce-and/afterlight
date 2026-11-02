// Dev-only enemy model line-up (U17d), run headless by tools/unitshot.sh or in the console on the running game:
//   const { lineup } = await import('/tools/unitshot.js');  await lineup(['vx_goblin', 'tk_vandal'], { loc: 'io' })
// Builds each unit with the game's own model builder and faction colours, and draws it from the front and three-quarters on a
// plain backdrop. Generic units take a faction prefix ('scrappers:grunt'). `crit: true` tints precision-hit meshes magenta.
const map = JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
const mod = (name) => import(new URL(map[`./js/${name}.js`], document.baseURI).href);

export async function lineup(units, { loc = 'io', size = [340, 420], crit = false, cols = 6 } = {}) {
  const [{ G }, E, F, D, THREE] = await Promise.all([mod('state'), mod('enemies'), mod('factions'), mod('data'), import('three')]);
  const L = D.LOCATIONS.find((l) => l.id === loc);
  if (!L) throw new Error(`No such location ${loc}`);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6f7a86);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404048, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x8a8f96 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const critMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
  const cam = new THREE.PerspectiveCamera(35, size[0] / size[1], 0.05, 200);
  const r = G.renderer, old = r.getSize(new THREE.Vector2());
  r.setSize(size[0], size[1], false);
  document.getElementById('tour')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'tour';
  wrap.style.cssText = `position:fixed;inset:0;z-index:99999;background:#111;display:grid;grid-template-columns:repeat(${cols},1fr);gap:3px;padding:4px;color:#fff;font:12px sans-serif;overflow:auto`;
  const errors = [];
  for (const id of units) {
    const [fx, t] = id.includes(':') ? id.split(':') : [null, id];
    const def = F.UNITS[t] || D.ENEMY_TYPES[t];
    const faction = fx || F.UNITS[t]?.faction;
    let m;
    try {
      if (!def || !faction) throw new Error('unknown unit');
      m = E.buildModel({ typeId: t, bossModel: null, maxShield: 0 }, F.enemyColors(faction, L), faction);
    } catch (err) { errors.push(`${id}: ${err.message}`); continue; }
    const s = def.scale ?? 1, h = m.height * s;
    m.group.scale.setScalar(s);
    m.group.position.y = (m.hover ? 0.35 : 0) + (def.fly ?? 0);
    if (crit) for (const mesh of m.hit) if (mesh.userData.crit) mesh.material = critMat;
    scene.add(m.group);
    const midY = m.group.position.y + h * 0.5, dist = Math.max(h, 1.6) * 2.1 + 0.6;
    for (const [name, a] of [['front', 0], ['3/4', 0.75], ['side', Math.PI / 2]]) {
      cam.position.set(Math.sin(a) * dist, midY + h * 0.15, Math.cos(a) * dist);
      cam.lookAt(0, midY, 0);
      r.render(scene, cam);
      const c = document.createElement('canvas');
      c.width = size[0]; c.height = size[1];
      c.getContext('2d').drawImage(r.domElement, 0, 0, size[0], size[1]);
      c.style.width = '100%';
      const cell = document.createElement('div');
      cell.append(c, document.createTextNode(`${id} ${name} (${h.toFixed(2)} m, ${m.hit.filter((x) => x.userData.crit).length} crit)`));
      wrap.append(cell);
    }
    scene.remove(m.group);
  }
  r.setSize(old.x, old.y, false);
  if (errors.length) wrap.prepend(Object.assign(document.createElement('div'), { textContent: 'ERRORS: ' + errors.join(' | '), style: 'grid-column:1/-1;color:#f66;font-size:16px' }));
  document.body.append(wrap);
  return { drawn: units.length - errors.length, errors };
}
