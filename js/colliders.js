import { G } from './state.js';
// Collider math with no rendering dependency, so tools/tests.js can import it. physics.js re-exports it.

/**
 * Oriented (yawed) box collider. `min`/`max` stay the world-axis bounding box so every
 * broad-phase user (restHeight, reachability, nav) keeps working; `rot` holds the exact shape.
 * Local frame: x' = x cos + z sin, z' = -x sin + z cos is local -> world, so world -> local is the inverse.
 */
export function orientedCollider(cx, y0, cz, w, h, d, ry) {
  const c = Math.cos(ry), s = Math.sin(ry), hw = w / 2, hd = d / 2;
  const ex = Math.abs(c) * hw + Math.abs(s) * hd, ez = Math.abs(s) * hw + Math.abs(c) * hd;
  return {
    min: { x: cx - ex, y: y0, z: cz - ez }, max: { x: cx + ex, y: y0 + h, z: cz + ez },
    rot: { cx, cz, hw, hd, c, s },
  };
}
const localX = (q, x, z) => (x - q.cx) * q.c - (z - q.cz) * q.s;
const localZ = (q, x, z) => (x - q.cx) * q.s + (z - q.cz) * q.c;

/** True when a circle of radius r at (x, z) overlaps the collider's footprint (exact for oriented boxes). */
export function footprintHit(c, x, z, r) {
  if (x + r <= c.min.x || x - r >= c.max.x || z + r <= c.min.z || z - r >= c.max.z) return false;
  const q = c.rot;
  if (!q) return true;
  return Math.abs(localX(q, x, z)) < q.hw + r && Math.abs(localZ(q, x, z)) < q.hd + r;
}

function overlaps(p, r, h, c) {
  return p.y + h > c.min.y && p.y < c.max.y && footprintHit(c, p.x, p.z, r);
}

/** Push a circle out of an oriented collider along its shallowest local axis (mutates p). */
function pushOutOriented(p, r, c) {
  const q = c.rot, lx = localX(q, p.x, p.z), lz = localZ(q, p.x, p.z);
  const px = q.hw + r + 1e-3 - Math.abs(lx), pz = q.hd + r + 1e-3 - Math.abs(lz);
  let nx = lx, nz = lz;
  if (px < pz) nx = (lx < 0 ? -1 : 1) * (q.hw + r + 1e-3);
  else nz = (lz < 0 ? -1 : 1) * (q.hd + r + 1e-3);
  p.x = q.cx + nx * q.c + nz * q.s;
  p.z = q.cz - nx * q.s + nz * q.c;
}

function blockedAt(p, r, h, y) {
  const q = { x: p.x, y, z: p.z };
  return G.colliders.some((c) => !c.pass && overlaps(q, r, h, c));
}

function pushOutMin(p, r, c) {
  const pen = [
    ['x', c.min.x - r - 1e-3, p.x + r - c.min.x],
    ['x', c.max.x + r + 1e-3, c.max.x - (p.x - r)],
    ['z', c.min.z - r - 1e-3, p.z + r - c.min.z],
    ['z', c.max.z + r + 1e-3, c.max.z - (p.z - r)],
  ].sort((a, b) => a[2] - b[2])[0];
  p[pen[0]] = pen[1];
}

/** Axis-separated AABB movement for the player. Mutates pos & vel. Colliders marked pass (barricades) let players through. */
export function moveBody(pos, vel, dt, r, h, stepUp = 0.6) {
  const C = G.colliders;
  const res = { onGround: false, hitWall: false };
  for (const axis of ['x', 'z']) {
    pos[axis] += vel[axis] * dt;
    for (const c of C) {
      if (c.pass || !overlaps(pos, r, h, c)) continue;
      if (c.max.y - pos.y <= stepUp && vel.y <= 0.5 && !blockedAt(pos, r, h, c.max.y)) { pos.y = c.max.y; continue; }
      if (c.rot) pushOutOriented(pos, r, c);
      else if (vel[axis] > 0) pos[axis] = c.min[axis] - r - 1e-3;
      else if (vel[axis] < 0) pos[axis] = c.max[axis] + r + 1e-3;
      else pushOutMin(pos, r, c);
      res.hitWall = true;
    }
  }
  const prevY = pos.y;
  pos.y += vel.y * dt;
  for (const c of C) {
    if (c.pass || !overlaps(pos, r, h, c)) continue;
    if (vel.y <= 0 && prevY >= c.max.y - 0.02) { pos.y = c.max.y; vel.y = 0; }
    else if (vel.y > 0) { pos.y = Math.max(prevY, c.min.y - h - 1e-3); vel.y = 0; }
  }
  const open = !!G.level?.voidAt?.(pos.x, pos.z); // past an open edge there is no floor
  if (pos.y <= 0 && !open) { pos.y = 0; if (vel.y < 0) vel.y = 0; }
  res.onGround = (pos.y <= 1e-3 && !open) || C.some((c) => !c.pass && Math.abs(pos.y - c.max.y) < 0.03 &&
    footprintHit(c, pos.x, pos.z, r));
  return res;
}

/** Push a ground-bound circle (enemies) out of colliders in XZ. */
export function pushOutCircle(pos, r, h) {
  for (const c of G.colliders) {
    if (pos.y + h <= c.min.y || pos.y >= c.max.y) continue;
    if (c.rot) {
      const q = c.rot, lx = localX(q, pos.x, pos.z), lz = localZ(q, pos.x, pos.z);
      const cx = Math.max(-q.hw, Math.min(lx, q.hw)), cz = Math.max(-q.hd, Math.min(lz, q.hd));
      const ddx = lx - cx, ddz = lz - cz, dd2 = ddx * ddx + ddz * ddz;
      if (dd2 >= r * r) continue;
      if (dd2 > 1e-8) {
        const dd = Math.sqrt(dd2), ox = cx + (ddx / dd) * r, oz = cz + (ddz / dd) * r;
        pos.x = q.cx + ox * q.c + oz * q.s;
        pos.z = q.cz - ox * q.s + oz * q.c;
      } else pushOutOriented(pos, r, c);
      continue;
    }
    const nx = Math.max(c.min.x, Math.min(pos.x, c.max.x));
    const nz = Math.max(c.min.z, Math.min(pos.z, c.max.z));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * r;
      pos.z = nz + (dz / d) * r;
    } else {
      pushOutMin(pos, r, c);
    }
  }
}

/** players: ignore colliders Guardians pass through (barricades). */
export function pointInColliders(p, pad = 0, players = false) {
  for (const c of G.colliders) {
    if (players && c.pass) continue;
    if (p.x > c.min.x - pad && p.x < c.max.x + pad && p.y > c.min.y - pad && p.y < c.max.y + pad && p.z > c.min.z - pad && p.z < c.max.z + pad) {
      if (c.rot && (Math.abs(localX(c.rot, p.x, p.z)) >= c.rot.hw + pad || Math.abs(localZ(c.rot, p.x, p.z)) >= c.rot.hd + pad)) continue;
      return c;
    }
  }
  return null;
}
