// Saving and loading through localStorage: money, story progress, unlocks, stats, weapons and
// ammo, health and armour, and where Kai was standing. Continue on the title screen loads it.
import { SAVE_KEY } from '../core/config.js';
import { PLACES } from '../world/cityPlan.js';

const VERSION = 1;

export class SaveGame {
  constructor(game) {
    this.game = game;
  }

  read() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && data.version === VERSION ? data : null;
    } catch {
      return null;
    }
  }

  exists() {
    return this.read() !== null;
  }

  /** A one-line summary for the Continue button. */
  summary() {
    const data = this.read();
    if (!data) return '';
    const missions = data.progress.completed.length;
    const date = new Date(data.savedAt);
    return `${missions}/7 story missions · $${data.progress.money.toLocaleString('en-US')} · ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  save() {
    const game = this.game;
    const hero = game.player.character;
    const data = {
      version: VERSION,
      savedAt: Date.now(),
      progress: game.progress.toJSON(),
      arsenal: game.combat.arsenal.toJSON(),
      hero: { health: hero.health, armour: hero.armour, x: hero.vehicle ? hero.vehicle.x : hero.x, z: hero.vehicle ? hero.vehicle.z : hero.z },
    };
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      game.events.emit('saved', {});
      return true;
    } catch {
      game.notifications.toast('Could not save: storage is unavailable.', '', 4);
      return false;
    }
  }

  autosave() {
    if (this.save()) this.game.notifications.toast('Autosaved', '', 2.5);
  }

  /** Applies a save to a freshly started game. Returns false when there is none. */
  load() {
    const data = this.read();
    if (!data) return false;
    const game = this.game;
    game.progress.load(data.progress);
    game.combat.arsenal.load(data.arsenal);
    const hero = game.player.character;
    hero.health = Math.max(40, data.hero.health ?? 100);
    hero.armour = data.hero.armour ?? 0;
    const spot = PLACES.safehouse;
    hero.x = spot.x;
    hero.z = spot.z;
    return true;
  }

  erase() {
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch {
      // Nothing to erase when storage is off.
    }
  }
}
