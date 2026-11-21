// A rival racer: aims for the next checkpoint, brakes in time for corners (from braking
// distance, not guesswork), holds corner speed until lined up with the next street, brakes for
// slower traffic and swings out to pass it, and backs out of walls.
import { clamp } from '../core/mathUtils.js';

const TOP_SPEED = 37;
const CORNER_SPEED = 9.5;
const BRAKING = 8.5;

export class RaceDriver {
  constructor(vehicle, checkpoints, skill = 0.92) {
    this.vehicle = vehicle;
    this.checkpoints = checkpoints;
    this.index = 0;
    this.skill = skill;
    this.finished = false;
    this.stuck = 0;
    this.reverse = 0;
    this.started = false;
    this.passSide = 1;
    // Set by the race each frame: ease off when far ahead of the player, push when behind.
    this.pace = 1;
  }

  /** Nearest car ahead in a narrow cone, as { gap, speed, side } or null. */
  trafficAhead(world) {
    const vehicle = this.vehicle;
    const fx = Math.sin(vehicle.yaw);
    const fz = Math.cos(vehicle.yaw);
    let best = null;
    for (const other of world.vehicles.list) {
      if (other === vehicle || !other.active) continue;
      const dx = other.x - vehicle.x;
      const dz = other.z - vehicle.z;
      const ahead = dx * fx + dz * fz;
      if (ahead <= 0 || ahead > 32) continue;
      const side = dx * -fz + dz * fx;
      if (Math.abs(side) > 2.4) continue;
      if (!best || ahead < best.gap) best = { gap: ahead - vehicle.halfLength - other.halfLength, speed: other.forwardSpeed ?? 0, side };
    }
    return best;
  }

  /** Is this checkpoint a corner (the route turns there)? */
  cornerAt(index) {
    const before = this.checkpoints[Math.max(0, index - 1)];
    const point = this.checkpoints[index];
    const after = this.checkpoints[Math.min(index + 1, this.checkpoints.length - 1)];
    const ax = point.x - before.x;
    const az = point.z - before.z;
    const bx = after.x - point.x;
    const bz = after.z - point.z;
    const la = Math.hypot(ax, az);
    const lb = Math.hypot(bx, bz);
    if (la < 1 || lb < 1) return false;
    return (ax * bx + az * bz) / (la * lb) < 0.7;
  }

  update(dt, world) {
    const vehicle = this.vehicle;
    const controls = vehicle.controls;
    if (!this.started || this.finished || vehicle.destroyed || !vehicle.driver) {
      vehicle.clearControls();
      controls.handbrake = true;
      return;
    }
    const corner = this.cornerAt(this.index);
    const point = this.checkpoints[this.index];
    const distance = Math.hypot(point.x - vehicle.x, point.z - vehicle.z);
    if (distance < (corner ? 5 : 10)) {
      this.index += 1;
      if (this.index >= this.checkpoints.length) {
        this.finished = true;
        return;
      }
    }
    const target = this.checkpoints[this.index];
    const toTarget = Math.hypot(target.x - vehicle.x, target.z - vehicle.z);
    let aimX = target.x;
    let aimZ = target.z;
    const traffic = world ? this.trafficAhead(world) : null;
    if (traffic && traffic.gap < 22 && traffic.speed < vehicle.forwardSpeed - 2) {
      // Swing out to the side with more room to pass.
      this.passSide = traffic.side > 0 ? -1 : 1;
      const fx = Math.sin(vehicle.yaw);
      const fz = Math.cos(vehicle.yaw);
      aimX = vehicle.x + fx * 20 + -fz * this.passSide * 3.4;
      aimZ = vehicle.z + fz * 20 + fx * this.passSide * 3.4;
    }
    const local = vehicle.worldToLocal(aimX, aimZ);
    const speed = vehicle.forwardSpeed;
    // Steer by heading error: full lock for a target well off the nose (or behind), gentle near dead ahead.
    const angleLeft = Math.atan2(local.x, local.z);
    const steer = clamp(-angleLeft * 2.2, -1, 1);
    let wanted = Math.min(vehicle.spec.maxSpeed, TOP_SPEED) * this.skill * this.pace;
    if (this.cornerAt(this.index)) {
      // Brake so the car arrives at the corner at corner speed.
      const room = Math.max(0, toTarget - 4);
      wanted = Math.min(wanted, Math.sqrt(CORNER_SPEED * CORNER_SPEED + 2 * BRAKING * room));
    }
    // Still turning out of the last corner: hold the speed down until lined up.
    const heading = Math.atan2(target.x - vehicle.x, target.z - vehicle.z);
    let misalign = Math.abs(((heading - vehicle.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (misalign > 0.35) wanted = Math.min(wanted, CORNER_SPEED + (1 - Math.min(1, misalign)) * 6);
    if (traffic && traffic.gap < 14 && Math.abs(traffic.side) < 1.6) wanted = Math.min(wanted, Math.max(0, traffic.speed + traffic.gap * 0.4));
    if (this.reverse > 0) {
      this.reverse -= dt;
      controls.throttle = 0;
      controls.brake = 1;
      controls.steer = -Math.sign(steer || 1);
      controls.handbrake = false;
      return;
    }
    if (Math.abs(speed) < 1 && wanted > 5) {
      this.stuck += dt;
      if (this.stuck > 1.5) {
        this.stuck = 0;
        this.reverse = 1;
      }
    } else {
      this.stuck = 0;
    }
    misalign = 0;
    controls.steer = steer;
    controls.throttle = speed < wanted ? clamp((wanted - speed) * 0.25, 0.3, 1) : 0;
    controls.brake = speed > wanted + 1 && speed > 0.5 ? clamp((speed - wanted) * 0.2, 0.2, 1) : 0;
    controls.handbrake = false;
  }
}
