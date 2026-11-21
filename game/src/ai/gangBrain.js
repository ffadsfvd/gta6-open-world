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
    this.cooldown = rng.range(0.4, 1.4);
    this.strafe = rng.chance(0.5) ? 1 : -1;
    this.strafeTimer = rng.range(1, 3);
    this.post = { x: character.x, z: character.z };
    character.weapon = armed ? weapon : 'fists';
  }

  provoke() {
    this.alert = true;
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
      if (sight && distance < 40 && this.cooldown <= 0) {
        game.combat.fireNpcShot(me, player, this.accuracy, this.weapon);
        this.cooldown = this.weapon === 'smg' ? this.rng.range(0.1, 0.16) : this.rng.range(0.55, 1.1);
        if (this.rng.chance(this.weapon === 'smg' ? 0.08 : 0.25)) this.cooldown += this.rng.range(0.8, 1.6);
      }
      return;
    }
    me.aimYaw = null;
    if (distance > 1.3) me.setMove(target.x - me.x, target.z - me.z, 5.6);
    else {
      me.setMove(0, 0, 0);
      me.yaw = Math.atan2(target.x - me.x, target.z - me.z);
      this.cooldown -= dt;
      if (this.cooldown <= 0 && !player.vehicle) {
        game.combat.punch(me);
        this.cooldown = this.rng.range(0.7, 1.2);
      }
    }
  }
}
