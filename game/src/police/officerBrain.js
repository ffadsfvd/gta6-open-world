// An officer on foot: runs the suspect down to cuff them, and from two stars (or when the
// suspect is shooting) stops, aims and fires with accuracy that rises with the wanted level.
import { distance2D } from '../core/mathUtils.js';

export class OfficerBrain {
  constructor(character, rng) {
    this.character = character;
    this.rng = rng;
    this.cooldown = rng.range(0.6, 1.6);
    this.burst = 0;
    this.home = null;
  }

  update(dt, game) {
    const officer = this.character;
    if (!officer.canAct) {
      officer.setMove(0, 0, 0);
      return;
    }
    const wanted = game.wanted;
    const player = game.player.character;
    if (wanted.level === 0 || !player.alive) {
      officer.aimYaw = null;
      officer.weapon = 'pistol';
      officer.setMove(0, 0, 0);
      this.idle = (this.idle ?? 0) + dt;
      return;
    }
    this.idle = 0;
    const target = player.vehicle ?? player;
    const distance = distance2D(officer.x, officer.z, target.x, target.z);
    const sight = distance < 45 && !game.collision.segmentBlocked(officer.x, officer.z, target.x, target.z, 1.5);
    const violent = game.time - game.combat.lastPlayerAttack < 6;
    const shoot = (wanted.level >= 2 || violent) && sight && distance > 2.2;
    this.cooldown -= dt;
    officer.weapon = 'pistol';
    if (shoot && distance < 32) {
      officer.setMove(0, 0, 0);
      officer.aimYaw = Math.atan2(target.x - officer.x, target.z - officer.z);
      officer.aimPitch = 0;
      if (this.cooldown <= 0) {
        const accuracy = Math.min(0.85, 0.35 + wanted.level * 0.1);
        game.combat.fireNpcShot(officer, player, accuracy, 'pistol');
        this.burst += 1;
        this.cooldown = this.burst % 3 === 0 ? this.rng.range(1.2, 2.2) : this.rng.range(0.35, 0.6);
      }
      return;
    }
    officer.aimYaw = null;
    if (distance > 1.4) officer.setMove(target.x - officer.x, target.z - officer.z, distance > 6 ? 6.2 : 3.2);
    else {
      officer.setMove(0, 0, 0);
      officer.yaw = Math.atan2(target.x - officer.x, target.z - officer.z);
    }
  }
}
