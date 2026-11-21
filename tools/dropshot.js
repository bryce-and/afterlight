// Dev-only dropship line-up (U32), run in the console on the running game or through tools/dropshot.html:
//   const { lineup } = await import('/tools/dropshot.js');  await lineup()
// Draws each ship (Cabal, Fallen, Hive) from three angles and the Vex, Taken and Scorn gates, with the game's own renderer.
export async function lineup({ size = [420, 300] } = {}) {
  const [{ G }, M, THREE] = await Promise.all([import('../js/state.js'), import('../js/dropship-models.js'), import('three')]);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8aa0b8);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404048, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(20, 30, 15); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x8a8f86 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -12; scene.add(floor);
  const cam = new THREE.PerspectiveCamera(40, size[0] / size[1], 0.1, 400);
  const r = G.renderer, old = r.getSize(new THREE.Vector2());
  r.setSize(size[0], size[1], false);
  document.getElementById('tour')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'tour';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#111;display:grid;grid-template-columns:repeat(3,1fr);gap:3px;padding:4px;color:#fff;font:12px sans-serif;overflow:auto';
  const shoot = (label, dist, h, angle, lookY = 0) => {
    cam.position.set(Math.sin(angle) * dist, lookY + h, Math.cos(angle) * dist); cam.lookAt(0, lookY, 0);
    r.render(scene, cam);
    const c = document.createElement('canvas'); c.width = size[0]; c.height = size[1];
    c.getContext('2d').drawImage(r.domElement, 0, 0, size[0], size[1]); c.style.width = '100%';
    const cell = document.createElement('div'); cell.append(c, document.createTextNode(label)); wrap.append(cell);
  };
  const errors = [];
  for (const kind of ['cabal', 'fallen', 'hive']) {
    try {
      const ship = M.buildShip(kind); scene.add(ship);
      shoot(`${kind} 3/4`, 46, 12, 0.9); shoot(`${kind} side`, 48, 2, Math.PI / 2); shoot(`${kind} from below`, 34, -12, 2.6);
      scene.remove(ship);
    } catch (e) { errors.push(`${kind}: ${e.message}`); }
  }
  for (const f of ['vex', 'taken', 'scorn']) {
    try {
      const g = M.buildGate(f); g.scale.set(1.2, 1.3, 1.2); g.userData.ring.rotation.set(Math.PI / 2, 0, 0.4); scene.add(g);
      shoot(`${f} gate`, 11, 1.5, 0.5, 2); scene.remove(g);
    } catch (e) { errors.push(`${f}: ${e.message}`); }
  }
  r.setSize(old.x, old.y, false);
  if (errors.length) wrap.prepend(Object.assign(document.createElement('div'), { textContent: 'ERRORS: ' + errors.join(' | '), style: 'grid-column:1/-1;color:#f66;font-size:16px' }));
  document.body.append(wrap);
  return { errors };
}
