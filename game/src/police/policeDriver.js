// Pursuit driving for police cruisers: route along the street grid (A*) while the suspect is
// out of sight, cut straight at them (leading their velocity) when the way is clear, box them
// in or ram at high wanted levels, slow to a stop beside a suspect on foot, and back out when stuck.
import { clamp } from '../core/mathUtils.js';
import { speedForHeadingError, speedForLineAhead } from '../ai/cornering.js';

const REPLAN_SECONDS = 1.4;
/** Top pursuit speed by wanted level (m/s): one star is a patrol car, five stars is a pursuit unit. */
const PURSUIT_SPEED = [0, 25, 29, 33, 40, 46];

export class PoliceDriver {
  constructor(vehicle, rng) {
    this.vehicle = vehicle;
    this.rng = rng;
    this.waypoints = [];
    this.replan = 0;
    this.stuck = 0;
    this.reverse = 0;
    this.reverseSteer = 1;
    this.aggression = rng.range(0.7, 1);
    this.side = rng.chance(0.5) ? 1 : -1;
    this.mode = 'pursue';
    this.hold = null;
  }

  plan(game, tx, tz) {
    const network = game.network;
    const vehicle = this.vehicle;
    const fx = Math.sin(vehicle.yaw);
    const fz = Math.cos(vehicle.yaw);
    // Start from the junction the car is at, or the next one in its direction of travel: never
    // from one it has already passed (it would circle back to it forever).
    const near = network.nearestNode(vehicle.x, vehicle.z);
    let start = near;
    const nearDistance = Math.hypot(near.x - vehicle.x, near.z - vehicle.z);
    if (nearDistance > 12 && (near.x - vehicle.x) * fx + (near.z - vehicle.z) * fz < 0) {
      const ahead = network.nearestNode(vehicle.x + fx * 45, vehicle.z + fz * 45);
      if (ahead.id !== near.id) start = ahead;
    }
    const goal = network.nearestNode(tx, tz);
    const path = network.findPath(start.id, goal.id);
    this.waypoints = [];
    if (Math.hypot(start.x - vehicle.x, start.z - vehicle.z) > 12) this.waypoints.push({ x: start.x, z: start.z });
    for (let index = 0; index < path.length; index += 1) {
      if (index + 1 < path.length) {
        const line = network.lane(path[index], path[index + 1], 0);
        if (index > 0) {
          for (const point of network.turnPoints(path[index - 1], path[index], path[index + 1], 0, 0)) this.waypoints.push(point);
        }
        this.waypoints.push({ x: line.ex, z: line.ez });
      }
    }
    this.waypoints.push({ x: tx, z: tz });
  }

  /** A junction near where the suspect was last seen; a new one each time the car gets there. */
  searchPoint(game) {
    const seen = game.wanted.lastKnown;
    const vehicle = this.vehicle;
    const search = this.search;
    if (!search || search.from !== seen || Math.hypot(search.x - vehicle.x, search.z - vehicle.z) < 14) {
      const angle = this.rng.range(0, Math.PI * 2);
      const reach = this.rng.range(15, 75);
      const node = game.network.nearestNode(seen.x + Math.sin(angle) * reach, seen.z + Math.cos(angle) * reach);
      this.search = { x: node.x, z: node.z, from: seen };
      this.replan = 0;
    }
    return this.search;
  }

  update(dt, game) {
    const vehicle = this.vehicle;
    const controls = vehicle.controls;
    if (vehicle.destroyed || !vehicle.driver) {
      vehicle.clearControls();
      vehicle.siren = false;
      return;
    }
    vehicle.siren = true;
    if (this.mode === 'block') {
      vehicle.clearControls();
      controls.handbrake = true;
      return;
    }
    const player = game.player.character;
    const target = player.vehicle ?? player;
    const tvx = target.vx ?? 0;
    const tvz = target.vz ?? 0;
    const distance = Math.hypot(target.x - vehicle.x, target.z - vehicle.z);
    const clear = distance < 60 && !game.collision.segmentBlocked(vehicle.x, vehicle.z, target.x, target.z, 1);
    // Out of sight for a while: they only know where Kai was last seen, and comb the streets
    // around it instead of homing in on him. This is what makes hiding work.
    const search = !clear && game.wanted.searching ? this.searchPoint(game) : null;
    const goalX = search ? search.x : target.x;
    const goalZ = search ? search.z : target.z;
    let aimX;
    let aimZ;
    if (clear) {
      const lead = Math.min(1.1, distance / 22);
      aimX = target.x + tvx * lead;
      aimZ = target.z + tvz * lead;
      if (player.vehicle && distance < 26 && game.wanted.level >= 3) {
        // From three stars, pull alongside rather than straight into the bumper; below that,
        // tail the suspect from behind.
        const speed = Math.hypot(tvx, tvz) || 1;
        aimX += (-tvz / speed) * this.side * 3.4;
        aimZ += (tvx / speed) * this.side * 3.4;
      }
      this.waypoints = [];
    } else {
      this.replan -= dt;
      if (this.replan <= 0 || this.waypoints.length === 0) {
        this.plan(game, goalX, goalZ);
        this.replan = REPLAN_SECONDS;
      }
      while (this.waypoints.length > 1 && Math.hypot(this.waypoints[0].x - vehicle.x, this.waypoints[0].z - vehicle.z) < 6) this.waypoints.shift();
      const point = this.waypoints[0];
      aimX = point.x;
      aimZ = point.z;
      // On the last street before the suspect: head for them, not for a junction behind them.
      if (!search && this.waypoints.length <= 2 && distance < 70) {
        aimX = target.x;
        aimZ = target.z;
      }
    }
    const footTarget = !player.vehicle;
    const level = game.wanted.level;
    const targetSpeed = Math.hypot(tvx, tvz);
    // Coming the other way at the suspect's car: no head-on ramming below four stars. Slow
    // down and keep to the side, ready to turn in behind.
    let headOn = false;
    if (!footTarget && level < 4 && distance < 55 && targetSpeed > 4) {
      const toCopX = vehicle.x - target.x;
      const toCopZ = vehicle.z - target.z;
      const ahead = (toCopX * tvx + toCopZ * tvz) / ((distance || 1) * targetSpeed) > 0.5;
      const ownSpeed = Math.hypot(vehicle.vx, vehicle.vz) || 1;
      const opposite = (vehicle.vx * tvx + vehicle.vz * tvz) / (ownSpeed * targetSpeed) < -0.4;
      if (ahead && opposite) {
        // Pull over to the right, as a patrol car does to let a speeder pass, then turn in behind.
        headOn = true;
        aimX = vehicle.x + (vehicle.vx / ownSpeed) * 20 + (-vehicle.vz / ownSpeed) * 4.5;
        aimZ = vehicle.z + (vehicle.vz / ownSpeed) * 20 + (vehicle.vx / ownSpeed) * 4.5;
      }
    }
    const local = vehicle.worldToLocal(aimX, aimZ);
    const speed = vehicle.forwardSpeed;
    // Heading-error steering: decisive at corners and for targets behind, calm when lined up.
    const angleLeft = Math.atan2(local.x, local.z);
    const steer = clamp(-angleLeft * 2.2, -1, 1);
    // Fast on the straights, slowing in time for the corners the tyres can actually take.
    const topSpeed = PURSUIT_SPEED[level] * this.aggression + 4;
    let wanted = clear ? topSpeed : Math.min(topSpeed * 0.8, speedForLineAhead(vehicle, this.waypoints));
    wanted = Math.min(wanted, speedForHeadingError(angleLeft));
    if (headOn) wanted = Math.min(wanted, 11);
    // Searching: a slow crawl, looking down side streets.
    if (search) wanted = Math.min(wanted, 15);
    // A suspect on foot: brake in time to stop a few metres short, never run them down.
    if (footTarget && distance < 60) wanted = Math.min(wanted, Math.sqrt(2 * 7 * Math.max(0, distance - 8)));
    else if (!footTarget && clear && distance < 22) {
      // Close behind a suspect's car: shadow it, only ramming from four stars.
      const push = level >= 4 ? 5 : distance > 9 ? 1.5 : -1;
      wanted = Math.max(4, targetSpeed + push);
    }
    if (local.z < 0) wanted = Math.min(wanted, 12);
    // Stuck: wanted to go but did not move; back up with the wheel turned the other way.
    if (this.reverse > 0) {
      this.reverse -= dt;
      controls.throttle = 0;
      controls.brake = 1;
      controls.handbrake = false;
      controls.steer = this.reverseSteer;
      return;
    }
    if (wanted > 3 && Math.abs(speed) < 0.8) {
      this.stuck += dt;
      if (this.stuck > 1.3) {
        this.stuck = 0;
        this.reverse = 1.1;
        this.reverseSteer = -Math.sign(steer || 1);
      }
    } else {
      this.stuck = 0;
    }
    const error = wanted - speed;
    controls.steer = steer;
    controls.throttle = error > 0 ? clamp(error * 0.3, 0.2, 1) : 0;
    controls.brake = error < -1 && speed > 0.5 ? clamp(-error * 0.25, 0, 1) : 0;
    controls.handbrake = wanted < 0.5 && Math.abs(speed) < 1.5;
  }
}
