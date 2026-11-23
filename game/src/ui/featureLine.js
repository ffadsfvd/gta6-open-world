// The title screen's line of what is in the game, counted from the game's own data: story
// missions, cars, guns, side jobs, street ranks, radio stations, the police helicopter and the
// day and night clock.
import { STORYLINE } from '../missions/storyline.js';
import { WEAPONS } from '../combat/weapons.js';
import { VEHICLE_TYPES } from '../vehicles/vehicleTypes.js';
import { STATIONS } from '../audio/musicPlayer.js';
import { RANKS } from '../progression/respectRank.js';
import { STREET_RACES } from '../activities/streetRaces.js';

export function gameFeatures() {
  const guns = Object.values(WEAPONS).filter((weapon) => !weapon.melee).length;
  return [
    `${STORYLINE.length} story missions`,
    `${Object.keys(VEHICLE_TYPES).length} car models to steal`,
    `${guns} guns`,
    `${STREET_RACES.length} street races, taxi fares and deliveries`,
    'a police helicopter',
    `${RANKS.length} street ranks`,
    `${STATIONS.length} radio stations`,
    'day and night',
  ];
}
