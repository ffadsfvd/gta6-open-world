// Walking routes for pedestrians: each block's sidewalk is a loop of four corners, and each
// corner links across a zebra crossing to the facing corner of the neighbouring block.
import { BLOCKS_X, BLOCKS_Z, blockBounds, specialOfBlock } from '../world/cityPlan.js';
import { GRID_X, GRID_Z } from '../core/config.js';

// Corners in clockwise order seen from above (north is -z): NW, NE, SE, SW.
const CORNER_OFFSETS = [[0, 0], [1, 0], [1, 1], [0, 1]];

export function cornerPoint(bx, bz, corner) {
  const b = blockBounds(bx, bz);
  const [cx, cz] = CORNER_OFFSETS[corner];
  return { x: cx ? b.walkMaxX : b.walkMinX, z: cz ? b.walkMaxZ : b.walkMinZ };
}

/**
 * Crossings from a corner: where you arrive, which junction's lights rule it and which traffic
 * axis must be red to cross.
 */
export function crossingsFrom(bx, bz, corner) {
  const [cx, cz] = CORNER_OFFSETS[corner];
  const options = [];
  const junctionI = bx + cx;
  const junctionJ = bz + cz;
  const junction = junctionJ * GRID_X.length + junctionI;
  const nx = bx + (cx ? 1 : -1);
  if (nx >= 0 && nx < BLOCKS_X) options.push({ bx: nx, bz, corner: cornerIndex(cx ? 0 : 1, cz), junction, axis: 'z' });
  const nz = bz + (cz ? 1 : -1);
  if (nz >= 0 && nz < BLOCKS_Z) options.push({ bx, bz: nz, corner: cornerIndex(cx, cz ? 0 : 1), junction, axis: 'x' });
  return options;
}

function cornerIndex(cx, cz) {
  return CORNER_OFFSETS.findIndex(([x, z]) => x === cx && z === cz);
}

/** Nearest sidewalk corner to a point, as { bx, bz, corner, x, z }. */
export function nearestCorner(x, z) {
  const bx = Math.max(0, Math.min(BLOCKS_X - 1, Math.floor((x - GRID_X[0]) / 80)));
  const bz = Math.max(0, Math.min(BLOCKS_Z - 1, Math.floor((z - GRID_Z[0]) / 80)));
  let best = null;
  let bestDistance = Infinity;
  for (let corner = 0; corner < 4; corner += 1) {
    const point = cornerPoint(bx, bz, corner);
    const d = (point.x - x) ** 2 + (point.z - z) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = { bx, bz, corner, ...point };
    }
  }
  return best;
}

/** A random spot on some block's sidewalk loop, optionally within a ring around a point. */
export function randomSidewalkSpot(rng, near = null, minDistance = 0, maxDistance = Infinity) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const bx = rng.int(0, BLOCKS_X - 1);
    const bz = rng.int(0, BLOCKS_Z - 1);
    const corner = rng.int(0, 3);
    const a = cornerPoint(bx, bz, corner);
    const b = cornerPoint(bx, bz, (corner + 1) % 4);
    const t = rng.next();
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    if (near) {
      const d = Math.hypot(x - near.x, z - near.z);
      if (d < minDistance || d > maxDistance) continue;
    }
    return { bx, bz, corner: (corner + 1) % 4, x, z, plaza: specialOfBlock(bx, bz) === 'plaza' };
  }
  return null;
}
