// Decides which effects play: exhaust, tyre smoke, beach dust and skid marks from each car's
// state; smoke and fire on damaged cars; sparks, fireballs, splashes, hydrant spray, fountain
// water and camera shake from world events.
import { Particles } from './particles.js';
import { SkidMarks } from './skidMarks.js';
import { Tracers } from './tracers.js';
import { districtAt } from '../world/cityPlan.js';
import { groundHeight } from '../world/terrain.js';
import { WATER_LEVEL } from '../core/config.js';

const EFFECT_RANGE = 130;

export class EffectsDirector {
  constructor(game) {
    this.game = game;
    this.particles = new Particles(game.scene, game.rng.fork(404));
    this.skids = new SkidMarks(game.scene);
    this.tracers = new Tracers(game.scene);
    this.sprays = [];
    this.fountainTimer = 0;
    this.flashes = [];
    const events = game.events;
    events.on('vehicleImpact', (e) => this.onImpact(e.vehicle, e.speed, e.x, e.z));
    events.on('vehicleCrash', (e) => this.onImpact(e.a, e.speed, e.x, e.z, e.b));
    events.on('vehicleExploded', (e) => this.explosionAt(e.vehicle.x, e.vehicle.y + 0.8, e.vehicle.z));
    events.on('explosion', (e) => {
      if (!e.fromVehicle) this.explosionAt(e.x, e.y, e.z);
    });
    events.on('vehicleSunk', (e) => this.particles.burst('splash', 40, e.vehicle.x, WATER_LEVEL + 0.2, e.vehicle.z, 0, 4, 0, 2.5, 1.4));
    events.on('propBroken', (e) => {
      if (e.kind === 'hydrant') this.sprays.push({ x: e.x, z: e.z, time: 14 });
      else this.particles.burst('spark', 10, e.x, 1, e.z, 0, 2, 0, 2.5);
    });
    events.on('pedestrianHit', (e) => {
      const c = e.character;
      this.particles.burst('dust', 6, c.x, c.y + 0.3, c.z, 0, 0.6, 0, 1);
      if (e.speed > 9) this.particles.burst('blood', 8, c.x, c.y + 1, c.z, e.vehicle.vx * 0.2, 1.5, e.vehicle.vz * 0.2, 1.4);
    });
    events.on('bulletImpact', (e) => this.onBulletImpact(e));
  }

  onImpact(vehicle, speed, x, z, other = null) {
    if (speed < 3) return;
    const y = vehicle.y + 0.6;
    this.particles.burst('spark', Math.min(30, Math.floor(speed * 1.6)), x, y, z, vehicle.vx * 0.15, 2.5, vehicle.vz * 0.15, 3);
    if (speed > 9) this.particles.burst('debris', 6, x, y, z, 0, 3, 0, 3);
    const player = this.game.player.character;
    if (player.vehicle && (player.vehicle === vehicle || player.vehicle === other)) this.game.followCamera.shake(Math.min(0.6, speed * 0.035));
  }

  onBulletImpact(e) {
    if (e.kind === 'character') this.particles.burst('blood', 5, e.x, e.y, e.z, e.dx * 1.5, 1, e.dz * 1.5, 1.1);
    else if (e.kind === 'vehicle') this.particles.burst('spark', 6, e.x, e.y, e.z, -e.dx * 2, 1.5, -e.dz * 2, 2.2);
    else this.particles.burst('dust', 3, e.x, e.y, e.z, -e.dx, 0.6, -e.dz, 0.6, 0.5);
  }

  explosionAt(x, y, z) {
    const p = this.particles;
    p.burst('flash', 1, x, y + 1, z);
    p.burst('fireball', 16, x, y + 1, z, 0, 3, 0, 4.5);
    p.burst('fire', 20, x, y + 0.5, z, 0, 4, 0, 4);
    p.burst('spark', 40, x, y + 1, z, 0, 7, 0, 9);
    p.burst('debris', 24, x, y + 1, z, 0, 8, 0, 7);
    p.burst('smoke', 18, x, y + 2, z, 0, 2, 0, 3, 1.6);
    const camera = this.game.camera.position;
    const distance = Math.hypot(camera.x - x, camera.z - z);
    this.game.followCamera.shake(Math.max(0, 1 - distance / 70));
    this.flashes.push({ x, y: y + 2, z, time: 0.35 });
  }

  update(dt) {
    const game = this.game;
    const camera = game.camera.position;
    const p = this.particles;
    for (const vehicle of game.vehicles.list) {
      if (!vehicle.active) continue;
      const dx = vehicle.x - camera.x;
      const dz = vehicle.z - camera.z;
      if (dx * dx + dz * dz > EFFECT_RANGE * EFFECT_RANGE) {
        this.skids.track(`${vehicle.id}L`, 0, 0, false);
        this.skids.track(`${vehicle.id}R`, 0, 0, false);
        continue;
      }
      vehicle.fxTimer = (vehicle.fxTimer ?? 0) - dt;
      const emit = vehicle.fxTimer <= 0;
      if (emit) vehicle.fxTimer = 0.06;
      const rear = vehicle.localToWorld(0, -vehicle.halfLength);
      const front = vehicle.localToWorld(0, vehicle.halfLength * 0.6);
      const sliding = vehicle.slip > 3 && vehicle.speed > 3 && vehicle.onGround;
      const sandy = vehicle.speed > 4 && districtAt(vehicle.x, vehicle.z) === 'beach' && vehicle.onGround;
      for (const side of [1, -1]) {
        const wheel = vehicle.localToWorld(side * (vehicle.halfWidth - 0.2), -vehicle.spec.wheelBase);
        const onRoad = groundHeight(wheel.x, wheel.z) > -0.08;
        this.skids.track(`${vehicle.id}${side > 0 ? 'L' : 'R'}`, wheel.x, wheel.z, sliding && onRoad && !vehicle.destroyed);
        if (emit && sliding) p.burst('tireSmoke', 1, wheel.x, vehicle.y + 0.3, wheel.z, vehicle.vx * 0.1, 0.6, vehicle.vz * 0.1, 0.5);
        if (emit && sandy) p.burst('dust', 1, wheel.x, vehicle.y + 0.3, wheel.z, vehicle.vx * 0.15, 1, vehicle.vz * 0.15, 0.8);
      }
      if (!emit) continue;
      if (vehicle.driver && !vehicle.destroyed && vehicle.speed < 14) {
        p.burst('exhaust', 1, rear.x, vehicle.y + 0.35, rear.z, -Math.sin(vehicle.yaw) * 1.2, 0.3, -Math.cos(vehicle.yaw) * 1.2, 0.2);
      }
      const share = vehicle.healthShare;
      if (!vehicle.destroyed && share < 0.4) {
        p.burst('smoke', 1, front.x, vehicle.y + 1.1, front.z, vehicle.vx * 0.3, 1.5, vehicle.vz * 0.3, 0.4, share < 0.2 ? 1.2 : 0.7);
      }
      if (vehicle.onFire || (vehicle.destroyed && vehicle.burnTimer > 0)) {
        p.burst('fire', 2, front.x, vehicle.y + 1.0, front.z, 0, 1.5, 0, 0.6);
        p.burst('smoke', 1, front.x, vehicle.y + 2.2, front.z, 0, 2, 0, 0.6, 1.4);
      }
    }
    for (let index = this.sprays.length - 1; index >= 0; index -= 1) {
      const spray = this.sprays[index];
      spray.time -= dt;
      p.burst('spray', 3, spray.x, 0.9, spray.z, 0, 8.5, 0, 0.8);
      if (spray.time <= 0) this.sprays.splice(index, 1);
    }
    this.fountainTimer -= dt;
    if (this.fountainTimer <= 0) {
      this.fountainTimer = 0.05;
      for (const fountain of game.city.extras.fountains) {
        if (Math.hypot(fountain.x - camera.x, fountain.z - camera.z) > 110) continue;
        p.burst('spray', 2, fountain.x, 4.9, fountain.z, 0, 3.2, 0, 1.4);
      }
    }
    for (let index = this.flashes.length - 1; index >= 0; index -= 1) {
      const flash = this.flashes[index];
      flash.time -= dt;
      if (flash.time <= 0) this.flashes.splice(index, 1);
    }
    p.update(dt, game.camera, game.renderer.domElement.height);
    this.tracers.update(dt);
  }

  /** Explosion flashes as glows; called while the frame's glow list is open. */
  drawGlows(glow) {
    for (const flash of this.flashes) {
      const k = Math.max(0, flash.time / 0.35);
      glow.add(flash.x, flash.y, flash.z, 9 * k + 3, 1.2 * k, 0.7 * k, 0.25 * k);
    }
  }
}
