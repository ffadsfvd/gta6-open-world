// Sends the Ondaluz Bay Police after the player: more cruisers per star, patrol cars nearby
// joining the chase, officers jumping out near a stopped suspect, roadblocks across the road
// ahead from three stars, and everyone standing down when the stars are gone.
import { OUTFITS } from '../characters/appearance.js';
import { PoliceDriver } from './policeDriver.js';
import { OfficerBrain } from './officerBrain.js';
import { TrafficDriver } from '../ai/trafficDriver.js';
import { groundHeight } from '../world/terrain.js';

const CARS_PER_LEVEL = [0, 1, 2, 3, 4, 5];
const SPAWN_GAP = [99, 4, 3, 2.4, 2, 1.6];
const ROADBLOCK_GAP = 28;
const RECYCLE_DISTANCE = 240;

export class PoliceDispatcher {
  constructor(game) {
    this.game = game;
    this.rng = game.rng.fork(911);
    this.units = [];
    this.officers = [];
    this.spawnTimer = 1.5;
    this.roadblockTimer = 8;
    this.patrolTimer = 0;
    game.events.on('wantedChanged', (e) => {
      if (e.level > 0 && e.previous === 0) this.spawnTimer = 1.2;
      if (e.level === 0) this.standDown();
    });
    // A cruiser the player steals stops being a police unit at once.
    game.events.on('vehicleEntered', (e) => {
      this.units = this.units.filter((unit) => unit.vehicle !== e.vehicle);
    });
  }

  /** True for the car the player is sitting in: it is never commandeered by the police. */
  isPlayerCar(vehicle) {
    return Boolean(vehicle.driver && vehicle.driver.kind === 'player');
  }

  makeOfficer(x, z) {
    const look = { ...OUTFITS.police, skin: this.rng.pick(['#e0ac69', '#c68642', '#8d5524', '#f1c27d']) };
    const officer = this.game.characters.spawn('police', x, z, look, { health: 90 });
    officer.weapon = 'pistol';
    return officer;
  }

  /** A cruiser with siren and driver at a lane spot, chasing. */
  spawnUnit(spot, chasing = true) {
    const game = this.game;
    const vehicle = game.vehicles.spawn('police', spot.x, spot.z, spot.yaw, { role: 'police' });
    const driver = this.makeOfficer(spot.x, spot.z);
    driver.vehicle = vehicle;
    vehicle.driver = driver;
    vehicle.engineOn = true;
    const unit = { vehicle, crew: [driver], deployed: false };
    if (chasing) {
      vehicle.ai = new PoliceDriver(vehicle, this.rng.fork(vehicle.id));
      vehicle.siren = true;
      vehicle.vx = Math.sin(spot.yaw) * 12;
      vehicle.vz = Math.cos(spot.yaw) * 12;
    }
    this.units.push(unit);
    return unit;
  }

  spawnChaser() {
    const game = this.game;
    const player = game.player.character;
    // While Kai is out of sight, reinforcements head for the search area, not for him.
    const searching = game.wanted.searching;
    const center = searching ? game.wanted.lastKnown : player;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const spot = game.network.randomLaneSpot(this.rng, center, searching ? 40 : 85, searching ? 130 : 165);
      if (!spot) continue;
      if (searching && Math.hypot(spot.x - player.x, spot.z - player.z) < 80) continue;
      if (game.population.inView(spot.x, spot.z) && attempt < 4) continue;
      if (game.vehicles.nearest(spot.x, spot.z, 8)) continue;
      return this.spawnUnit(spot, true);
    }
    return null;
  }

  /** Patrol cars already near the player turn on their sirens and join in. */
  enlistPatrols() {
    const player = this.game.player.character;
    for (const vehicle of this.game.vehicles.list) {
      if (vehicle.type !== 'police' || !vehicle.driver || vehicle.destroyed || this.isPlayerCar(vehicle)) continue;
      if (vehicle.ai instanceof PoliceDriver) continue;
      if (Math.hypot(vehicle.x - player.x, vehicle.z - player.z) > 160) continue;
      vehicle.ai = new PoliceDriver(vehicle, this.rng.fork(vehicle.id));
      vehicle.siren = true;
      vehicle.role = 'police';
      const known = this.units.find((unit) => unit.vehicle === vehicle);
      if (!known) this.units.push({ vehicle, crew: [vehicle.driver], deployed: false });
    }
  }

  /** Two cruisers parked across the road ahead of a speeding suspect, officers behind them. */
  spawnRoadblock() {
    const game = this.game;
    const player = game.player.character;
    const car = player.vehicle;
    if (!car || car.speed < 9) return false;
    const heading = Math.atan2(car.vx, car.vz);
    const aheadX = car.x + Math.sin(heading) * 110;
    const aheadZ = car.z + Math.cos(heading) * 110;
    const node = game.network.nearestNode(aheadX, aheadZ);
    // Block the road leaving that junction toward the player's direction of travel.
    let best = null;
    let bestDot = -2;
    for (const next of node.neighbors) {
      const other = game.network.nodes[next];
      const dx = other.x - node.x;
      const dz = other.z - node.z;
      const dot = (dx * Math.sin(heading) + dz * Math.cos(heading)) / Math.hypot(dx, dz);
      if (dot > bestDot) {
        bestDot = dot;
        best = other;
      }
    }
    if (!best || Math.hypot(node.x - car.x, node.z - car.z) < 60) return false;
    const dx = (best.x - node.x) / 80;
    const dz = (best.z - node.z) / 80;
    const cx = node.x + dx * 22;
    const cz = node.z + dz * 22;
    const across = Math.atan2(dx, dz) + Math.PI / 2;
    let placed = 0;
    for (const side of [-1, 1]) {
      const x = cx + -dz * side * 3.3;
      const z = cz + dx * side * 3.3;
      if (game.vehicles.nearest(x, z, 4)) continue;
      const unit = this.spawnUnit({ x, z, yaw: across + (side > 0 ? 0.25 : -0.25) }, true);
      unit.vehicle.ai.mode = 'block';
      unit.vehicle.vx = 0;
      unit.vehicle.vz = 0;
      unit.roadblock = true;
      this.deploy(unit, 3.5);
      placed += 1;
    }
    if (placed > 0) game.events.emit('roadblock', { x: cx, z: cz });
    return placed > 0;
  }

  /** Officers climb out and continue on foot. */
  deploy(unit, back = 2) {
    if (unit.deployed || this.isPlayerCar(unit.vehicle)) return;
    unit.deployed = true;
    const vehicle = unit.vehicle;
    const driver = vehicle.driver;
    const spots = [vehicle.localToWorld(vehicle.model.door.x, vehicle.model.door.z - back * 0.2), vehicle.localToWorld(-vehicle.model.door.x, vehicle.model.door.z - back * 0.2)];
    if (driver) {
      driver.vehicle = null;
      vehicle.driver = null;
      driver.x = spots[0].x;
      driver.z = spots[0].z;
      driver.y = groundHeight(driver.x, driver.z);
      driver.brain = new OfficerBrain(driver, this.rng.fork(driver.id));
      this.officers.push(driver);
    }
    if (this.game.wanted.level >= 2 && this.officers.length < 10) {
      const partner = this.makeOfficer(spots[1].x, spots[1].z);
      partner.brain = new OfficerBrain(partner, this.rng.fork(partner.id));
      this.officers.push(partner);
      unit.crew.push(partner);
    }
    vehicle.ai = null;
    vehicle.siren = true;
    vehicle.clearControls();
    vehicle.controls.handbrake = true;
  }

  standDown() {
    const game = this.game;
    for (const unit of this.units) {
      const vehicle = unit.vehicle;
      if (this.isPlayerCar(vehicle)) continue;
      vehicle.siren = false;
      if (vehicle.driver && !vehicle.destroyed) {
        const spot = game.network.laneFromPosition(vehicle.x, vehicle.z, vehicle.yaw);
        const driver = new TrafficDriver(vehicle, game.network, game.city.signals, this.rng.fork(vehicle.id));
        if (spot) {
          driver.prev = spot.from;
          driver.node = spot.to;
          driver.lane = spot.lane;
          driver.pushLaneEnd(spot.from, spot.to, spot.lane);
          vehicle.ai = driver;
          vehicle.role = 'traffic';
          game.population.traffic.push(vehicle);
        } else {
          vehicle.ai = null;
        }
      }
    }
    for (const officer of this.officers) {
      officer.aimYaw = null;
    }
    this.units = [];
    this.roadblockTimer = 8;
  }

  update(dt) {
    const game = this.game;
    const level = game.wanted.level;
    const player = game.player.character;
    this.officers = this.officers.filter((officer) => {
      if (!officer.active) return false;
      const d = Math.hypot(officer.x - player.x, officer.z - player.z);
      if ((level === 0 && d > 70) || d > 180 || (officer.state === 'dead' && d > 80)) {
        game.characters.remove(officer);
        return false;
      }
      return true;
    });
    if (level === 0) {
      this.patrolTimer -= dt;
      if (this.patrolTimer <= 0) {
        this.patrolTimer = 6;
        this.keepPatrols();
      }
      return;
    }
    this.units = this.units.filter((unit) => {
      const vehicle = unit.vehicle;
      if (!vehicle.active) return false;
      const d = Math.hypot(vehicle.x - player.x, vehicle.z - player.z);
      if (d > RECYCLE_DISTANCE || (vehicle.destroyed && d > 60)) {
        game.vehicles.remove(vehicle);
        return false;
      }
      return true;
    });
    this.enlistPatrols();
    const chasing = this.units.filter((unit) => !unit.deployed && !unit.vehicle.destroyed).length;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && chasing < CARS_PER_LEVEL[level]) {
      this.spawnTimer = SPAWN_GAP[level];
      this.spawnChaser();
    }
    if (level >= 3) {
      this.roadblockTimer -= dt;
      if (this.roadblockTimer <= 0) {
        // A failed placement (no straight road ahead, cars in the way) tries again soon.
        this.roadblockTimer = this.spawnRoadblock() ? ROADBLOCK_GAP - level * 2 : 2.5;
      }
    }
    const playerSlow = !player.vehicle || player.vehicle.speed < 3;
    for (const unit of this.units) {
      if (unit.deployed || unit.vehicle.destroyed || !unit.vehicle.driver) continue;
      const vehicle = unit.vehicle;
      const d = Math.hypot(vehicle.x - player.x, vehicle.z - player.z);
      if (playerSlow && d < 20 && vehicle.speed < 4) this.deploy(unit);
    }
  }

  /** A couple of cruisers patrol as ordinary traffic so crimes can be witnessed. */
  keepPatrols() {
    const game = this.game;
    const player = game.player.character;
    const patrols = game.vehicles.list.filter((v) => v.type === 'police' && v.active && v.driver && !v.destroyed && !this.isPlayerCar(v));
    for (const patrol of patrols) {
      if (Math.hypot(patrol.x - player.x, patrol.z - player.z) > 230) game.vehicles.remove(patrol);
    }
    if (patrols.length >= 2) return;
    const spot = game.network.randomLaneSpot(this.rng, player, 90, 170);
    if (!spot || game.vehicles.nearest(spot.x, spot.z, 8)) return;
    const unit = this.spawnUnit(spot, false);
    const driver = new TrafficDriver(unit.vehicle, game.network, game.city.signals, this.rng.fork(unit.vehicle.id));
    driver.place(spot.from, spot.to, spot.lane, spot.t);
    unit.vehicle.ai = driver;
    unit.vehicle.role = 'patrol';
    this.units = this.units.filter((u) => u !== unit);
  }
}
