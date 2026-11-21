// Pursuit driving for police cruisers: route along the street grid (A*) while the suspect is
// out of sight, cut straight at them (leading their velocity) when the way is clear, box them
// in or ram at high heat, slow to a stop beside a suspect on foot, and back out when stuck.
import { clamp } from '../core/mathUtils.js';

const REPLAN_SECONDS = 1.4;

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
    const ahead = network.nearestNode(vehicle.x + Math.sin(vehicle.yaw) * 20, vehicle.z + Math.cos(vehicle.yaw) * 20);
    const goal = network.nearestNode(tx, tz);
    const path = network.findPath(ahead.id, goal.id);
    this.waypoints = [];
    for (let index = 0; index < path.length; index += 1) {
      const node = network.nodes[path[index]];
      if (index + 1 < path.length) {
        const line = network.lane(path[index], path[index + 1], 0);
        if (index > 0) {
          for (const point of network.turnPoints(path[index - 1], path[index], path[index + 1], 0, 0)) this.waypoints.push(point);
        } else {
          this.waypoints.push({ x: node.x, z: node.z });
        }
        this.waypoints.push({ x: line.ex, z: line.ez });
      }
    }
    this.waypoints.push({ x: tx, z: tz });
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
    let aimX;
    let aimZ;
    if (clear) {
      const lead = Math.min(1.1, distance / 22);
      aimX = target.x + tvx * lead;
      aimZ = target.z + tvz * lead;
      if (player.vehicle && distance < 26) {
        // Pull alongside rather than straight into the bumper.
        const speed = Math.hypot(tvx, tvz) || 1;
        aimX += (-tvz / speed) * this.side * 3;
        aimZ += (tvx / speed) * this.side * 3;
      }
      this.waypoints = [];
    } else {
      this.replan -= dt;
      if (this.replan <= 0 || this.waypoints.length === 0) {
        this.plan(game, target.x, target.z);
        this.replan = REPLAN_SECONDS;
      }
      while (this.waypoints.length > 1 && Math.hypot(this.waypoints[0].x - vehicle.x, this.waypoints[0].z - vehicle.z) < 6) this.waypoints.shift();
      const point = this.waypoints[0];
      aimX = point.x;
      aimZ = point.z;
    }
    const local = vehicle.worldToLocal(aimX, aimZ);
    const speed = vehicle.forwardSpeed;
    // Heading-error steering: decisive at corners and for targets behind, calm when lined up.
    const angleLeft = Math.atan2(local.x, local.z);
    const steer = clamp(-angleLeft * 2.2, -1, 1);
    const footTarget = !player.vehicle;
    const level = game.wanted.level;
    const targetSpeed = Math.hypot(tvx, tvz);
    let wanted = clear ? 46 * this.aggression : 30;
    if (footTarget && distance < 25) wanted = Math.max(0, (distance - 7) * 0.9);
    else if (!footTarget && clear && distance < 22) {
      // Close behind a suspect's car: shadow it, only ramming from four stars.
      const push = level >= 4 ? 5 : distance > 9 ? 1.5 : -1;
      wanted = Math.max(4, targetSpeed + push);
    }
    wanted *= 1 - Math.abs(steer) * 0.45;
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
