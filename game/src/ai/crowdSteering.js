// Local avoidance for people on foot. Walkers coming the other way keep to their own right and
// ease off, someone standing in the way is passed on the free side, a walker blocked face to face
// waits a moment and then steps around, and anyone who has made no headway for a while takes a
// sidestep detour (and in the end turns back), so nobody stays stuck on a sidewalk.

/** How far ahead a walker looks for people in the way (metres). */
const LOOK_AHEAD = 3.2;
/** Centre-to-centre distance at which two people would brush shoulders (metres). */
const SHOULDER = 0.95;
/** Seconds without headway before a detour, and how long a detour lasts. */
const STUCK_AFTER = 1.1;
const DETOUR_TIME = 0.9;

export class CrowdSteering {
  constructor() {
    this.best = null;
    this.still = 0;
    this.detour = 0;
    this.detourSide = 1;
    this.detours = 0;
    this.wait = 0;
  }

  /** Forgets any detour (after a new route or a scare). */
  reset() {
    this.still = 0;
    this.detour = 0;
    this.detours = 0;
    this.wait = 0;
    this.best = null;
  }

  /**
   * Turns the wish "walk along (dx, dz) at `speed`" into a move that does not walk into anyone.
   * Returns { x, z, speed, blocked } where blocked counts detours in a row (the brain may turn
   * back once it is high).
   */
  steer(me, people, dx, dz, speed, dt) {
    const length = Math.hypot(dx, dz);
    if (length < 1e-4 || speed <= 0) {
      this.still = 0;
      return { x: 0, z: 0, speed: 0, blocked: 0 };
    }
    const fx = dx / length;
    const fz = dz / length;
    // Right of the walking direction (x east, z south: facing north, right is east).
    const rx = -fz;
    const rz = fx;
    this.trackHeadway(length, dt);
    if (this.detour > 0) {
      this.detour -= dt;
      const side = this.detourSide;
      return { x: fx * 0.35 + rx * side, z: fz * 0.35 + rz * side, speed: Math.max(1.1, speed * 0.8), blocked: this.detours };
    }
    let push = 0;
    let slow = 1;
    let faceToFace = false;
    for (const other of people) {
      if (other === me || !other.active || other.vehicle || other.state === 'dead') continue;
      const ox = other.x - me.x;
      const oz = other.z - me.z;
      if (Math.abs(ox) > LOOK_AHEAD || Math.abs(oz) > LOOK_AHEAD) continue;
      const ahead = ox * fx + oz * fz;
      if (ahead <= 0.05 || ahead > LOOK_AHEAD) continue;
      const lateral = ox * rx + oz * rz;
      if (Math.abs(lateral) > SHOULDER) continue;
      // Someone on my line: how much they come at me decides how early I give way.
      const ovx = other.vx * fx + other.vz * fz;
      const oncoming = ovx < -0.3;
      const nearness = 1 - ahead / LOOK_AHEAD;
      // Pass on the side away from them; dead ahead, everyone keeps right.
      const side = lateral > 0.12 ? -1 : 1;
      push += side * (0.55 + nearness * 1.6) * (oncoming ? 1.2 : 1);
      if (ahead < 1.3) {
        slow = Math.min(slow, oncoming ? 0.45 : 0.6);
        if (oncoming && Math.abs(lateral) < 0.45) faceToFace = true;
      } else if (!oncoming && Math.hypot(other.vx, other.vz) > 0.3) {
        // Following a slower walker: match their pace instead of shoving.
        slow = Math.min(slow, Math.max(0.5, Math.hypot(other.vx, other.vz) / speed));
      }
    }
    if (faceToFace) {
      // Nose to nose: a beat to let the other one choose, then a step to my right.
      this.wait += dt;
      if (this.wait > 0.35) this.startDetour(1);
    } else {
      this.wait = Math.max(0, this.wait - dt);
    }
    const sx = fx + rx * push;
    const sz = fz + rz * push;
    return { x: sx, z: sz, speed: speed * slow, blocked: this.detours };
  }

  /**
   * Headway is getting closer to where I am going: sliding along a wall or rocking back and forth
   * between two people is no headway. Long enough without it, a detour.
   */
  trackHeadway(distance, dt) {
    if (this.best === null || distance > this.best + 2) {
      // A new goal (the next corner): start counting afresh.
      this.best = distance;
      this.still = 0;
      return;
    }
    if (distance < this.best - 0.3) {
      this.best = distance;
      this.still = 0;
      if (this.detour <= 0) this.detours = 0;
      return;
    }
    this.still += dt;
    if (this.still > STUCK_AFTER && this.detour <= 0) this.startDetour(this.detours % 2 === 0 ? 1 : -1);
  }

  startDetour(side) {
    this.detour = DETOUR_TIME;
    this.detourSide = side;
    this.detours += 1;
    this.still = 0;
    this.wait = 0;
  }
}
