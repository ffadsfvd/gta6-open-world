// Arcade car handling with a believable feel: a bicycle model for yaw, speed-sensitive steering,
// lateral grip that lets go under the handbrake (drifts), engine and brake curves, drag, body
// roll and pitch, gravity off ledges and sinking in deep water.
import { approach, clamp, damp } from '../core/mathUtils.js';
import { WATER_LEVEL, WORLD_BOUNDS } from '../core/config.js';
import { groundHeight, isDeepWater, waterDepth } from '../world/terrain.js';
import { districtAt } from '../world/cityPlan.js';

const GRAVITY = 20;
const BRAKE_DECEL = 15;
const REVERSE_LIMIT = 9;
/** Sideways pull the tyres manage at full grip, in m/s² (about 1.35 g, an arcade-quick car). */
const CORNERING = 13.2;

/** Steering lock left at `speed`: the wheel turns less the faster the car goes. */
export function steerLimitAt(spec, speed) {
  return spec.steerMax * (1 - Math.min(Math.abs(speed) / 45, 1) * 0.72);
}

function surfaceGrip(x, z) {
  if (waterDepth(x, z) > 0.3) return 0.55;
  const district = districtAt(x, z);
  if (district === 'beach' || district === 'lighthouse') return 0.72;
  return 1;
}

/** Advances one vehicle by dt. Returns an event name ('landed', 'sunk') or null. */
export function stepVehiclePhysics(vehicle, dt) {
  const spec = vehicle.spec;
  const controls = vehicle.controls;
  const wrecked = vehicle.destroyed;
  let event = null;
  const grip = surfaceGrip(vehicle.x, vehicle.z);
  const traction = vehicle.onGround ? grip : 0.05;

  let fx = Math.sin(vehicle.yaw);
  let fz = Math.cos(vehicle.yaw);
  let forward = vehicle.vx * fx + vehicle.vz * fz;
  const speed = Math.abs(forward);

  // Steering: less lock at speed, eased toward the wanted angle.
  const steerLimit = steerLimitAt(spec, speed);
  const wantedSteer = wrecked ? 0 : controls.steer * steerLimit;
  vehicle.steerAngle = approach(vehicle.steerAngle, wantedSteer, dt * 5);
  const axle = spec.wheelBase * 2;
  let wantedYawRate = -(forward * Math.tan(vehicle.steerAngle)) / axle;
  // The tyres can only pull so hard sideways: at speed the car runs wide instead of snapping
  // round. The handbrake lets the rear go, so a drift may rotate faster than it grips.
  if (!controls.handbrake && speed > 2) {
    const maxRate = (CORNERING * (spec.grip / 9.5) * traction) / speed;
    wantedYawRate = clamp(wantedYawRate, -maxRate, maxRate);
  }
  const yawTraction = (controls.handbrake ? 2.4 : 12) * traction;
  vehicle.yawRate += (wantedYawRate - vehicle.yawRate) * Math.min(1, yawTraction * dt);
  if (controls.handbrake && speed > 5 && !wrecked) vehicle.yawRate -= controls.steer * 1.9 * dt * Math.sign(forward);
  vehicle.yaw += vehicle.yawRate * dt;

  // The body turned; the old velocity now has a sideways part: that is the slide.
  fx = Math.sin(vehicle.yaw);
  fz = Math.cos(vehicle.yaw);
  const rx = -fz;
  const rz = fx;
  forward = vehicle.vx * fx + vehicle.vz * fz;
  let side = vehicle.vx * rx + vehicle.vz * rz;

  const throttle = wrecked ? 0 : controls.throttle;
  const brake = wrecked ? 0.4 : controls.brake;
  if (throttle > 0 && forward < spec.maxSpeed) {
    const curve = 1 - Math.pow(Math.max(0, forward) / spec.maxSpeed, 2);
    forward += spec.power * throttle * Math.max(0.15, curve) * dt * traction;
  }
  vehicle.reversing = false;
  if (brake > 0) {
    if (forward > 0.4) forward -= BRAKE_DECEL * brake * dt * Math.max(traction, 0.3);
    else if (forward > -REVERSE_LIMIT) {
      forward -= spec.power * 0.5 * brake * dt * traction;
      vehicle.reversing = true;
    }
  }
  if (controls.handbrake) forward = approach(forward, 0, 6 * dt);
  if (throttle === 0 && brake === 0) forward = approach(forward, 0, 1.1 * dt);
  forward -= forward * (0.04 + Math.abs(forward) * 0.0009) * dt;

  const lateralGrip = (controls.handbrake ? 1.5 : spec.grip) * traction;
  side -= side * Math.min(1, lateralGrip * dt);
  vehicle.slip = Math.abs(side) + (controls.handbrake && speed > 6 ? 3 : 0) + (brake > 0.85 && forward > 12 ? 2.5 : 0);

  vehicle.vx = fx * forward + rx * side;
  vehicle.vz = fz * forward + rz * side;
  vehicle.x += vehicle.vx * dt;
  vehicle.z += vehicle.vz * dt;
  // The edge of the playable map: hills to the west and north, open sea beyond the pier.
  if (vehicle.x < WORLD_BOUNDS.minX || vehicle.x > WORLD_BOUNDS.maxX) {
    vehicle.x = Math.min(WORLD_BOUNDS.maxX, Math.max(WORLD_BOUNDS.minX, vehicle.x));
    vehicle.vx *= -0.2;
  }
  if (vehicle.z < WORLD_BOUNDS.minZ || vehicle.z > WORLD_BOUNDS.maxZ) {
    vehicle.z = Math.min(WORLD_BOUNDS.maxZ, Math.max(WORLD_BOUNDS.minZ, vehicle.z));
    vehicle.vz *= -0.2;
  }

  // Height: follow the ground, fall off ledges.
  const ground = groundHeight(vehicle.x, vehicle.z);
  vehicle.vy -= GRAVITY * dt;
  vehicle.y += vehicle.vy * dt;
  if (vehicle.y <= ground) {
    if (!vehicle.onGround && vehicle.vy < -7) event = 'landed';
    vehicle.y = ground;
    vehicle.vy = 0;
    vehicle.onGround = true;
  } else if (vehicle.y > ground + 0.25) {
    vehicle.onGround = false;
  }
  if (isDeepWater(vehicle.x, vehicle.z) && vehicle.y < WATER_LEVEL + 0.4) {
    vehicle.sinking += dt;
    vehicle.vx *= 1 - Math.min(1, 1.8 * dt);
    vehicle.vz *= 1 - Math.min(1, 1.8 * dt);
    vehicle.y = Math.max(ground, WATER_LEVEL - 0.3 - vehicle.sinking * 0.7);
    if (vehicle.sinking > 2.5 && !vehicle.destroyed) {
      vehicle.destroyed = true;
      vehicle.health = 0;
      event = 'sunk';
    }
  }

  vehicle.forwardSpeed = forward;
  vehicle.speed = Math.hypot(vehicle.vx, vehicle.vz);
  vehicle.wheelSpin += (forward / spec.wheelRadius) * dt;
  const wantedRoll = clamp(side * 0.012 + vehicle.yawRate * forward * 0.0035, -0.09, 0.09);
  const wantedPitch = clamp((throttle * 0.025 - brake * 0.04) * Math.min(1, speed / 4), -0.05, 0.05);
  vehicle.roll = damp(vehicle.roll, wantedRoll, 6, dt);
  vehicle.pitch = damp(vehicle.pitch, wantedPitch, 5, dt);
  vehicle.brakeLight = brake > 0.1 && forward > 0.3;
  return event;
}
