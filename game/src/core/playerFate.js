// What happens when Kai goes down or gets cuffed: FLATLINED (slow motion, drained colour, wake
// up at St. Marisol Medical and pay the bill) or ARRESTED (hands up, wake up outside police HQ,
// pay the fine and lose spare ammo). Either clears the wanted level and fails the mission.
// The respawn puts Kai on open pavement facing the street, with full control, before anything
// else in the world is reset.
import { PLACES } from '../world/cityPlan.js';
import { findStandingSpot } from '../world/standingSpots.js';
import { formatMoney } from './mathUtils.js';

const FADE_AT = 3.4;
const RESPAWN_AT = 4.3;

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
    // Nobody is at the wheel any more: the car rolls to a stop instead of keeping the last keys.
    if (hero.vehicle) {
      hero.vehicle.clearControls();
      hero.vehicle.controls.brake = 0.6;
      hero.vehicle.horn = false;
    }
    if (kind === 'wasted') {
      game.notifications.banner('FLATLINED', 'St. Marisol Medical will patch you up.', 'fail', RESPAWN_AT);
      game.timeScale = 0.35;
      game.events.emit('playerWasted', {});
    } else {
      if (hero.vehicle) game.player.exitVehicle();
      hero.handsUp = true;
      game.notifications.banner('ARRESTED', 'The Solmara Bay Police keep your spare ammo.', 'arrest', RESPAWN_AT);
    }
    game.screenEffects.drain(true);
  }

  update(dt) {
    const game = this.game;
    const hero = game.player.character;
    if (!this.kind && hero.state === 'dead') this.begin('wasted');
    if (!this.kind) return;
    // Counted in real seconds, whatever the slow motion does to the world.
    this.timer += dt / Math.max(0.1, game.timeScale);
    if (this.timer > FADE_AT && !this.faded) {
      game.screenEffects.fadeTo(1);
      this.faded = true;
    }
    if (this.timer > RESPAWN_AT) this.respawn();
  }

  respawn() {
    const game = this.game;
    const hero = game.player.character;
    const wasted = this.kind === 'wasted';
    this.kind = null;
    // Kai first: on his feet with full control, whatever the rest of the world does next.
    game.player.placeAt(findStandingSpot(game.collision, wasted ? PLACES.hospital : PLACES.policeStation));
    hero.health = hero.maxHealth;
    if (wasted) hero.armour = 0;
    hero.lastAttacker = null;
    game.timeScale = 1;
    game.player.enabled = true;
    game.screenEffects.drain(false);
    game.screenEffects.fadeTo(0);
    game.notifications.clearBanner();
    // Then the bill, the wanted level and a fresh street around the respawn point.
    const fee = Math.min(game.progress.money, wasted ? 400 : 500 + Math.round(game.progress.money * 0.05));
    game.progress.addMoney(-fee, wasted ? 'hospital' : 'fine');
    if (wasted) game.progress.bump('hospital');
    else {
      game.combat.arsenal.confiscate();
      game.progress.bump('arrests');
    }
    game.wanted.clear('respawn');
    game.population.reset();
    game.notifications.toast(wasted ? `Hospital bill: ${formatMoney(fee)}` : `Fine paid: ${formatMoney(fee)}`, '', 4);
    game.events.emit('playerRespawned', { wasted });
  }
}
