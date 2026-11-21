// One vehicle's state: where it is, how it moves, who drives it, how damaged it is, and the
// driver's inputs (throttle, brake, steer, handbrake) that the physics step reads.
import * as THREE from 'three';
import { VEHICLE_TYPES } from './vehicleTypes.js';
import { getVehicleModels } from './vehicleModels.js';

let nextId = 1;
export const MAX_VEHICLE_HEALTH = 1000;

export class Vehicle {
  constructor(type, x, z, yaw, paint) {
    this.id = nextId++;
    this.setType(type);
    this.x = x;
    this.y = 0;
    this.z = z;
    this.yaw = yaw;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.yawRate = 0;
    this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this.steerAngle = 0;
    this.wheelSpin = 0;
    this.pitch = 0;
    this.roll = 0;
    this.health = MAX_VEHICLE_HEALTH;
    this.destroyed = false;
    this.burnTimer = 0;
    this.sinking = 0;
    this.paint = new THREE.Color(paint ?? this.spec.paints[0]);
    this.driver = null;
    this.role = 'traffic';
    this.siren = false;
    this.horn = false;
    this.brakeLight = false;
    this.reversing = false;
    this.slip = 0;
    this.forwardSpeed = 0;
    this.speed = 0;
    this.onGround = true;
    this.ai = null;
    this.active = true;
    this.mission = null;
    this.lastImpact = 0;
    this.lastImpactBy = null;
    this.engineOn = false;
  }

  setType(type) {
    this.type = type;
    this.spec = VEHICLE_TYPES[type];
    this.model = getVehicleModels()[type];
    this.halfLength = this.spec.length / 2;
    this.halfWidth = this.spec.width / 2;
    this.mass = this.spec.mass;
    this.inertia = (this.mass * (this.spec.length ** 2 + this.spec.width ** 2)) / 12;
  }

  get name() {
    return this.spec.name;
  }

  /** World position of a point given in the car's frame (x to its left, z forward). */
  localToWorld(lx, lz) {
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    return { x: this.x + lx * cos + lz * sin, z: this.z - lx * sin + lz * cos };
  }

  /** The car-frame coordinates of a world point. */
  worldToLocal(x, z) {
    const dx = x - this.x;
    const dz = z - this.z;
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    return { x: dx * cos - dz * sin, z: dx * sin + dz * cos };
  }

  doorPosition() {
    return this.localToWorld(this.model.door.x, this.model.door.z);
  }

  get healthShare() {
    return this.health / MAX_VEHICLE_HEALTH;
  }

  /** Takes damage; returns true when this blow wrecked the car. */
  damage(amount, source = null) {
    if (this.destroyed || amount <= 0) return false;
    this.health = Math.max(0, this.health - amount);
    if (source) this.lastImpactBy = source;
    if (this.health <= 0) {
      this.destroyed = true;
      return true;
    }
    return false;
  }

  clearControls() {
    this.controls.throttle = 0;
    this.controls.brake = 0;
    this.controls.steer = 0;
    this.controls.handbrake = false;
  }
}
