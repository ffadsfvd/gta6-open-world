// One person in the world (the player, a pedestrian, an officer, a gang member, a story
// character): position, motion intent, health and armour, state and animation values.

let nextId = 1;

export class Character {
  constructor(kind, x, z, appearance) {
    this.id = nextId++;
    this.kind = kind;
    this.appearance = appearance;
    this.x = x;
    this.y = 0.15;
    this.z = z;
    this.yaw = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.radius = 0.35;
    this.onGround = true;
    this.swimming = false;
    this.moveX = 0;
    this.moveZ = 0;
    this.moveSpeed = 0;
    this.aimYaw = null;
    this.aimPitch = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.armour = 0;
    this.state = 'idle';
    this.downTimer = 0;
    this.downYaw = 0;
    this.active = true;
    this.vehicle = null;
    this.brain = null;
    this.weapon = 'fists';
    this.punchTimer = 0;
    this.recoil = 0;
    this.hitFlash = 0;
    this.lastAttacker = null;
    this.handsUp = false;
    this.anim = { phase: 0, stride: 0, airborne: 0, down: 0, punch: 0, aim: 0, lean: 0 };
    this.mission = null;
    this.label = null;
  }

  get alive() {
    return this.state !== 'dead';
  }

  get canAct() {
    return this.state !== 'dead' && this.state !== 'down' && !this.vehicle;
  }

  /** Wants to move along (dx, dz) at `speed` m/s; the motion step eases into it. */
  setMove(dx, dz, speed) {
    const length = Math.hypot(dx, dz);
    if (length < 1e-4 || speed <= 0) {
      this.moveX = 0;
      this.moveZ = 0;
      this.moveSpeed = 0;
      return;
    }
    this.moveX = dx / length;
    this.moveZ = dz / length;
    this.moveSpeed = speed;
  }

  /** Damage after armour. Returns true when this hit killed the character. */
  takeDamage(amount, attacker = null) {
    if (this.state === 'dead') return false;
    let remaining = amount;
    if (this.armour > 0) {
      const absorbed = Math.min(this.armour, remaining * 0.7);
      this.armour -= absorbed;
      remaining -= absorbed;
    }
    this.health = Math.max(0, this.health - remaining);
    this.hitFlash = 0.25;
    if (attacker) this.lastAttacker = attacker;
    if (this.health <= 0) {
      this.state = 'dead';
      this.downYaw = this.yaw;
      return true;
    }
    return false;
  }

  /** Thrown to the ground (hit by a car, an explosion, a heavy punch). */
  knockDown(vx, vz, seconds = 2.5, upward = 3) {
    if (this.state === 'dead') {
      this.vx = vx;
      this.vz = vz;
      return;
    }
    this.state = 'down';
    this.downTimer = seconds;
    this.downYaw = this.yaw;
    this.vx = vx;
    this.vz = vz;
    this.vy = upward;
    this.onGround = false;
  }
}
