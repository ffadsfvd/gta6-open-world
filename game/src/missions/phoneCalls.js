// Calls that come in while Kai is busy, so the story keeps talking at the wheel: during a story
// mission Juno phones when the police helicopter shows up, and the police scanner on Kai's
// dashboard relays dispatch as the heat climbs, naming the street he is on. They never stop the
// car, each plays once per mission and none cuts into a conversation already under way.
import { streetNameAt, districtName } from '../world/cityPlan.js';

export class PhoneCalls {
  constructor(game) {
    this.game = game;
    this.heard = new Set();
    game.events.on('missionStarted', () => this.heard.clear());
    game.events.on('helicopterArrived', () => this.ring('air', [['juno', "That's Skyhawk, the police chopper. Get under cover or out of its light and they lose you!"]], 'phone'));
    game.events.on('wantedChanged', (e) => {
      if (e.level >= 3 && e.level > e.previous) this.ring(`heat${e.level}`, [['dispatch', this.dispatchLine(e.level)]], 'radio');
    });
  }

  dispatchLine(level) {
    const player = this.game.player.character;
    const street = streetNameAt(player.x, player.z) || districtName(player.x, player.z);
    const car = player.vehicle ? `in a ${player.vehicle.name}` : 'on foot';
    const extra = level >= 4 ? ' Air support is on the way.' : ' All units respond.';
    return `Suspect Kai Moreno ${car}, ${street}. ${level} stars.${extra}`;
  }

  /** Plays a call once per mission, while a story mission runs and nobody else is talking. */
  ring(key, lines, via) {
    const game = this.game;
    const mission = game.missions.current;
    if (!mission || !mission.def.story || this.heard.has(key) || game.dialogue.active) return false;
    this.heard.add(key);
    game.dialogue.play(lines, { auto: true, via });
    return true;
  }
}
