// Crane's crew in a fight: they loiter at their post until Kai comes close, makes noise or hurts
// one of them, then gunmen keep their distance and fire in bursts while brawlers rush in.
import { distance2D } from '../core/mathUtils.js';

export class GangBrain {
  constructor(character, rng, { armed = true, weapon = 'pistol', alertRange = 24, accuracy = 0.5 } = {}) {
    this.character = character;
    this.rng = rng;
    this.armed = armed;
    this.weapon = weapon;
    this.alertRange = alertRange;
    this.accuracy = accuracy;
    this.alert = false;
    // Seconds between noticing Kai and the first shot or swing: time for him to react.
    this.reaction = rng.range(1.6, 2.8);
    this.cooldown = rng.range(0.4, 1.4);
    this.strafe = rng.chance(0.5) ? 1 : -1;
    this.strafeTimer = rng.range(1, 3);
    this.post = { x: character.x, z: character.z };
    character.weapon = armed ? weapon : 'fists';
  }

  provoke() {
    this.alert = true;
  }

  /** A bullet or a punch landed: they flinch, and their next shot or swing comes later. */
  stagger(seconds) {
    this.alert = true;
    this.cooldown = Math.max(this.cooldown, seconds);
    this.flinch = seconds * 0.6;
  }

  update(dt, game) {
    const me = this.character;
    if (!me.canAct) {
      me.setMove(0, 0, 0);
      return;
    }
    const player = game.player.character;
    if (!player.alive) {
      me.aimYaw = null;
      me.setMove(0, 0, 0);
      return;
    }
    const target = player.vehicle ?? player;
    const distance = distance2D(me.x, me.z, target.x, target.z);
    if (!this.alert) {
      if (distance < this.alertRange || me.health < me.maxHealth || game.time - game.combat.lastPlayerAttack < 0.5 && distance < 50) this.alert = true;
      else {
        me.setMove(this.post.x - me.x, this.post.z - me.z, distance2D(me.x, me.z, this.post.x, this.post.z) > 1 ? 1.4 : 0);
        return;
      }
    }
    // Hurting one of them cuts the hesitation short.
    this.reaction -= me.health < me.maxHealth ? dt * 3 : dt;
    const ready = this.reaction <= 0;
    if (this.flinch > 0) {
      // Reeling from a hit: no moving in for a moment.
      this.flinch -= dt;
      me.setMove(0, 0, 0);
      this.cooldown -= dt;
      return;
    }
    const sight = !game.collision.segmentBlocked(me.x, me.z, target.x, target.z, 1.5);
    if (this.armed) {
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) {
        this.strafe = -this.strafe;
        this.strafeTimer = this.rng.range(1, 2.5);
      }
      const dx = target.x - me.x;
      const dz = target.z - me.z;
      const length = Math.hypot(dx, dz) || 1;
      if (distance > 18 || !sight) me.setMove(dx, dz, 5.2);
      else if (distance < 6) me.setMove(-dx, -dz, 3);
      else me.setMove(-dz / length * this.strafe, dx / length * this.strafe, 1.8);
      me.aimYaw = Math.atan2(dx, dz);
      this.cooldown -= dt;
      if (ready && sight && distance < 40 && this.cooldown <= 0) {
        game.combat.fireNpcShot(me, player, this.accuracy, this.weapon);
        this.cooldown = this.weapon === 'smg' ? this.rng.range(0.12, 0.2) : this.rng.range(0.8, 1.4);
        if (this.rng.chance(this.weapon === 'smg' ? 0.12 : 0.3)) this.cooldown += this.rng.range(1, 2);
      }
      return;
    }
    me.aimYaw = null;
    if (distance > 1.3) me.setMove(target.x - me.x, target.z - me.z, ready ? 5.6 : 3);
    else {
      me.setMove(0, 0, 0);
      me.yaw = Math.atan2(target.x - me.x, target.z - me.z);
      this.cooldown -= dt;
      if (ready && this.cooldown <= 0 && !player.vehicle) {
        game.combat.punch(me);
        this.cooldown = this.rng.range(1.2, 1.8);
      }
    }
  }
}
