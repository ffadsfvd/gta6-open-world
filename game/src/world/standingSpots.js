// Finds where to put Kai down (respawn at the hospital or police HQ, loading a save, a new
// game): a spot clear of walls, lamp posts and hydrants, out of the water, with open pavement
// ahead so the first step a player takes actually goes somewhere.
import { waterDepth } from './terrain.js';

/** Search pattern around the wanted point, nearest first (metres). */
const OFFSETS = [
  [0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2], [2.4, 0], [-2.4, 0], [0, 2.4], [0, -2.4],
  [2.4, 2.4], [-2.4, 2.4], [2.4, -2.4], [-2.4, -2.4], [4, 0], [-4, 0], [0, 4], [0, -4], [6, 0], [-6, 0], [0, 6], [0, -6],
];
const KNEE_HEIGHT = 0.35;

/** True when nothing taller than a curb stands within `radius` of (x, z). */
export function isClearAround(collision, x, z, radius) {
  const boxes = collision.query(x - radius, z - radius, x + radius, z + radius);
  for (const box of boxes) {
    if (box.top <= KNEE_HEIGHT) continue;
    const px = Math.min(Math.max(x, box.minX), box.maxX);
    const pz = Math.min(Math.max(z, box.minZ), box.maxZ);
    if ((x - px) ** 2 + (z - pz) ** 2 < radius * radius) return false;
  }
  return true;
}

/** True when a person can walk `length` metres from (x, z) facing `yaw` without bumping into anything. */
export function isWalkable(collision, x, z, yaw, length) {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  for (let step = 0.6; step <= length; step += 0.6) {
    const px = x + fx * step;
    const pz = z + fz * step;
    if (!isClearAround(collision, px, pz, 0.5) || waterDepth(px, pz) > 0.4) return false;
  }
  return true;
}

/**
 * A spot near `place` ({ x, z, yaw }) to stand on, and the way to face: the wanted heading if
 * it is open, else the nearest open one. Returns { x, z, yaw }.
 */
export function findStandingSpot(collision, place, ahead = 6) {
  const preferred = place.yaw ?? 0;
  const headings = [preferred, preferred + Math.PI / 2, preferred - Math.PI / 2, preferred + Math.PI];
  for (const [ox, oz] of OFFSETS) {
    const x = place.x + ox;
    const z = place.z + oz;
    if (!isClearAround(collision, x, z, 0.8) || waterDepth(x, z) > 0.4) continue;
    for (const yaw of headings) {
      if (isWalkable(collision, x, z, yaw, ahead)) return { x, z, yaw };
    }
  }
  return { x: place.x, z: place.z, yaw: preferred };
}
