// What happens when Kai goes down or gets cuffed: FLATLINED (slow motion, drained colour, wake
// up at St. Marisol Medical and pay the bill) or ARRESTED (hands up, wake up outside police HQ,
// pay the fine and lose spare ammo). Either clears the wanted level and fails the mission.
import { PLACES } from '../world/cityPlan.js';
import { formatMoney } from './mathUtils.js';
import { groundHeight } from '../world/terrain.js';

export class PlayerFate {
  constructor(game) {
    this.game = game;
    this.kind = null;
    this.timer = 0;
    this.faded = false;
    game.events.on('playerBusted', () => this.begin('busted'));
  }

  get active() {
    return this.kind !== null;
  }

  begin(kind) {
    if (this.kind) return;
    const game = this.game;
    const hero = game.player.character;
    this.kind = kind;
    this.timer = 0;
    this.faded = false;
    game.player.enabled = false;
    hero.setMove(0, 0, 0);
    hero.aimYaw = null;
    if (kind === 'wasted') {
      game.events.emit('playerWasted', {});
      game.notifications.banner('FLATLINED', 'St. Marisol Medical will patch you up.', 'fail', 4.2);
      game.timeScale = 0.35;
    } else {
      if (hero.vehicle) game.player.exitVehicle();
      hero.handsUp = true;
      game.notifications.banner('ARRESTED', 'The Solmara Bay Police keep your spare ammo.', 'arrest', 4.2);
    }
    game.screenEffects.drain(true);
  }

  update(dt) {
    const game = this.game;
    const hero = game.player.character;
    if (!this.kind && hero.state === 'dead') this.begin('wasted');
    if (!this.kind) return;
    this.timer += dt / Math.max(0.1, game.timeScale);
    if (this.timer > 3.4 && !this.faded) {
      game.screenEffects.fadeTo(1);
      this.faded = true;
    }
    if (this.timer > 4.3) this.respawn();
  }

  respawn() {
    const game = this.game;
    const hero = game.player.character;
    const wasted = this.kind === 'wasted';
    const place = wasted ? PLACES.hospital : PLACES.policeStation;
    if (hero.vehicle) game.player.exitVehicle();
    hero.state = 'idle';
    hero.health = hero.maxHealth;
    if (wasted) hero.armour = 0;
    hero.handsUp = false;
    hero.x = place.x;
    hero.z = place.z;
    hero.y = groundHeight(place.x, place.z);
    hero.vx = 0;
    hero.vz = 0;
    hero.vy = 0;
    const fee = Math.min(game.progress.money, wasted ? 400 : 500 + Math.round(game.progress.money * 0.05));
    game.progress.addMoney(-fee, wasted ? 'hospital' : 'fine');
    if (wasted) game.progress.bump('hospital');
    else {
      game.combat.arsenal.confiscate();
      game.progress.bump('arrests');
    }
    game.wanted.clear('respawn');
    game.population.reset();
    game.followCamera.snapBehind(wasted ? 0 : -Math.PI / 2);
    game.timeScale = 1;
    game.screenEffects.drain(false);
    game.screenEffects.fadeTo(0);
    game.player.enabled = true;
    this.kind = null;
    game.notifications.toast(wasted ? `Hospital bill: ${formatMoney(fee)}` : `Fine paid: ${formatMoney(fee)}`, '', 4);
  }
}
