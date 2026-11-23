// Everything to do between story missions: race flags, the Pelican Express depot, taxi fares
// (T in any taxi), the Bayside Arms shop, the safehouse save point and the sunshell hunt.
// Shows each one on the maps and offers it when Kai stands on its marker.
import { PLACES } from '../world/cityPlan.js';
import { STREET_RACES, raceMission } from './streetRaces.js';
import { taxiFare } from './taxiJobs.js';
import { deliveryJob } from './deliveryJobs.js';
import { SunshellHunt } from './sunshells.js';
import { formatMoney } from '../core/mathUtils.js';

export class ActivityManager {
  constructor(game) {
    this.game = game;
    this.shells = new SunshellHunt(game);
    this.queueNextFare = false;
    this.spots = [
      ...STREET_RACES.map((spec) => ({
        id: spec.id, x: spec.start.x, z: spec.start.z, radius: 6, letter: 'R', color: '#ff9f1c', label: spec.title,
        needsVehicle: true,
        prompt: () => `Street race: <b>${spec.title}</b> (purse ${formatMoney(spec.purse)})<br>Press <kbd>E</kbd> to race.`,
        start: () => game.missions.start(raceMission(spec)),
      })),
      {
        id: 'depot', x: PLACES.depot.x, z: PLACES.depot.z, radius: 3, letter: 'D', color: '#e76f51', label: 'Pelican Express',
        prompt: () => '<b>Pelican Express</b>: three parcels, one van, no excuses.<br>Press <kbd>E</kbd> for a delivery run ($750).',
        start: () => game.missions.start(deliveryJob(game)),
      },
      {
        id: 'shop', x: PLACES.gunShop.x, z: PLACES.gunShop.z, radius: 3, letter: '$', color: '#2ecc71', label: 'Bayside Arms',
        prompt: () => '<b>Bayside Arms</b><br>Press <kbd>E</kbd> to shop.',
        start: () => game.shop.open(),
      },
      {
        id: 'safehouse', x: PLACES.safehouse.x, z: PLACES.safehouse.z, radius: 2.5, letter: 'S', color: '#4cc9f0', label: 'Safehouse',
        prompt: () => '<b>Seashell Apartments</b> — your place.<br>Press <kbd>E</kbd> to save the game.',
        start: () => {
          game.save.save();
          game.player.character.health = game.player.character.maxHealth;
          game.notifications.toast('Game saved. Health restored.', '', 3);
        },
      },
    ];
    this.landmarks = [
      { x: PLACES.hospital.x, z: PLACES.hospital.z, letter: '+', color: '#ff4d6d', label: 'Hospital' },
      { x: PLACES.policeStation.x, z: PLACES.policeStation.z, letter: 'P', color: '#3a86ff', label: 'Police HQ' },
    ];
  }

  /** Blips for the maps (the minimap shows only nearby ones). */
  mapSpots() {
    const player = this.game.player.character;
    const list = [];
    for (const spot of [...this.spots, ...this.landmarks]) {
      const far = Math.hypot(spot.x - player.x, spot.z - player.z) > 160;
      list.push({ x: spot.x, z: spot.z, kind: 'activity', letter: spot.letter, color: spot.color, label: spot.label, size: 7, far });
    }
    return list;
  }

  worldMarkers() {
    if (this.game.missions.active) return this.shells.markers();
    const markers = this.spots.map((spot) => ({ x: spot.x, z: spot.z, type: 'column', color: spot.color, radius: Math.min(spot.radius, 3), height: 4 }));
    return [...markers, ...this.shells.markers()];
  }

  update() {
    const game = this.game;
    this.shells.update();
    if (game.missions.active) return;
    const player = game.player.character;
    const vehicle = player.vehicle;
    if (this.queueNextFare) {
      this.queueNextFare = false;
      if (vehicle && vehicle.type === 'taxi') {
        game.missions.start(taxiFare(game, vehicle));
        return;
      }
    }
    if (vehicle && vehicle.type === 'taxi' && game.wanted.level > 0) {
      game.hud.hint('Sunny Cab: lose the police to take fares.', 0.2);
    } else if (vehicle && vehicle.type === 'taxi') {
      game.hud.hint('Sunny Cab: press <kbd>T</kbd> to pick up fares.', 0.2);
      if (game.input.wasPressed('taxi')) {
        game.missions.start(taxiFare(game, vehicle));
        return;
      }
    }
    if (game.wanted.level > 0 || game.missions.cooldown > 0) return;
    for (const spot of this.spots) {
      if (Math.hypot(player.x - spot.x, player.z - spot.z) > spot.radius + 1.5) continue;
      if (spot.needsVehicle && !vehicle) {
        game.hud.hint(`Street race: <b>${spot.label}</b>. Bring a car.`, 0.2);
        continue;
      }
      if (!spot.needsVehicle && vehicle) continue;
      game.hud.hint(spot.prompt(), 0.2);
      if (game.input.wasPressed('interact')) spot.start();
    }
  }
}
