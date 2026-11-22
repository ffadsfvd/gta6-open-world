// Owns every person: spawning and removal, brains first, then motion, animation clocks and
// crowd separation, riders following their vehicles, and drawing.
import { Character } from './character.js';
import { stepCharacter, separateCharacters } from './characterMotion.js';
import { advanceAnimation } from './humanAnimator.js';
import { HumanRenderer } from './humanRenderer.js';
import { groundHeight } from '../world/terrain.js';

export class CharacterManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.renderer = new HumanRenderer(game.scene);
  }

  spawn(kind, x, z, appearance, options = {}) {
    const character = new Character(kind, x, z, appearance);
    character.y = groundHeight(x, z);
    character.yaw = options.yaw ?? 0;
    if (options.health) {
      character.health = options.health;
      character.maxHealth = options.health;
    }
    this.list.push(character);
    return character;
  }

  remove(character) {
    const index = this.list.indexOf(character);
    if (index >= 0) this.list.splice(index, 1);
    character.active = false;
    character.brain = null;
    if (character.vehicle && character.vehicle.driver === character) character.vehicle.driver = null;
    character.vehicle = null;
  }

  update(dt) {
    const game = this.game;
    for (const character of this.list) {
      // Nothing but the keyboard moves the player: a brain left on him by mistake is dropped.
      if (character.brain && character.kind === 'player') character.brain = null;
      if (character.brain && character.active) character.brain.update(dt, game);
    }
    for (const character of this.list) {
      if (!character.active) continue;
      if (character.vehicle) {
        character.x = character.vehicle.x;
        character.y = character.vehicle.y;
        character.z = character.vehicle.z;
        character.vx = character.vehicle.vx;
        character.vz = character.vehicle.vz;
      } else {
        stepCharacter(character, dt, game.collision);
      }
      advanceAnimation(character, dt);
    }
    separateCharacters(this.list);
  }

  nearest(x, z, radius, predicate = null) {
    let best = null;
    let bestDistance = radius * radius;
    for (const character of this.list) {
      if (!character.active) continue;
      const d = (character.x - x) ** 2 + (character.z - z) ** 2;
      if (d < bestDistance && (!predicate || predicate(character))) {
        bestDistance = d;
        best = character;
      }
    }
    return best;
  }

  render(camera) {
    this.renderer.sync(this.list, camera);
  }
}
