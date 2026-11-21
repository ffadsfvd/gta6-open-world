// Ground height anywhere on the map: roads at 0, raised sidewalks and lots, the pier deck,
// the beach sloping into the sea and the deep harbour beyond the Old Port quay.
import { CURB_HEIGHT, GRID_X, GRID_Z, PIER, ROAD_HALF, SHORE, WATER_LEVEL } from '../core/config.js';
import { roadLineAt } from './cityPlan.js';

const EAST_EDGE = GRID_X[GRID_X.length - 1] + ROAD_HALF;
const LAND_MIN_X = GRID_X[0] - ROAD_HALF;
const LAND_MIN_Z = GRID_Z[0] - ROAD_HALF;
const PIER_RAMP = 8;
const HARBOUR_FLOOR = -6;

/** Sand height across the beach, falling below the sea past the shoreline. */
export function beachHeight(x) {
  const t = (x - SHORE.promenadeEnd) / (SHORE.shoreline - SHORE.promenadeEnd);
  if (t <= 1) return -0.05 + (WATER_LEVEL + 0.05) * t;
  return WATER_LEVEL - (x - SHORE.shoreline) * 0.11;
}

export function isOnPier(x, z) {
  return x > SHORE.promenadeEnd && x < PIER.maxX && Math.abs(z) < PIER.halfWidth;
}

export function groundHeight(x, z) {
  if (isOnPier(x, z)) {
    const t = Math.min(1, (x - SHORE.promenadeEnd) / PIER_RAMP);
    return CURB_HEIGHT + (PIER.deck - CURB_HEIGHT) * t;
  }
  if (z > SHORE.quayStart) {
    if (z > SHORE.quayEdge || x > SHORE.promenadeEnd) return HARBOUR_FLOOR;
    return CURB_HEIGHT;
  }
  if (x > EAST_EDGE) {
    if (x <= SHORE.promenadeEnd) return CURB_HEIGHT;
    return beachHeight(x);
  }
  if (x < LAND_MIN_X || z < LAND_MIN_Z) return CURB_HEIGHT;
  if (roadLineAt(x, GRID_X) >= 0 || roadLineAt(z, GRID_Z) >= 0) return 0;
  return CURB_HEIGHT;
}

/** Water too deep to stand or drive in. */
export function isDeepWater(x, z) {
  return groundHeight(x, z) < WATER_LEVEL - 1.1;
}

export function waterDepth(x, z) {
  return Math.max(0, WATER_LEVEL - groundHeight(x, z));
}
