// Kai's staying power between fights: after a few seconds without taking a hit his health
// creeps back up to a reserve (not all the way: first aid, the safehouse and the hospital do
// that), so one bad scrap does not end a long run.
const REGEN_DELAY = 5;
const REGEN_RATE = 3.5;
const REGEN_LIMIT = 0.6;

export class PlayerVitals {
  constructor(game) {
    this.game = game;
    this.sinceHurt = Infinity;
    game.events.on('characterHurt', (e) => {
      if (e.victim === game.player.character) this.sinceHurt = 0;
    });
    game.events.on('pedestrianHit', (e) => {
      if (e.character === game.player.character) this.sinceHurt = 0;
    });
  }

  update(dt) {
    const hero = this.game.player.character;
    this.sinceHurt += dt;
    if (!hero.alive || this.sinceHurt < REGEN_DELAY) return;
    const limit = hero.maxHealth * REGEN_LIMIT;
    if (hero.health < limit) hero.health = Math.min(limit, hero.health + REGEN_RATE * dt);
  }
}
