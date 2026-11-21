// U31: weapon sights. Hand cannons, shotguns and sidearms roll a sight; every other weapon uses its iron sights (fusions included).
// A sight changes how fast you aim down (`ads`), a little of the zoom (`zoom`), and the reticle drawn while aimed (`ret`, styled in style.css).
export const SIGHTS = {
  iron: { id: 'iron', name: 'Iron Sights', desc: 'The weapon\'s own sights.', ads: 1, zoom: 1, ret: null },
  reddot: { id: 'reddot', name: 'Red Dot', desc: 'A small red dot. Aim down sights 20% faster.', ads: 1.2, zoom: 1, ret: 'reddot' },
  holo: { id: 'holo', name: 'Holographic Ring', desc: 'A ring and dot. A little more zoom.', ads: 1, zoom: 1.12, ret: 'holo' },
  reflex: { id: 'reflex', name: 'Micro Reflex', desc: 'A tiny bright chevron. Aim down sights 10% faster with a touch more zoom.', ads: 1.1, zoom: 1.06, ret: 'reflex' },
};
/** Families that roll a sight, and the sights each can roll (weights repeat an id). */
export const SIGHT_POOLS = {
  hand: ['reddot', 'reddot', 'holo', 'reflex'], // the old floating-dot sights are gone from these models, so every one rolls a real sight
  shotgun: ['reddot', 'reddot', 'holo', 'reflex'],
  sidearm: ['reddot', 'reddot', 'holo', 'reflex'],
  forerunner: ['reddot', 'holo'],
};
const stable = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
/** The sight a weapon uses. A hand cannon, shotgun or sidearm saved before the old sights were removed (no `sight`) gets one of the new sights, always the same one for that weapon. Exotics with their own model keep it. */
export function sightFor(item) {
  if (item?.sight && SIGHTS[item.sight] && item.sight !== 'iron') return SIGHTS[item.sight];
  const pool = SIGHT_POOLS[item?.arch];
  if (pool && (!item.look?.model || item.arch === 'forerunner')) return SIGHTS[pool[stable(item.id || item.name) % pool.length]];
  return SIGHTS.iron;
}
export const rollSight = (arch, rnd = Math.random) => { const p = SIGHT_POOLS[arch]; return p ? p[Math.floor(rnd() * p.length)] : 'iron'; };
