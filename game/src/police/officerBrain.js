// An officer on foot: runs the suspect down to cuff them, and from three stars (or when the
// suspect is fighting) stops, aims and fires after a moment's hesitation, with accuracy that
// rises with the wanted level. Out of sight, they search where the suspect was last seen.
import { distance2D } from '../core/mathUtils.js';

export class OfficerBrain {
  constructor(character, rng) {
    this.character = character;
    this.rng = rng;
    this.cooldown = rng.range(0.6, 1.6);
    this.burst = 0;
    this.home = null;
    /** What the officer is doing, in dispatch words (the HUD's police panel reads it). */
    this.behaviour = 'On foot';
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
    // One or two stars: they want an arrest and keep their guns holstered unless Kai fights.
    const shoot = (wanted.level >= 3 || violent) && sight && distance > 2.2;
    this.cooldown -= dt;
    // A moment to size up the situation after getting out or catching sight of him.
    this.reaction = sight ? (this.reaction ?? 1.2) - dt : 1.2;
    officer.weapon = 'pistol';
    if (shoot && distance < 32) {
      officer.setMove(0, 0, 0);
      officer.aimYaw = Math.atan2(target.x - officer.x, target.z - officer.z);
      officer.aimPitch = 0;
      this.behaviour = 'Aiming';
      if (this.cooldown <= 0 && this.reaction <= 0) {
        const accuracy = Math.min(0.7, 0.25 + wanted.level * 0.08);
        game.combat.fireNpcShot(officer, player, accuracy, 'pistol');
        this.burst += 1;
        this.cooldown = this.burst % 3 === 0 ? this.rng.range(1.6, 2.6) : this.rng.range(0.4, 0.7);
        this.firedAt = game.time;
      }
      if (game.time - (this.firedAt ?? -9) < 1.2) this.behaviour = 'Firing';
      return;
    }
    officer.aimYaw = null;
    // Lost sight of him: walk to where he was last seen and look around there.
    const goal = wanted.searching && !sight ? wanted.lastKnown : target;
    const gap = distance2D(officer.x, officer.z, goal.x, goal.z);
    this.behaviour = goal !== target ? 'Searching on foot' : gap < 3 ? 'Making an arrest' : 'Running you down';
    if (gap > 1.4) officer.setMove(goal.x - officer.x, goal.z - officer.z, goal === target && gap > 6 ? 6.2 : 3.2);
    else {
      officer.setMove(0, 0, 0);
      officer.yaw = Math.atan2(target.x - officer.x, target.z - officer.z);
    }
  }
}
