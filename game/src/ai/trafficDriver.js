// Drives a civilian car through the grid: keeps its lane, turns at junctions (outer lane turns
// right, inner lane turns left), stops at red lights and behind cars or people, honks when
// blocked and panics (speeds off, ignores lights) after gunfire or a crash.
import { clamp } from '../core/mathUtils.js';

const ARRIVE = 3.2;
const STOP_MARGIN = 1.2;

export class TrafficDriver {
  constructor(vehicle, network, signals, rng) {
    this.vehicle = vehicle;
    this.network = network;
    this.signals = signals;
    this.rng = rng;
    this.waypoints = [];
    this.cruise = rng.range(10.5, 14);
    this.panic = 0;
    this.hornTimer = 0;
    this.blockedTimer = 0;
    this.prev = 0;
    this.node = 0;
    this.lane = 0;
    this.speedLimit = Infinity;
    this.preferStraight = false;
  }

  /** Puts the car on lane (from -> to) at fraction t, facing along the lane. */
  place(from, to, lane, t) {
    const line = this.network.lane(from, to, lane);
    const vehicle = this.vehicle;
    vehicle.x = line.sx + (line.ex - line.sx) * t;
    vehicle.z = line.sz + (line.ez - line.sz) * t;
    vehicle.yaw = line.yaw;
    vehicle.vx = line.dx * this.cruise * 0.6;
    vehicle.vz = line.dz * this.cruise * 0.6;
    this.prev = from;
    this.node = to;
    this.lane = lane;
    this.waypoints = [];
    this.pushLaneEnd(from, to, lane);
  }

  pushLaneEnd(from, to, lane) {
    const line = this.network.lane(from, to, lane);
    const middle = { x: (line.sx + line.ex) / 2, z: (line.sz + line.ez) / 2 };
    this.waypoints.push(middle);
    this.waypoints.push({ x: line.ex, z: line.ez, stop: { junction: to, axis: line.axis } });
  }

  /** Picks the next junction exit and queues the turn and the next lane. */
  queueNext() {
    const node = this.network.nodes[this.node];
    const options = node.neighbors.filter((id) => id !== this.prev);
    const allowed = options.filter((id) => {
      const kind = this.network.turnKind(this.prev, this.node, id);
      return kind === 'straight' || (kind === 'right' && this.lane === 1) || (kind === 'left' && this.lane === 0);
    });
    const choices = allowed.length > 0 ? allowed : options.length > 0 ? options : node.neighbors;
    let next = choices[Math.floor(this.rng.next() * choices.length)];
    if (this.preferStraight) {
      const straight = options.find((id) => this.network.turnKind(this.prev, this.node, id) === 'straight');
      if (straight !== undefined) next = straight;
    }
    const kind = this.network.turnKind(this.prev, this.node, next);
    const laneOut = kind === 'right' ? 1 : kind === 'left' ? 0 : this.lane;
    for (const point of this.network.turnPoints(this.prev, this.node, next, this.lane, laneOut)) {
      if (kind !== 'straight') point.turn = true;
      this.waypoints.push(point);
    }
    this.prev = this.node;
    this.node = next;
    this.lane = laneOut;
    this.pushLaneEnd(this.prev, this.node, this.lane);
  }

  startPanic(seconds = 10) {
    this.panic = Math.max(this.panic, seconds);
  }

  /** Distance to the nearest thing in this car's path, scanning cars and people. */
  scanAhead(world, reach) {
    const vehicle = this.vehicle;
    const fx = Math.sin(vehicle.yaw);
    const fz = Math.cos(vehicle.yaw);
    let nearest = reach;
    const check = (x, z, radius) => {
      const dx = x - vehicle.x;
      const dz = z - vehicle.z;
      const ahead = dx * fx + dz * fz;
      if (ahead <= 0 || ahead > reach + vehicle.halfLength) return;
      const side = Math.abs(dx * -fz + dz * fx);
      if (side > vehicle.halfWidth + radius + 0.35) return;
      const gap = ahead - vehicle.halfLength - radius;
      if (gap < nearest) nearest = gap;
    };
    for (const other of world.vehicles.list) {
      if (other === vehicle || !other.active) continue;
      check(other.x, other.z, other.halfWidth + 0.3);
    }
    for (const person of world.characters.list) {
      if (!person.active || person.vehicle || person.state === 'dead') continue;
      check(person.x, person.z, 0.5);
    }
    return nearest;
  }

  update(dt, world) {
    const vehicle = this.vehicle;
    const controls = vehicle.controls;
    if (vehicle.destroyed || !vehicle.driver) {
      vehicle.clearControls();
      controls.handbrake = !vehicle.destroyed;
      return;
    }
    this.panic = Math.max(0, this.panic - dt);
    this.hornTimer = Math.max(0, this.hornTimer - dt);
    while (this.waypoints.length < 6) this.queueNext();
    // Drop waypoints we reached or passed.
    while (this.waypoints.length > 1) {
      const point = this.waypoints[0];
      const dx = point.x - vehicle.x;
      const dz = point.z - vehicle.z;
      const ahead = dx * Math.sin(vehicle.yaw) + dz * Math.cos(vehicle.yaw);
      if (dx * dx + dz * dz < ARRIVE * ARRIVE || ahead < -1) this.waypoints.shift();
      else break;
    }
    const speed = vehicle.forwardSpeed;
    const look = 4.5 + Math.max(0, speed) * 0.45;
    let target = this.waypoints[this.waypoints.length - 1];
    for (const point of this.waypoints) {
      if (Math.hypot(point.x - vehicle.x, point.z - vehicle.z) >= look) {
        target = point;
        break;
      }
    }
    const local = vehicle.worldToLocal(target.x, target.z);
    const distance = Math.max(1, Math.hypot(local.x, local.z));
    const axle = vehicle.spec.wheelBase * 2;
    const steerAngle = Math.atan2(2 * axle * -local.x, distance * distance);
    const limit = vehicle.spec.steerMax * (1 - Math.min(Math.abs(speed) / 50, 1) * 0.7);
    controls.steer = clamp(steerAngle / limit, -1, 1);

    // Target speed: cruise, slow for turns, stop for lights and obstacles.
    const panicking = this.panic > 0;
    let wanted = panicking ? Math.max(19, this.cruise) : this.cruise;
    wanted = Math.min(wanted, this.speedLimit);
    const turnSharpness = Math.abs(controls.steer);
    wanted *= 1 - turnSharpness * 0.55;
    // Brake ahead of corners: the closer the first turn point, the slower.
    for (const point of this.waypoints) {
      if (!point.turn) continue;
      const toTurn = Math.hypot(point.x - vehicle.x, point.z - vehicle.z);
      if (toTurn < 45) wanted = Math.min(wanted, (panicking ? 9 : 6.5) + toTurn * 0.32);
      break;
    }
    if (!panicking) {
      for (const point of this.waypoints) {
        if (!point.stop) continue;
        const stopDistance = Math.hypot(point.x - vehicle.x, point.z - vehicle.z);
        if (stopDistance > 40) break;
        const light = this.signals.state(point.stop.junction, point.stop.axis);
        const mustStop = light === 'red' || (light === 'yellow' && stopDistance > 6);
        if (mustStop) wanted = Math.min(wanted, Math.max(0, (stopDistance - STOP_MARGIN) * 0.8));
        break;
      }
    }
    const gap = this.scanAhead(world, 6 + Math.max(0, speed) * 1.4);
    if (gap < 30) wanted = Math.min(wanted, Math.max(0, (gap - 2.2) * 1.1));
    if (gap < 4 && speed < 1) {
      this.blockedTimer += dt;
      if (this.blockedTimer > 2.5 && this.hornTimer <= 0) {
        this.hornTimer = 3 + this.rng.next() * 3;
        world.events.emit('horn', { vehicle, duration: 0.5 });
      }
    } else {
      this.blockedTimer = 0;
    }
    const error = wanted - speed;
    controls.throttle = error > 0 ? clamp(error * 0.4, 0, panicking ? 1 : 0.75) : 0;
    controls.brake = error < -0.3 && speed > 0.5 ? clamp(-error * 0.35, 0, 1) : 0;
    // Holding still uses the handbrake: the brake pedal at a standstill means reverse.
    controls.handbrake = wanted < 0.4 && speed < 1.2;
    if (controls.handbrake) controls.throttle = 0;
  }
}
