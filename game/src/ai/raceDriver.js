// A rival racer: aims for the next checkpoint while looking at the one after, brakes for sharp
// corners, takes the racing line flat out on straights and backs out of walls.
import { clamp } from '../core/mathUtils.js';

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
  }

  update(dt) {
    const vehicle = this.vehicle;
    const controls = vehicle.controls;
    if (!this.started || this.finished || vehicle.destroyed || !vehicle.driver) {
      vehicle.clearControls();
      controls.handbrake = true;
      return;
    }
    const point = this.checkpoints[this.index];
    const distance = Math.hypot(point.x - vehicle.x, point.z - vehicle.z);
    if (distance < 9) {
      this.index += 1;
      if (this.index >= this.checkpoints.length) {
        this.finished = true;
        return;
      }
    }
    const target = this.checkpoints[this.index];
    const after = this.checkpoints[Math.min(this.index + 1, this.checkpoints.length - 1)];
    const toTarget = Math.hypot(target.x - vehicle.x, target.z - vehicle.z);
    const blend = clamp(1 - toTarget / 30, 0, 0.5);
    const aimX = target.x + (after.x - target.x) * blend * 0.4;
    const aimZ = target.z + (after.z - target.z) * blend * 0.4;
    const local = vehicle.worldToLocal(aimX, aimZ);
    const speed = vehicle.forwardSpeed;
    const look = Math.max(4, Math.hypot(local.x, local.z));
    const limit = vehicle.spec.steerMax * (1 - Math.min(Math.abs(speed) / 50, 1) * 0.7);
    const steer = clamp(Math.atan2(2 * vehicle.spec.wheelBase * 2 * -local.x, look * look) / limit, -1, 1);
    // Corner speed from the angle between this leg and the next.
    const ax = target.x - vehicle.x;
    const az = target.z - vehicle.z;
    const bx = after.x - target.x;
    const bz = after.z - target.z;
    const cos = (ax * bx + az * bz) / ((Math.hypot(ax, az) || 1) * (Math.hypot(bx, bz) || 1));
    let wanted = vehicle.spec.maxSpeed * this.skill;
    if (cos < 0.5 && toTarget < 45) wanted = Math.min(wanted, 11 + toTarget * 0.45);
    wanted *= 1 - Math.abs(steer) * 0.3;
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
    controls.steer = steer;
    controls.throttle = speed < wanted ? 1 : 0;
    controls.brake = speed > wanted + 3 ? clamp((speed - wanted) * 0.15, 0, 1) : 0;
    controls.handbrake = false;
  }
}
