// Keeps the streets alive around the player: tops up traffic on lanes and walkers on
// sidewalks in a ring around them (out of sight where possible), fills nearby parking spots,
// and recycles whatever drifts too far away. Also spreads panic after loud crimes.
import { POPULATION } from '../core/config.js';
import { randomAppearance } from '../characters/appearance.js';
import { pickTrafficType } from '../vehicles/vehicleTypes.js';
import { TrafficDriver } from './trafficDriver.js';
import { PedestrianBrain } from './pedestrianBrain.js';
import { randomSidewalkSpot } from './sidewalkPaths.js';

export class PopulationManager {
  constructor(game, rng) {
    this.game = game;
    this.rng = rng;
    this.traffic = [];
    this.walkers = [];
    this.parked = new Map();
    this.timer = 0;
    this.enabled = true;
    this.trafficTarget = POPULATION.traffic;
    this.walkerTarget = POPULATION.pedestrians;
  }

  focus() {
    const player = this.game.player.character;
    return { x: player.x, z: player.z };
  }

  inView(x, z) {
    const camera = this.game.camera;
    const dx = x - camera.position.x;
    const dz = z - camera.position.z;
    const length = Math.hypot(dx, dz) || 1;
    const fx = -Math.sin(this.game.followCamera.yaw + Math.PI);
    const fz = -Math.cos(this.game.followCamera.yaw + Math.PI);
    return (dx * fx + dz * fz) / length > 0.55;
  }

  spawnTraffic(near, minDistance, maxDistance) {
    const game = this.game;
    const spot = game.network.randomLaneSpot(this.rng, near, minDistance, maxDistance);
    if (!spot) return null;
    if (minDistance > 0 && this.inView(spot.x, spot.z) && Math.hypot(spot.x - near.x, spot.z - near.z) < 125) return null;
    if (game.vehicles.nearest(spot.x, spot.z, 9)) return null;
    const type = pickTrafficType(this.rng);
    const vehicle = game.vehicles.spawn(type, spot.x, spot.z, spot.yaw, { role: 'traffic', rng: this.rng });
    const driver = game.characters.spawn('driver', spot.x, spot.z, randomAppearance(this.rng));
    driver.vehicle = vehicle;
    vehicle.driver = driver;
    vehicle.engineOn = true;
    vehicle.ai = new TrafficDriver(vehicle, game.network, game.city.signals, this.rng.fork(vehicle.id));
    vehicle.ai.place(spot.from, spot.to, spot.lane, spot.t);
    this.traffic.push(vehicle);
    return vehicle;
  }

  spawnWalker(near, minDistance, maxDistance) {
    const game = this.game;
    const spot = randomSidewalkSpot(this.rng, near, minDistance, maxDistance);
    if (!spot) return null;
    const walker = game.characters.spawn('pedestrian', spot.x, spot.z, randomAppearance(this.rng));
    walker.brain = new PedestrianBrain(walker, this.rng.fork(walker.id), spot);
    this.walkers.push(walker);
    return walker;
  }

  /** Fills the area around the player at once (new game, respawn, screenshot scenes). */
  populateNow() {
    const near = this.focus();
    for (let index = 0; index < this.trafficTarget * 2 && this.traffic.length < this.trafficTarget; index += 1) this.spawnTraffic(near, 15, POPULATION.spawnMax);
    for (let index = 0; index < this.walkerTarget * 2 && this.walkers.length < this.walkerTarget; index += 1) this.spawnWalker(near, 6, 120);
    this.fillParking(near);
  }

  fillParking(near) {
    const game = this.game;
    game.city.extras.parkingSpots.forEach((spot, index) => {
      const distance = Math.hypot(spot.x - near.x, spot.z - near.z);
      const current = this.parked.get(index);
      if (current && (!current.active || current.driver || current.role !== 'parked')) this.parked.delete(index);
      if (distance < 150 && !this.parked.has(index) && this.rng.chance(0.75)) {
        if (game.vehicles.nearest(spot.x, spot.z, 3)) return;
        const vehicle = game.vehicles.spawn(pickTrafficType(this.rng), spot.x, spot.z, spot.yaw + (this.rng.chance(0.5) ? Math.PI : 0), { role: 'parked', rng: this.rng });
        this.parked.set(index, vehicle);
      } else if (distance > 230 && current && current.role === 'parked' && !current.driver) {
        game.vehicles.remove(current);
        this.parked.delete(index);
      }
    });
  }

  /** Everyone near (x, z) panics; traffic floors it. */
  alarm(x, z, radius, source = null, seconds = 9) {
    for (const walker of this.walkers) {
      if (!walker.active || !walker.brain) continue;
      const d = Math.hypot(walker.x - x, walker.z - z);
      if (d < radius) walker.brain.scare(x, z, seconds, source);
    }
    for (const vehicle of this.traffic) {
      if (!vehicle.ai || !vehicle.ai.startPanic) continue;
      const d = Math.hypot(vehicle.x - x, vehicle.z - z);
      if (d < radius * 0.8) vehicle.ai.startPanic(seconds);
    }
  }

  update(dt) {
    if (!this.enabled) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.5;
    const game = this.game;
    const near = this.focus();
    this.traffic = this.traffic.filter((vehicle) => {
      if (!vehicle.active) return false;
      if (vehicle.role !== 'traffic') return false;
      const d = Math.hypot(vehicle.x - near.x, vehicle.z - near.z);
      if (d > POPULATION.despawn || (vehicle.destroyed && d > 90)) {
        game.vehicles.remove(vehicle);
        return false;
      }
      return true;
    });
    this.walkers = this.walkers.filter((walker) => {
      if (!walker.active) return false;
      const d = Math.hypot(walker.x - near.x, walker.z - near.z);
      if (d > 150 || (walker.state === 'dead' && d > 70)) {
        game.characters.remove(walker);
        return false;
      }
      return true;
    });
    for (let attempt = 0; attempt < 3 && this.traffic.length < this.trafficTarget; attempt += 1) this.spawnTraffic(near, POPULATION.spawnMin, POPULATION.spawnMax);
    for (let attempt = 0; attempt < 4 && this.walkers.length < this.walkerTarget; attempt += 1) this.spawnWalker(near, 40, 115);
    this.fillParking(near);
  }
}
