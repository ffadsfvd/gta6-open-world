// Owns every vehicle: spawning and removal, the AI-then-physics update in fixed substeps,
// collisions, running people over, smoke-fire-explosion damage stages, and drawing.
import { Vehicle } from './vehicle.js';
import { stepVehiclePhysics } from './vehiclePhysics.js';
import { collideVehicles, collideVehicleWithCharacters, collideVehicleWithWorld } from './vehicleCollisions.js';
import { VehicleRenderer } from './vehicleRenderer.js';
import { VEHICLE_TYPES } from './vehicleTypes.js';
import { groundHeight } from '../world/terrain.js';

const SUBSTEP = 1 / 60;
const BURN_SHARE = 0.12;

export class VehicleManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.renderer = new VehicleRenderer(game.scene);
    this.onWorldImpact = (vehicle, speed, x, z, box) => {
      game.events.emit('vehicleImpact', { vehicle, speed, x, z, kind: box.tag });
    };
    this.onCrash = (a, b, speed, x, z) => {
      game.events.emit('vehicleCrash', { a, b, speed, x, z });
    };
    this.onRunOver = (vehicle, character, speed, nx, nz) => {
      character.knockDown(vehicle.vx * 0.75 + nx * 2, vehicle.vz * 0.75 + nz * 2, 2.6, 2 + speed * 0.18);
      const killed = character.takeDamage((speed - 3.5) * 9, vehicle.driver);
      vehicle.vx *= 0.93;
      vehicle.vz *= 0.93;
      game.events.emit('pedestrianHit', { vehicle, character, speed, killed });
    };
  }

  spawn(type, x, z, yaw, options = {}) {
    const spec = VEHICLE_TYPES[type];
    const paint = options.paint ?? (options.rng ? options.rng.pick(spec.paints) : spec.paints[0]);
    const vehicle = new Vehicle(type, x, z, yaw, paint);
    vehicle.role = options.role ?? 'parked';
    vehicle.y = groundHeight(x, z);
    this.list.push(vehicle);
    return vehicle;
  }

  remove(vehicle) {
    const index = this.list.indexOf(vehicle);
    if (index >= 0) this.list.splice(index, 1);
    vehicle.active = false;
    if (vehicle.driver && vehicle.driver.kind !== 'player') this.game.characters.remove(vehicle.driver);
    vehicle.driver = null;
    vehicle.ai = null;
  }

  update(dt) {
    const game = this.game;
    for (const vehicle of this.list) {
      if (vehicle.ai) vehicle.ai.update(dt, game);
      else if (!vehicle.driver) {
        vehicle.clearControls();
        vehicle.controls.handbrake = true;
      }
    }
    const steps = Math.max(1, Math.ceil(dt / SUBSTEP - 1e-6));
    const h = dt / steps;
    for (let step = 0; step < steps; step += 1) {
      for (const vehicle of this.list) {
        if (!vehicle.active) continue;
        const moving = Math.abs(vehicle.vx) + Math.abs(vehicle.vz) > 0.02 || !vehicle.onGround || vehicle.driver;
        if (!moving && !vehicle.destroyed) continue;
        const event = stepVehiclePhysics(vehicle, h);
        if (event === 'landed') game.events.emit('vehicleImpact', { vehicle, speed: 8, x: vehicle.x, z: vehicle.z, kind: 'ground' });
        collideVehicleWithWorld(vehicle, game.collision, game.city.props, this.onWorldImpact);
      }
      collideVehicles(this.list, this.onCrash);
    }
    for (const vehicle of this.list) {
      if (vehicle.active && vehicle.speed > 0.3) collideVehicleWithCharacters(vehicle, game.characters.list, this.onRunOver);
      this.updateDamage(vehicle, dt);
    }
  }

  updateDamage(vehicle, dt) {
    if (vehicle.destroyed) {
      if (!vehicle.wrecked) {
        vehicle.wrecked = true;
        vehicle.siren = false;
        vehicle.burnTimer = 12;
        this.game.events.emit(vehicle.sinking > 0 ? 'vehicleSunk' : 'vehicleExploded', { vehicle });
      }
      vehicle.burnTimer = Math.max(0, vehicle.burnTimer - dt);
      return;
    }
    if (vehicle.healthShare < BURN_SHARE) {
      vehicle.onFire = true;
      vehicle.health -= 32 * dt;
      if (vehicle.health <= 0) {
        vehicle.health = 0;
        vehicle.destroyed = true;
      }
    }
  }

  nearest(x, z, radius, predicate = null) {
    let best = null;
    let bestDistance = radius * radius;
    for (const vehicle of this.list) {
      if (!vehicle.active) continue;
      const d = (vehicle.x - x) ** 2 + (vehicle.z - z) ** 2;
      if (d < bestDistance && (!predicate || predicate(vehicle))) {
        bestDistance = d;
        best = vehicle;
      }
    }
    return best;
  }

  render(glow, time) {
    this.renderer.sync(this.list, glow, time);
  }
}
