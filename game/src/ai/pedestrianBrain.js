// A pedestrian's mind: stroll the sidewalk loop, wait for the lights and cross at the zebra,
// wander the plaza, raise hands when a gun is pointed at them, flee from gunfire, crashes and
// explosions, and sometimes swing back at whoever punched them.
import { cornerPoint, crossingsFrom, nearestCorner } from './sidewalkPaths.js';
import { distance2D } from '../core/mathUtils.js';
import { blockBounds } from '../world/cityPlan.js';

const ARRIVE = 0.9;

export class PedestrianBrain {
  constructor(character, rng, spot) {
    this.character = character;
    this.rng = rng;
    this.mode = 'walk';
    this.walkSpeed = rng.range(1.15, 1.7);
    this.bx = spot.bx;
    this.bz = spot.bz;
    this.corner = spot.corner;
    this.clockwise = rng.chance(0.5);
    this.crossing = null;
    this.timer = 0;
    this.threat = null;
    this.target = null;
    this.plaza = spot.plaza ?? false;
    this.braveness = rng.next();
    if (!this.clockwise) this.corner = (this.corner + 3) % 4;
    this.setCornerTarget();
  }

  setCornerTarget() {
    this.target = cornerPoint(this.bx, this.bz, this.corner);
  }

  /** Something scary happened at (x, z): run (or, if brave and punched, fight). */
  scare(x, z, seconds = 8, source = null) {
    const character = this.character;
    if (!character.canAct) return;
    if (source && source === character.lastAttacker && this.braveness > 0.82 && this.mode !== 'flee') {
      this.mode = 'fight';
      this.threat = source;
      this.timer = 10;
      return;
    }
    this.mode = 'flee';
    this.threat = { x, z };
    this.timer = Math.max(this.timer, seconds * (0.7 + this.rng.next() * 0.6));
    character.handsUp = false;
  }

  /** A gun is pointed at me from close by. */
  menace(x, z) {
    if (this.mode === 'flee' || !this.character.canAct) return;
    if (this.braveness < 0.5) {
      this.mode = 'cower';
      this.timer = 3;
      this.threat = { x, z };
    } else {
      this.scare(x, z, 7);
    }
  }

  resumeWalking() {
    const character = this.character;
    const corner = nearestCorner(character.x, character.z);
    this.bx = corner.bx;
    this.bz = corner.bz;
    this.corner = corner.corner;
    this.mode = 'walk';
    this.crossing = null;
    character.handsUp = false;
    this.setCornerTarget();
  }

  nextLeg(world) {
    const options = crossingsFrom(this.bx, this.bz, this.corner);
    if (options.length > 0 && this.rng.chance(0.35)) {
      this.crossing = this.rng.pick(options);
      this.mode = 'wait';
      this.timer = 0;
      return;
    }
    if (this.plaza && this.rng.chance(0.5)) {
      this.mode = 'wander';
      this.timer = this.rng.range(12, 30);
      this.pickWanderTarget();
      return;
    }
    this.corner = this.clockwise ? (this.corner + 1) % 4 : (this.corner + 3) % 4;
    this.setCornerTarget();
    if (world && this.rng.chance(0.1)) {
      this.mode = 'pause';
      this.timer = this.rng.range(2, 6);
    }
  }

  pickWanderTarget() {
    const b = blockBounds(this.bx, this.bz);
    this.target = { x: this.rng.range(b.lotMinX + 3, b.lotMaxX - 3), z: this.rng.range(b.lotMinZ + 3, b.lotMaxZ - 3) };
  }

  update(dt, world) {
    const character = this.character;
    if (!character.canAct) {
      character.setMove(0, 0, 0);
      return;
    }
    this.timer -= dt;
    switch (this.mode) {
      case 'flee': {
        const away = { x: character.x - this.threat.x, z: character.z - this.threat.z };
        const wobble = Math.sin(world.time * 1.3 + character.id) * 0.4;
        character.setMove(away.x + away.z * wobble, away.z - away.x * wobble, 5.6);
        if (this.timer <= 0) this.resumeWalking();
        return;
      }
      case 'cower':
        character.handsUp = true;
        character.setMove(0, 0, 0);
        character.yaw = Math.atan2(this.threat.x - character.x, this.threat.z - character.z);
        if (this.timer <= 0) {
          character.handsUp = false;
          this.scare(this.threat.x, this.threat.z, 6);
        }
        return;
      case 'fight': {
        const foe = this.threat;
        if (!foe || !foe.alive || foe.vehicle || this.timer <= 0) {
          this.resumeWalking();
          return;
        }
        const distance = distance2D(character.x, character.z, foe.x, foe.z);
        if (distance > 1.3) character.setMove(foe.x - character.x, foe.z - character.z, 4.5);
        else {
          character.setMove(0, 0, 0);
          character.yaw = Math.atan2(foe.x - character.x, foe.z - character.z);
          if (character.punchTimer <= 0 && world.combat) world.combat.punch(character);
        }
        return;
      }
      case 'pause':
        character.setMove(0, 0, 0);
        if (this.timer <= 0) this.mode = 'walk';
        return;
      case 'wait': {
        character.setMove(0, 0, 0);
        const light = world.city.signals.state(this.crossing.junction, this.crossing.axis);
        if (light === 'red' && this.timer < -0.6) {
          this.mode = 'cross';
          this.target = cornerPoint(this.crossing.bx, this.crossing.bz, this.crossing.corner);
        }
        return;
      }
      default:
        break;
    }
    const dx = this.target.x - character.x;
    const dz = this.target.z - character.z;
    if (dx * dx + dz * dz < ARRIVE * ARRIVE) {
      if (this.mode === 'cross') {
        this.bx = this.crossing.bx;
        this.bz = this.crossing.bz;
        this.corner = this.crossing.corner;
        this.crossing = null;
        this.mode = 'walk';
        this.nextLeg(null);
      } else if (this.mode === 'wander') {
        if (this.timer <= 0) this.resumeWalking();
        else this.pickWanderTarget();
      } else {
        this.nextLeg(world);
      }
      return;
    }
    character.setMove(dx, dz, this.mode === 'cross' ? this.walkSpeed * 1.25 : this.walkSpeed);
  }
}
