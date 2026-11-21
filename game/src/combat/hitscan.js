// Instant bullets: the nearest hit along a ray among walls, people (legs, chest and head
// spheres) and cars (their boxes in each car's own frame).

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, radius) {
  const lx = ox - cx;
  const ly = oy - cy;
  const lz = oz - cz;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  let t = -b - root;
  if (t < 0) t = -b + root;
  return t >= 0 ? t : null;
}

function rayVehicle(ox, oy, oz, dx, dy, dz, vehicle) {
  const cos = Math.cos(vehicle.yaw);
  const sin = Math.sin(vehicle.yaw);
  const px = ox - vehicle.x;
  const pz = oz - vehicle.z;
  const lo = [px * cos - pz * sin, oy - vehicle.y, px * sin + pz * cos];
  const ld = [dx * cos - dz * sin, dy, dx * sin + dz * cos];
  const top = Math.max(1.3, vehicle.model.roofY || 1.4);
  const mins = [-vehicle.halfWidth, 0.25, -vehicle.halfLength];
  const maxs = [vehicle.halfWidth, top, vehicle.halfLength];
  let tMin = 0;
  let tMax = Infinity;
  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(ld[axis]) < 1e-9) {
      if (lo[axis] < mins[axis] || lo[axis] > maxs[axis]) return null;
      continue;
    }
    let t0 = (mins[axis] - lo[axis]) / ld[axis];
    let t1 = (maxs[axis] - lo[axis]) / ld[axis];
    if (t0 > t1) [t0, t1] = [t1, t0];
    tMin = Math.max(tMin, t0);
    tMax = Math.min(tMax, t1);
    if (tMin > tMax) return null;
  }
  return tMin;
}

/**
 * Casts one bullet. Returns { kind: 'none' | 'world' | 'character' | 'vehicle', distance,
 * x, y, z, character, vehicle, head }.
 */
export function castBullet(game, ox, oy, oz, dx, dy, dz, range, shooter) {
  let best = { kind: 'none', distance: range };
  const wall = game.collision.raycast(ox, oy, oz, dx, dy, dz, range);
  if (wall) best = { kind: 'world', distance: wall.distance };
  for (const character of game.characters.list) {
    if (!character.active || character === shooter || character.vehicle) continue;
    const cx = character.x - ox;
    const cz = character.z - oz;
    const along = cx * dx + cz * dz;
    if (along < -1 || along > best.distance + 1) continue;
    const across = Math.abs(cx * dz - cz * dx);
    if (across > 1.4) continue;
    const lying = character.state === 'down' || character.state === 'dead';
    const spheres = lying
      ? [[0, 0.25, 0, 0.55, false]]
      : [[0, 0.55, 0, 0.3, false], [0, 1.2, 0, 0.33, false], [0, 1.68, 0, 0.17, true]];
    for (const [sx, sy, sz, radius, head] of spheres) {
      const t = raySphere(ox, oy, oz, dx, dy, dz, character.x + sx, character.y + sy, character.z + sz, radius);
      if (t !== null && t < best.distance) best = { kind: 'character', distance: t, character, head };
    }
  }
  for (const vehicle of game.vehicles.list) {
    if (!vehicle.active || (shooter && shooter.vehicle === vehicle)) continue;
    const vx = vehicle.x - ox;
    const vz = vehicle.z - oz;
    const along = vx * dx + vz * dz;
    if (along < -4 || along > best.distance + 4) continue;
    if (Math.abs(vx * dz - vz * dx) > vehicle.halfLength + 1) continue;
    const t = rayVehicle(ox, oy, oz, dx, dy, dz, vehicle);
    if (t !== null && t < best.distance) best = { kind: 'vehicle', distance: t, vehicle };
  }
  best.x = ox + dx * best.distance;
  best.y = oy + dy * best.distance;
  best.z = oz + dz * best.distance;
  return best;
}
