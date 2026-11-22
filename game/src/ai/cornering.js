// How fast an AI car may go toward the next bend of its planned line: tyres only grip so much
// (see vehiclePhysics), so a car has to be slow enough when the line turns, and braking takes
// distance. Used by police pursuit and race drivers.
import { wrapAngle } from '../core/mathUtils.js';

/** Speed a car can take a right-angle street corner at, in m/s. */
export const CORNER_SPEED = 9.5;
/** Speed through a gentle bend (a lane change, a kink), in m/s. */
const BEND_SPEED = 17;

/**
 * The highest speed from which the car can still brake (at `decel` m/s²) to make the first
 * bend of `points` ahead of it; Infinity when the line runs straight for `horizon` metres.
 */
export function speedForLineAhead(vehicle, points, { decel = 8.5, horizon = 110, from = 0 } = {}) {
  let px = vehicle.x;
  let pz = vehicle.z;
  let walked = 0;
  for (let index = from; index < points.length; index += 1) {
    const point = points[index];
    const leg = Math.hypot(point.x - px, point.z - pz);
    if (leg < 0.5) continue;
    const turn = Math.abs(wrapAngle(Math.atan2(point.x - px, point.z - pz) - vehicle.yaw));
    if (turn > 0.45 && walked > 0) {
      const limit = turn > 0.9 ? CORNER_SPEED : BEND_SPEED;
      return Math.sqrt(limit * limit + 2 * decel * walked);
    }
    walked += leg;
    if (walked > horizon) break;
    px = point.x;
    pz = point.z;
  }
  return Infinity;
}

/** A speed cap for steering at a target `angle` radians off the nose. */
export function speedForHeadingError(angle) {
  const off = Math.abs(angle);
  if (off < 0.2) return Infinity;
  return Math.max(CORNER_SPEED - 1.5, 30 - off * 17);
}
