// The third-person camera: orbit on foot, over-the-shoulder when aiming, a lagging chase cam
// in cars (near, far and cinematic views, look-back), speed-based field of view, wall
// avoidance by ray cast and trauma-based shake. Cutscenes can take it over.
import * as THREE from 'three';
import { CAMERA_TUNING } from '../core/config.js';
import { clamp, damp, dampAngle, wrapAngle } from '../core/mathUtils.js';
import { groundHeight } from '../world/terrain.js';

const VEHICLE_VIEWS = ['near', 'far', 'cinematic'];

export class FollowCamera {
  constructor(camera, collision) {
    this.camera = camera;
    this.collision = collision;
    this.yaw = 0;
    this.pitch = 0.18;
    this.distance = CAMERA_TUNING.footDistance;
    this.fov = CAMERA_TUNING.fov;
    this.view = 0;
    this.freeLook = 0;
    this.trauma = 0;
    this.time = 0;
    this.lookBack = false;
    this.override = null;
    this.target = new THREE.Vector3();
    this.position = new THREE.Vector3();
    this.lastMode = 'foot';
  }

  get viewName() {
    return VEHICLE_VIEWS[this.view];
  }

  cycleView() {
    this.view = (this.view + 1) % VEHICLE_VIEWS.length;
  }

  look(dx, dy, sensitivity, invertY = false) {
    if (dx === 0 && dy === 0) return;
    this.yaw = wrapAngle(this.yaw - dx * sensitivity);
    this.pitch = clamp(this.pitch + dy * sensitivity * (invertY ? -1 : 1), -0.45, 1.25);
    this.freeLook = 1.8;
  }

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Points the camera behind a heading at once (after respawn or entering a car). */
  snapBehind(yaw) {
    this.yaw = yaw;
    this.freeLook = 0;
  }

  update(dt, focus) {
    this.time += dt;
    this.freeLook = Math.max(0, this.freeLook - dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    const camera = this.camera;
    let wantedFov = CAMERA_TUNING.fov;
    if (this.override) {
      const o = this.override;
      this.position.copy(o.position);
      this.target.copy(o.target);
      wantedFov = o.fov ?? wantedFov;
    } else if (focus.mode === 'vehicle') {
      wantedFov = this.updateVehicle(dt, focus);
    } else {
      wantedFov = this.updateFoot(dt, focus);
    }
    if (this.trauma > 0) {
      const t = this.trauma * this.trauma;
      this.position.x += Math.sin(this.time * 41) * t * 0.35;
      this.position.y += Math.sin(this.time * 37 + 1) * t * 0.3;
      this.position.z += Math.sin(this.time * 43 + 2) * t * 0.35;
    }
    this.fov = damp(this.fov, wantedFov, 4, dt);
    if (Math.abs(camera.fov - this.fov) > 0.01) {
      camera.fov = this.fov;
      camera.updateProjectionMatrix();
    }
    camera.position.copy(this.position);
    camera.lookAt(this.target);
  }

  /** Pulls the camera in front of any wall between it and the target. */
  avoidWalls(wantedDistance, dirX, dirY, dirZ) {
    const hit = this.collision.raycast(this.target.x, this.target.y, this.target.z, dirX, dirY, dirZ, wantedDistance + 0.4);
    const limit = hit ? Math.max(0.9, hit.distance - 0.45) : wantedDistance;
    if (limit < this.distance) this.distance = limit;
    else this.distance = damp(this.distance, limit, 3.5, 1 / 60);
  }

  place(dirX, dirY, dirZ) {
    this.position.set(this.target.x + dirX * this.distance, this.target.y + dirY * this.distance, this.target.z + dirZ * this.distance);
    const floor = groundHeight(this.position.x, this.position.z) + 0.35;
    if (this.position.y < floor) this.position.y = floor;
  }

  updateFoot(dt, focus) {
    const aiming = focus.aiming;
    const wanted = aiming ? CAMERA_TUNING.aimDistance : CAMERA_TUNING.footDistance;
    const height = focus.swimming ? 0.6 : CAMERA_TUNING.footHeight;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const shoulder = aiming ? 0.62 : 0.28;
    const rx = -fz;
    const rz = fx;
    this.target.set(focus.x + rx * shoulder, focus.y + height, focus.z + rz * shoulder);
    const cosPitch = Math.cos(this.pitch);
    const dirX = -fx * cosPitch;
    const dirY = Math.sin(this.pitch);
    const dirZ = -fz * cosPitch;
    this.avoidWalls(wanted, dirX, dirY, dirZ);
    this.place(dirX, dirY, dirZ);
    // Look a little past the target so the horizon sits well.
    this.target.x += fx * 2;
    this.target.z += fz * 2;
    this.target.y += 0.1 - this.pitch * 0.4;
    this.lastMode = 'foot';
    return aiming ? 50 : CAMERA_TUNING.fov;
  }

  updateVehicle(dt, focus) {
    const vehicle = focus.vehicle;
    const speed = vehicle.speed;
    const length = vehicle.spec.length;
    if (this.lastMode !== 'vehicle') {
      this.yaw = vehicle.yaw;
      this.pitch = 0.2;
    }
    this.lastMode = 'vehicle';
    const view = this.viewName;
    if (view === 'cinematic') {
      const angle = vehicle.yaw + Math.PI * 0.82 + Math.sin(this.time * 0.25) * 0.35;
      this.target.set(vehicle.x, vehicle.y + 1.1, vehicle.z);
      const dist = length + 5.5;
      this.distance = dist;
      const dirX = Math.sin(angle) * -1;
      const dirZ = Math.cos(angle) * -1;
      this.place(dirX, 0.16, dirZ);
      return 58;
    }
    let heading = vehicle.yaw;
    if (speed > 4 && vehicle.forwardSpeed > 0) heading = Math.atan2(vehicle.vx, vehicle.vz);
    if (this.lookBack) heading += Math.PI;
    if (this.freeLook <= 0 || this.lookBack) {
      this.yaw = this.lookBack ? heading : dampAngle(this.yaw, heading, 3.2, dt);
      this.pitch = damp(this.pitch, view === 'far' ? 0.28 : 0.2, 2, dt);
    }
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const wanted = (view === 'far' ? length * 1.55 + 5 : length * 1.12 + 2.6) + Math.min(speed, 40) * 0.04;
    const lead = Math.min(speed, 35) * 0.1;
    this.target.set(vehicle.x + Math.sin(vehicle.yaw) * lead * 0.3, vehicle.y + 1.25 + length * 0.08, vehicle.z + Math.cos(vehicle.yaw) * lead * 0.3);
    const cosPitch = Math.cos(this.pitch);
    const dirX = -fx * cosPitch;
    const dirY = Math.sin(this.pitch);
    const dirZ = -fz * cosPitch;
    this.avoidWalls(wanted, dirX, dirY, dirZ);
    this.place(dirX, dirY, dirZ);
    this.target.x += fx * (3 + lead);
    this.target.z += fz * (3 + lead);
    return CAMERA_TUNING.fov + Math.min(speed / 40, 1) * 14;
  }
}
